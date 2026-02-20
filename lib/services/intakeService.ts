import {
  INTAKE_STEP_DEFINITIONS,
  isFieldRequired,
  isFieldVisible,
  type IntakeFieldDefinition,
} from "@/lib/domain/intakeConfig";
import type { BrokeragePortalTone, IntakeAsset, IntakeSession } from "@/lib/domain/types";
import { isPostgresDriver } from "@/lib/persistence/driver";
import {
  addAuditLog,
  addIntakeAsset,
  forceStatus,
  getBrokerageById,
  getClientById,
  getDb,
  getSessionById,
  getStepsForSession,
  setCurrentStep,
  setMissingItems,
  touchClientActivity,
  transitionSession,
  upsertStepData,
} from "@/lib/persistence/mockDb";
import {
  addAuditLogInSupabase,
  addIntakeAssetInSupabase,
  forceStatusInSupabase,
  getBrokerageByIdFromSupabase,
  getClientByIdFromSupabase,
  listIntakeAssetsForSessionFromSupabase,
  getSessionByIdFromSupabase,
  getStepsForSessionFromSupabase,
  setCurrentStepInSupabase,
  setMissingItemsInSupabase,
  touchClientActivityInSupabase,
  transitionSessionInSupabase,
  updateIntakeAssetDriveInSupabase,
  upsertStepDataInSupabase,
} from "@/lib/persistence/supabaseRest";
import { resolvePortalAuthForBrokerage } from "@/lib/services/authService";
import { ensureDriveFolder, uploadAssetToDrive } from "@/lib/services/googleDriveService";

function validateRequired(
  stepKey: string,
  data: Record<string, unknown>,
): Array<{ field: string; message: string }> {
  const def = INTAKE_STEP_DEFINITIONS.find((item) => item.key === stepKey);
  if (!def) {
    return [{ field: stepKey, message: "Unknown step" }];
  }

  const errors: Array<{ field: string; message: string }> = [];

  def.fields
    .filter((field) => isFieldVisible(field, data))
    .forEach((field) => {
      const value = data[field.name];

      if (isFieldRequired(field, data) && isEmptyValue(value, field)) {
        errors.push({ field: field.name, message: `${field.label} is required` });
        return;
      }

      if (isEmptyValue(value, field)) {
        return;
      }

      const validationError = validateFieldValue(field, value);
      if (validationError) {
        errors.push({ field: field.name, message: validationError });
      }
    });

  const sumGroups = new Set(
    def.fields
      .map((field) => field.validation?.sumGroup)
      .filter((item): item is string => Boolean(item)),
  );

  sumGroups.forEach((group) => {
    const fields = def.fields.filter((field) => field.validation?.sumGroup === group);
    const total = fields.reduce((sum, field) => {
      const raw = data[field.name];
      const n = parseNumberish(raw);
      return Number.isFinite(n) ? sum + n : sum;
    }, 0);
    if (Math.round(total) !== 100) {
      errors.push({ field: group, message: "Revenue breakdown percentages must total 100%" });
    }
  });

  return errors;
}

function isEmptyValue(value: unknown, field: IntakeFieldDefinition): boolean {
  if (field.type === "boolean") {
    return value !== true;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  if (typeof value === "number") {
    return Number.isNaN(value);
  }

  return typeof value !== "string" || value.trim().length === 0;
}

function validateFieldValue(field: IntakeFieldDefinition, value: unknown): string | null {
  if (field.validation?.regex && typeof value === "string") {
    const regex = new RegExp(field.validation.regex);
    if (!regex.test(value.trim())) {
      return `${field.label} format is invalid`;
    }
  }

  if (field.validation?.maxWords && typeof value === "string") {
    const words = value
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (words.length > field.validation.maxWords) {
      return `${field.label} cannot exceed ${field.validation.maxWords} words`;
    }
  }

  if ((field.type === "number" || field.type === "currency") && value !== null && value !== undefined) {
    const numberValue = parseNumberish(value);
    if (!Number.isFinite(numberValue)) {
      return `${field.label} must be numeric`;
    }
    if (field.validation?.min !== undefined && numberValue < field.validation.min) {
      return `${field.label} must be at least ${field.validation.min}`;
    }
    if (field.validation?.max !== undefined && numberValue > field.validation.max) {
      return `${field.label} must be no more than ${field.validation.max}`;
    }
  }

  return null;
}

function parseNumberish(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    return Number(cleaned);
  }
  return Number(value);
}

function asLinkedUploadList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function buildFinalSubmitBlockers(input: {
  mergedData: Record<string, unknown>;
  assets: IntakeAsset[];
}): string[] {
  const blockers: string[] = [];
  const plUploads = asLinkedUploadList(input.mergedData.q2_11_upload_pl);
  if (plUploads.length === 0) {
    blockers.push("Upload at least one Profit & Loss statement (Financial Overview).");
  }

  const tenure = String(input.mergedData.q4_7_tenure ?? "");
  if (tenure === "Leasehold") {
    const leaseUploads = asLinkedUploadList(input.mergedData.q4_20_upload_lease);
    if (leaseUploads.length === 0) {
      blockers.push("Upload the lease agreement for leasehold assets (Property & Physical Assets).");
    }
  }

  const photoUploads = asLinkedUploadList(input.mergedData.q7_1_upload_photos);
  if (photoUploads.length < 3) {
    blockers.push("Add at least 3 photos in Media, Pricing & Final Details.");
  }
  if (photoUploads.length > 10) {
    blockers.push("Photo uploads are capped at 10 files.");
  }

  // Safety fallback for older sessions where linked field arrays may be empty.
  if (photoUploads.length === 0) {
    const propertyAssets = input.assets.filter((asset) => asset.category === "PROPERTY");
    if (propertyAssets.length >= 3) {
      return blockers.filter((item) => !item.includes("at least 3 photos"));
    }
  }

  return blockers;
}

async function resolveScope(input: { brokerageSlug: string; signedCookieValue?: string }): Promise<{
  brokerageId: string;
  clientId: string;
  sessionId: string;
}> {
  return resolvePortalAuthForBrokerage({
    brokerageSlug: input.brokerageSlug,
    signedCookieValue: input.signedCookieValue,
  });
}

export async function getIntakeSessionView(input: {
  brokerageSlug: string;
  signedCookieValue?: string;
}): Promise<{
  session: IntakeSession;
  steps: ReturnType<typeof getStepsForSession>;
  assets: IntakeAsset[];
  definitions: typeof INTAKE_STEP_DEFINITIONS;
  brokerage: {
    slug: string;
    name: string;
    branding: {
      logoUrl?: string;
      primaryColor: string;
      secondaryColor: string;
      legalFooter: string;
      showBeeSoldBranding: boolean;
      portalTone: BrokeragePortalTone;
    };
  };
  client: {
    businessName: string;
    contactName: string;
    email: string;
    hasPassword: boolean;
  };
}> {
  const scope = await resolveScope(input);

  if (isPostgresDriver()) {
    const session = await getSessionByIdFromSupabase(scope.sessionId);
    const client = await getClientByIdFromSupabase(scope.clientId);
    const brokerage = await getBrokerageByIdFromSupabase(scope.brokerageId);
    if (!session || !client || !brokerage) {
      throw new Error("Session scope invalid");
    }

    const steps = await getStepsForSessionFromSupabase(session.id);
    const assets = await listIntakeAssetsForSessionFromSupabase(session.id);

    return {
      session,
      steps,
      assets,
      definitions: INTAKE_STEP_DEFINITIONS,
      brokerage: {
        slug: brokerage.slug,
        name: brokerage.name,
        branding: brokerage.branding,
      },
      client: {
        businessName: client.businessName,
        contactName: client.contactName,
        email: client.email,
        hasPassword: Boolean(client.passwordHash),
      },
    };
  }

  const session = getSessionById(scope.sessionId);
  const client = getClientById(scope.clientId);
  const brokerage = getBrokerageById(scope.brokerageId);
  const db = getDb();

  return {
    session,
    steps: getStepsForSession(session.id),
    assets: db.intake_assets.filter((asset) => asset.sessionId === session.id),
    definitions: INTAKE_STEP_DEFINITIONS,
    brokerage: {
      slug: brokerage.slug,
      name: brokerage.name,
      branding: brokerage.branding,
    },
    client: {
      businessName: client.businessName,
      contactName: client.contactName,
      email: client.email,
      hasPassword: Boolean(client.passwordHash),
    },
  };
}

export async function saveIntakeStep(input: {
  brokerageSlug: string;
  signedCookieValue?: string;
  stepKey: string;
  data: Record<string, unknown>;
  currentStep: number;
  markComplete: boolean;
}): Promise<{ ok: boolean; errors: Array<{ field: string; message: string }> }> {
  const scope = await resolveScope(input);
  const session = isPostgresDriver()
    ? await getSessionByIdFromSupabase(scope.sessionId)
    : getSessionById(scope.sessionId);
  if (!session) {
    throw new Error("Session not found");
  }

  const errors = input.markComplete ? validateRequired(input.stepKey, input.data) : [];
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  if (isPostgresDriver()) {
    await upsertStepDataInSupabase(session.id, input.stepKey, input.data, input.markComplete);
    await setCurrentStepInSupabase(session.id, input.currentStep);
  } else {
    upsertStepData(session.id, input.stepKey, input.data, input.markComplete);
    setCurrentStep(session.id, input.currentStep);
  }

  if (session.status === "INVITED") {
    if (isPostgresDriver()) {
      await transitionSessionInSupabase(session.id, "IN_PROGRESS", "Client began intake", "CLIENT");
    } else {
      transitionSession(session.id, "IN_PROGRESS", "Client began intake", "CLIENT");
    }
  }

  if (session.status === "MISSING_ITEMS_REQUESTED") {
    if (isPostgresDriver()) {
      await forceStatusInSupabase(session.id, "IN_PROGRESS", "Client resumed after missing item request", "CLIENT");
    } else {
      forceStatus(session.id, "IN_PROGRESS", "Client resumed after missing item request", "CLIENT");
    }
  }

  if (isPostgresDriver()) {
    await touchClientActivityInSupabase(scope.clientId);
    await addAuditLogInSupabase(session.id, scope.brokerageId, scope.clientId, "CLIENT", "INTAKE_STEP_SAVED", {
      stepKey: input.stepKey,
      markComplete: input.markComplete,
      currentStep: input.currentStep,
    });
  } else {
    touchClientActivity(scope.clientId);
    addAuditLog(session.id, scope.brokerageId, scope.clientId, "CLIENT", "INTAKE_STEP_SAVED", {
      stepKey: input.stepKey,
      markComplete: input.markComplete,
      currentStep: input.currentStep,
    });
  }

  return { ok: true, errors: [] };
}

export async function saveAndExit(input: {
  brokerageSlug: string;
  signedCookieValue?: string;
  currentStep: number;
}): Promise<{ ok: true }> {
  const scope = await resolveScope(input);
  if (isPostgresDriver()) {
    await setCurrentStepInSupabase(scope.sessionId, input.currentStep);
    await addAuditLogInSupabase(scope.sessionId, scope.brokerageId, scope.clientId, "CLIENT", "SAVE_AND_EXIT", {
      currentStep: input.currentStep,
    });
    await touchClientActivityInSupabase(scope.clientId);
  } else {
    setCurrentStep(scope.sessionId, input.currentStep);
    addAuditLog(scope.sessionId, scope.brokerageId, scope.clientId, "CLIENT", "SAVE_AND_EXIT", {
      currentStep: input.currentStep,
    });
    touchClientActivity(scope.clientId);
  }
  return { ok: true };
}

export async function addAssetToSession(input: {
  brokerageSlug: string;
  signedCookieValue?: string;
  category: IntakeAsset["category"];
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  fileBytes?: Uint8Array;
}): Promise<IntakeAsset> {
  const scope = await resolveScope(input);
  const session = isPostgresDriver()
    ? await getSessionByIdFromSupabase(scope.sessionId)
    : getSessionById(scope.sessionId);
  const client = isPostgresDriver()
    ? await getClientByIdFromSupabase(scope.clientId)
    : getClientById(scope.clientId);
  const brokerage = isPostgresDriver()
    ? await getBrokerageByIdFromSupabase(scope.brokerageId)
    : getBrokerageById(scope.brokerageId);
  if (!session || !client || !brokerage) {
    throw new Error("Session scope invalid");
  }

  await ensureDriveFolder({ brokerage, client, session });

  const asset = isPostgresDriver()
    ? await addIntakeAssetInSupabase({
        sessionId: session.id,
        brokerageId: scope.brokerageId,
        clientId: scope.clientId,
        category: input.category,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
      })
    : addIntakeAsset({
        sessionId: session.id,
        brokerageId: scope.brokerageId,
        clientId: scope.clientId,
        category: input.category,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
      });

  const drive = await uploadAssetToDrive({
    brokerage,
    client,
    session,
    fileName: input.fileName,
    mimeType: input.mimeType,
    revision: asset.revision,
    fileBytes: input.fileBytes,
  });

  if (isPostgresDriver()) {
    await updateIntakeAssetDriveInSupabase(asset.id, drive.driveFileId, drive.driveFileUrl);
  } else {
    asset.driveFileId = drive.driveFileId;
    asset.driveFileUrl = drive.driveFileUrl;
  }

  if (isPostgresDriver()) {
    await addAuditLogInSupabase(scope.sessionId, scope.brokerageId, scope.clientId, "CLIENT", "ASSET_UPLOADED", {
      category: asset.category,
      fileName: asset.fileName,
      revision: asset.revision,
      driveFileUrl: drive.driveFileUrl,
    });
    await touchClientActivityInSupabase(scope.clientId);
    return { ...asset, driveFileId: drive.driveFileId, driveFileUrl: drive.driveFileUrl };
  }

  addAuditLog(scope.sessionId, scope.brokerageId, scope.clientId, "CLIENT", "ASSET_UPLOADED", {
    category: asset.category,
    fileName: asset.fileName,
    revision: asset.revision,
    driveFileUrl: asset.driveFileUrl,
  });

  touchClientActivity(scope.clientId);
  return asset;
}

export async function submitPartial(input: {
  brokerageSlug: string;
  signedCookieValue?: string;
  note?: string;
}): Promise<IntakeSession> {
  const scope = await resolveScope(input);
  const session = isPostgresDriver()
    ? await getSessionByIdFromSupabase(scope.sessionId)
    : getSessionById(scope.sessionId);
  if (!session) {
    throw new Error("Session not found");
  }
  if (session.status === "INVITED") {
    if (isPostgresDriver()) {
      await transitionSessionInSupabase(session.id, "IN_PROGRESS", "Client began intake", "CLIENT");
    } else {
      transitionSession(session.id, "IN_PROGRESS", "Client began intake", "CLIENT");
    }
  }

  const updated =
    session.status === "PARTIAL_SUBMITTED"
      ? isPostgresDriver()
        ? await forceStatusInSupabase(session.id, "PARTIAL_SUBMITTED", "Partial submission updated", "CLIENT")
        : forceStatus(session.id, "PARTIAL_SUBMITTED", "Partial submission updated", "CLIENT")
      : isPostgresDriver()
        ? await transitionSessionInSupabase(session.id, "PARTIAL_SUBMITTED", "Client submitted partial intake", "CLIENT")
        : transitionSession(session.id, "PARTIAL_SUBMITTED", "Client submitted partial intake", "CLIENT");

  if (isPostgresDriver()) {
    await addAuditLogInSupabase(scope.sessionId, scope.brokerageId, scope.clientId, "CLIENT", "INTAKE_PARTIAL_SUBMIT", {
      note: input.note ?? "",
    });
    await touchClientActivityInSupabase(scope.clientId);
  } else {
    addAuditLog(scope.sessionId, scope.brokerageId, scope.clientId, "CLIENT", "INTAKE_PARTIAL_SUBMIT", {
      note: input.note ?? "",
    });
    touchClientActivity(scope.clientId);
  }

  return updated;
}

export async function submitFinal(input: {
  brokerageSlug: string;
  signedCookieValue?: string;
}): Promise<IntakeSession> {
  const scope = await resolveScope(input);
  const session = isPostgresDriver()
    ? await getSessionByIdFromSupabase(scope.sessionId)
    : getSessionById(scope.sessionId);
  if (!session) {
    throw new Error("Session not found");
  }

  const steps = isPostgresDriver()
    ? await getStepsForSessionFromSupabase(session.id)
    : getStepsForSession(session.id);
  const assets = isPostgresDriver()
    ? await listIntakeAssetsForSessionFromSupabase(session.id)
    : getDb().intake_assets.filter((asset) => asset.sessionId === session.id);
  const mergedData = steps.reduce<Record<string, unknown>>((acc, step) => ({ ...acc, ...step.data }), {});
  const blockers = buildFinalSubmitBlockers({ mergedData, assets });
  if (blockers.length > 0) {
    throw new Error(`Before final submit, please complete: ${blockers.join(" ")}`);
  }

  if (session.status === "INVITED") {
    if (isPostgresDriver()) {
      await transitionSessionInSupabase(session.id, "IN_PROGRESS", "Client began intake", "CLIENT");
    } else {
      transitionSession(session.id, "IN_PROGRESS", "Client began intake", "CLIENT");
    }
  }

  const allowed = ["IN_PROGRESS", "PARTIAL_SUBMITTED", "MISSING_ITEMS_REQUESTED"];
  const next = allowed.includes(session.status)
    ? isPostgresDriver()
      ? await transitionSessionInSupabase(session.id, "FINAL_SUBMITTED", "Client submitted final intake", "CLIENT")
      : transitionSession(session.id, "FINAL_SUBMITTED", "Client submitted final intake", "CLIENT")
    : isPostgresDriver()
      ? await forceStatusInSupabase(session.id, "FINAL_SUBMITTED", "Client forced final submission", "CLIENT")
      : forceStatus(session.id, "FINAL_SUBMITTED", "Client forced final submission", "CLIENT");

  if (isPostgresDriver()) {
    await setMissingItemsInSupabase(session.id, []);
    await addAuditLogInSupabase(scope.sessionId, scope.brokerageId, scope.clientId, "CLIENT", "INTAKE_FINAL_SUBMIT", {});
    await touchClientActivityInSupabase(scope.clientId);
  } else {
    setMissingItems(session.id, []);
    addAuditLog(scope.sessionId, scope.brokerageId, scope.clientId, "CLIENT", "INTAKE_FINAL_SUBMIT", {});
    touchClientActivity(scope.clientId);
  }

  return next;
}

export async function requestMissingItems(input: {
  sessionId: string;
  missingItems: string[];
  requestedBy: string;
}): Promise<IntakeSession> {
  const session = isPostgresDriver()
    ? await getSessionByIdFromSupabase(input.sessionId)
    : getSessionById(input.sessionId);
  if (!session) {
    throw new Error("Session not found");
  }
  const client = isPostgresDriver()
    ? await getClientByIdFromSupabase(session.clientId)
    : getClientById(session.clientId);
  if (!client) {
    throw new Error("Client not found");
  }

  if (isPostgresDriver()) {
    await setMissingItemsInSupabase(session.id, input.missingItems);
  } else {
    setMissingItems(session.id, input.missingItems);
  }

  const next =
    session.status === "MISSING_ITEMS_REQUESTED"
      ? isPostgresDriver()
        ? await forceStatusInSupabase(session.id, "MISSING_ITEMS_REQUESTED", "Missing items request updated", "OPERATOR")
        : forceStatus(session.id, "MISSING_ITEMS_REQUESTED", "Missing items request updated", "OPERATOR")
      : isPostgresDriver()
        ? await transitionSessionInSupabase(session.id, "MISSING_ITEMS_REQUESTED", "Operator requested missing items", "OPERATOR")
        : transitionSession(session.id, "MISSING_ITEMS_REQUESTED", "Operator requested missing items", "OPERATOR");

  if (isPostgresDriver()) {
    await addAuditLogInSupabase(session.id, session.brokerageId, session.clientId, "OPERATOR", "MISSING_ITEMS_REQUESTED", {
      requestedBy: input.requestedBy,
      missingItems: input.missingItems,
    });
    await touchClientActivityInSupabase(client.id);
  } else {
    addAuditLog(session.id, session.brokerageId, session.clientId, "OPERATOR", "MISSING_ITEMS_REQUESTED", {
      requestedBy: input.requestedBy,
      missingItems: input.missingItems,
    });
    touchClientActivity(client.id);
  }
  return next;
}
