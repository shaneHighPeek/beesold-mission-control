import { INTAKE_STEP_DEFINITIONS } from "@/lib/domain/intakeConfig";
import {
  addAuditLog,
  getSessionByToken,
  getStepsForSession,
  setCurrentStep,
  setSubmittedAt,
  transitionSession,
  upsertStepData,
} from "@/lib/persistence/mockDb";
import type { IntakeAsset, IntakeSession } from "@/lib/domain/types";
import { newId, nowIso } from "@/lib/utils/id";
import { getDb } from "@/lib/persistence/mockDb";

function validateRequired(
  stepKey: string,
  data: Record<string, unknown>,
): Array<{ field: string; message: string }> {
  const def = INTAKE_STEP_DEFINITIONS.find((item) => item.key === stepKey);
  if (!def) {
    return [{ field: stepKey, message: "Unknown step" }];
  }

  return def.fields
    .filter((field) => field.required)
    .filter((field) => {
      const value = data[field.name];
      return typeof value !== "string" || value.trim().length === 0;
    })
    .map((field) => ({ field: field.name, message: `${field.label} is required` }));
}

export function getIntakeSessionView(token: string): {
  session: IntakeSession;
  steps: ReturnType<typeof getStepsForSession>;
  assets: IntakeAsset[];
  definitions: typeof INTAKE_STEP_DEFINITIONS;
} {
  const session = getSessionByToken(token);
  const db = getDb();
  return {
    session,
    steps: getStepsForSession(session.id),
    assets: db.intake_assets.filter((asset) => asset.sessionId === session.id),
    definitions: INTAKE_STEP_DEFINITIONS,
  };
}

export function saveIntakeStep(input: {
  token: string;
  stepKey: string;
  data: Record<string, unknown>;
  currentStep: number;
  markComplete: boolean;
}): { ok: boolean; errors: Array<{ field: string; message: string }> } {
  const session = getSessionByToken(input.token);
  const errors = input.markComplete ? validateRequired(input.stepKey, input.data) : [];

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  upsertStepData(session.id, input.stepKey, input.data, input.markComplete);
  setCurrentStep(session.id, input.currentStep);

  if (session.status === "DRAFT") {
    transitionSession(
      session.id,
      "IN_PROGRESS",
      "Client entered structured intake workflow",
      "CLIENT",
    );
  }

  addAuditLog(session.id, "CLIENT", "INTAKE_STEP_SAVED", {
    stepKey: input.stepKey,
    markComplete: input.markComplete,
    currentStep: input.currentStep,
  });

  return { ok: true, errors: [] };
}

export function addIntakeAsset(input: {
  token: string;
  category: IntakeAsset["category"];
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}): IntakeAsset {
  const session = getSessionByToken(input.token);
  const db = getDb();

  const asset: IntakeAsset = {
    id: newId("asset"),
    sessionId: session.id,
    category: input.category,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    uploadedAt: nowIso(),
  };

  db.intake_assets.push(asset);

  addAuditLog(session.id, "CLIENT", "ASSET_UPLOADED", {
    category: asset.category,
    fileName: asset.fileName,
  });

  return asset;
}

export function submitIntake(token: string): IntakeSession {
  const session = getSessionByToken(token);
  transitionSession(session.id, "SUBMITTED", "Client submitted intake", "CLIENT");
  setSubmittedAt(session.id);
  addAuditLog(session.id, "CLIENT", "INTAKE_SUBMITTED", {});
  return session;
}
