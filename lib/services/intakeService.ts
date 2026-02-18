import {
  INTAKE_STEP_DEFINITIONS,
  isFieldRequired,
  isFieldVisible,
  type IntakeFieldDefinition,
} from "@/lib/domain/intakeConfig";
import type { BrokeragePortalTone, IntakeAsset, IntakeSession } from "@/lib/domain/types";
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

function resolveScope(input: { brokerageSlug: string; signedCookieValue?: string }): {
  brokerageId: string;
  clientId: string;
  sessionId: string;
} {
  return resolvePortalAuthForBrokerage({
    brokerageSlug: input.brokerageSlug,
    signedCookieValue: input.signedCookieValue,
  });
}

export function getIntakeSessionView(input: {
  brokerageSlug: string;
  signedCookieValue?: string;
}): {
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
} {
  const scope = resolveScope(input);
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

export function saveIntakeStep(input: {
  brokerageSlug: string;
  signedCookieValue?: string;
  stepKey: string;
  data: Record<string, unknown>;
  currentStep: number;
  markComplete: boolean;
}): { ok: boolean; errors: Array<{ field: string; message: string }> } {
  const scope = resolveScope(input);
  const session = getSessionById(scope.sessionId);

  const errors = input.markComplete ? validateRequired(input.stepKey, input.data) : [];
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  upsertStepData(session.id, input.stepKey, input.data, input.markComplete);
  setCurrentStep(session.id, input.currentStep);

  if (session.status === "INVITED") {
    transitionSession(session.id, "IN_PROGRESS", "Client began intake", "CLIENT");
  }

  if (session.status === "MISSING_ITEMS_REQUESTED") {
    forceStatus(session.id, "IN_PROGRESS", "Client resumed after missing item request", "CLIENT");
  }

  touchClientActivity(scope.clientId);
  addAuditLog(session.id, scope.brokerageId, scope.clientId, "CLIENT", "INTAKE_STEP_SAVED", {
    stepKey: input.stepKey,
    markComplete: input.markComplete,
    currentStep: input.currentStep,
  });

  return { ok: true, errors: [] };
}

export function saveAndExit(input: {
  brokerageSlug: string;
  signedCookieValue?: string;
  currentStep: number;
}): { ok: true } {
  const scope = resolveScope(input);
  setCurrentStep(scope.sessionId, input.currentStep);
  addAuditLog(scope.sessionId, scope.brokerageId, scope.clientId, "CLIENT", "SAVE_AND_EXIT", {
    currentStep: input.currentStep,
  });
  touchClientActivity(scope.clientId);
  return { ok: true };
}

export function addAssetToSession(input: {
  brokerageSlug: string;
  signedCookieValue?: string;
  category: IntakeAsset["category"];
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}): IntakeAsset {
  const scope = resolveScope(input);
  const session = getSessionById(scope.sessionId);
  const client = getClientById(scope.clientId);
  const brokerage = getBrokerageById(scope.brokerageId);

  ensureDriveFolder({ brokerage, client, session });

  const asset = addIntakeAsset({
    sessionId: session.id,
    brokerageId: scope.brokerageId,
    clientId: scope.clientId,
    category: input.category,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
  });

  const drive = uploadAssetToDrive({
    brokerage,
    client,
    session,
    fileName: input.fileName,
    mimeType: input.mimeType,
    revision: asset.revision,
  });

  asset.driveFileId = drive.driveFileId;
  asset.driveFileUrl = drive.driveFileUrl;

  addAuditLog(scope.sessionId, scope.brokerageId, scope.clientId, "CLIENT", "ASSET_UPLOADED", {
    category: asset.category,
    fileName: asset.fileName,
    revision: asset.revision,
    driveFileUrl: asset.driveFileUrl,
  });

  touchClientActivity(scope.clientId);
  return asset;
}

export function submitPartial(input: {
  brokerageSlug: string;
  signedCookieValue?: string;
  note?: string;
}): IntakeSession {
  const scope = resolveScope(input);
  const session = getSessionById(scope.sessionId);
  if (session.status === "INVITED") {
    transitionSession(session.id, "IN_PROGRESS", "Client began intake", "CLIENT");
  }

  const updated =
    session.status === "PARTIAL_SUBMITTED"
      ? forceStatus(session.id, "PARTIAL_SUBMITTED", "Partial submission updated", "CLIENT")
      : transitionSession(session.id, "PARTIAL_SUBMITTED", "Client submitted partial intake", "CLIENT");

  addAuditLog(scope.sessionId, scope.brokerageId, scope.clientId, "CLIENT", "INTAKE_PARTIAL_SUBMIT", {
    note: input.note ?? "",
  });

  touchClientActivity(scope.clientId);
  return updated;
}

export function submitFinal(input: {
  brokerageSlug: string;
  signedCookieValue?: string;
}): IntakeSession {
  const scope = resolveScope(input);
  const session = getSessionById(scope.sessionId);

  if (session.status === "INVITED") {
    transitionSession(session.id, "IN_PROGRESS", "Client began intake", "CLIENT");
  }

  const allowed = ["IN_PROGRESS", "PARTIAL_SUBMITTED", "MISSING_ITEMS_REQUESTED"];
  const next = allowed.includes(session.status)
    ? transitionSession(session.id, "FINAL_SUBMITTED", "Client submitted final intake", "CLIENT")
    : forceStatus(session.id, "FINAL_SUBMITTED", "Client forced final submission", "CLIENT");

  setMissingItems(session.id, []);

  addAuditLog(scope.sessionId, scope.brokerageId, scope.clientId, "CLIENT", "INTAKE_FINAL_SUBMIT", {});

  touchClientActivity(scope.clientId);
  return next;
}

export function requestMissingItems(input: {
  sessionId: string;
  missingItems: string[];
  requestedBy: string;
}): IntakeSession {
  const session = getSessionById(input.sessionId);
  const client = getClientById(session.clientId);

  setMissingItems(session.id, input.missingItems);

  const next =
    session.status === "MISSING_ITEMS_REQUESTED"
      ? forceStatus(session.id, "MISSING_ITEMS_REQUESTED", "Missing items request updated", "OPERATOR")
      : transitionSession(session.id, "MISSING_ITEMS_REQUESTED", "Operator requested missing items", "OPERATOR");

  addAuditLog(session.id, session.brokerageId, session.clientId, "OPERATOR", "MISSING_ITEMS_REQUESTED", {
    requestedBy: input.requestedBy,
    missingItems: input.missingItems,
  });

  touchClientActivity(client.id);
  return next;
}
