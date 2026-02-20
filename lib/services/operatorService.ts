import { isPostgresDriver } from "@/lib/persistence/driver";
import {
  addAuditLog,
  getAuditForSession,
  getBrokerageById,
  setClientArchived,
  getClientById,
  getDb,
  getReportBySessionId,
  getSessionById,
  transitionSession,
  upsertReport,
} from "@/lib/persistence/mockDb";
import {
  addAuditLogInSupabase,
  forceStatusInSupabase,
  getAuditForSessionFromSupabase,
  getReportBySessionIdFromSupabase,
  getSessionByIdFromSupabase,
  listMissionControlIntakesFromSupabase,
  setClientArchivedInSupabase,
  transitionSessionInSupabase,
  upsertReportInSupabase,
} from "@/lib/persistence/supabaseRest";
import { sendInviteForSession } from "@/lib/services/onboardingService";
import { requestMissingItems } from "@/lib/services/intakeService";
import { nowIso } from "@/lib/utils/id";

export async function listMissionControlIntakes(options?: { includeArchived?: boolean }) {
  const includeArchived = options?.includeArchived ?? false;
  if (isPostgresDriver()) {
    return listMissionControlIntakesFromSupabase({ includeArchived });
  }
  const db = getDb();

  const shaped = db.intake_sessions.map((session) => {
    const client = getClientById(session.clientId);
    const brokerage = getBrokerageById(session.brokerageId);
    const steps = db.intake_steps.filter((step) => step.sessionId === session.id);
    const complete = steps.filter((step) => step.isComplete).length;

    return {
      id: session.id,
      brokerage: {
        id: brokerage.id,
        slug: brokerage.slug,
        name: brokerage.name,
        isArchived: brokerage.isArchived,
      },
      client: {
        id: client.id,
        businessName: client.businessName,
        contactName: client.contactName,
        email: client.email,
        phone: client.phone,
        assignedOwner: client.assignedOwner,
        isArchived: client.isArchived,
      },
      status: session.status,
      completionPct: session.completionPct,
      currentStep: session.currentStep,
      totalSteps: session.totalSteps,
      stepsCompleted: complete,
      invitedAt: session.inviteSentAt,
      partialSubmittedAt: session.partialSubmittedAt,
      finalSubmittedAt: session.finalSubmittedAt,
      lastActivityAt: client.lastActivityAt,
      missingItems: session.missingItems,
      driveFolderUrl: session.driveFolderUrl,
      report: db.reports.find((report) => report.sessionId === session.id),
      jobs: db.jobs.filter((job) => job.sessionId === session.id),
    };
  });
  return includeArchived ? shaped : shaped.filter((item) => !item.client.isArchived && !item.brokerage.isArchived);
}

export async function getReport(sessionId: string) {
  if (isPostgresDriver()) {
    return getReportBySessionIdFromSupabase(sessionId);
  }
  return getReportBySessionId(sessionId);
}

export async function getClientTimeline(sessionId: string) {
  if (isPostgresDriver()) {
    return getAuditForSessionFromSupabase(sessionId);
  }
  return getAuditForSession(sessionId);
}

export async function resendInvite(sessionId: string) {
  const invite = await sendInviteForSession(sessionId);
  return invite;
}

export async function sendNewMagicLink(sessionId: string) {
  const invite = await sendInviteForSession(sessionId);
  return invite;
}

export async function markMissingItems(input: {
  sessionId: string;
  missingItems: string[];
  requestedBy: string;
}) {
  return requestMissingItems(input);
}

export async function setClientArchiveState(input: {
  sessionId: string;
  isArchived: boolean;
  actorName: string;
}) {
  if (isPostgresDriver()) {
    const session = await getSessionByIdFromSupabase(input.sessionId);
    if (!session) throw new Error("Session not found");
    await setClientArchivedInSupabase(session.clientId, input.isArchived);
    await addAuditLogInSupabase(session.id, session.brokerageId, session.clientId, "OPERATOR", "CLIENT_ARCHIVE_CHANGED", {
      isArchived: input.isArchived,
      actorName: input.actorName,
    });
    return;
  }

  const session = getSessionById(input.sessionId);
  const client = setClientArchived(session.clientId, input.isArchived);
  addAuditLog(session.id, session.brokerageId, client.id, "OPERATOR", "CLIENT_ARCHIVE_CHANGED", {
    isArchived: input.isArchived,
    actorName: input.actorName,
  });
}

export async function processApproval(input: {
  sessionId: string;
  decision: "APPROVE" | "REJECT";
  operatorName: string;
  note?: string;
}) {
  if (isPostgresDriver()) {
    const session = await getSessionByIdFromSupabase(input.sessionId);
    if (!session) throw new Error("Session not found");
    if (session.status !== "REPORT_READY") {
      throw new Error("Approval is only allowed in REPORT_READY");
    }

    if (input.decision === "APPROVE") {
      await transitionSessionInSupabase(
        input.sessionId,
        "APPROVED",
        `Approved by operator ${input.operatorName}`,
        "OPERATOR",
      );

      const report = await getReportBySessionIdFromSupabase(input.sessionId);
      if (report) {
        await upsertReportInSupabase(input.sessionId, {
          sessionId: report.sessionId,
          title: report.title,
          summary: report.summary,
          findings: report.findings,
          recommendations: report.recommendations,
          approvedAt: nowIso(),
        });
      }
    } else {
      await forceStatusInSupabase(
        input.sessionId,
        "IN_PROGRESS",
        `Rejected by operator ${input.operatorName}: ${input.note ?? "Needs revisions"}`,
        "OPERATOR",
      );
    }

    await addAuditLogInSupabase(input.sessionId, session.brokerageId, session.clientId, "OPERATOR", "REPORT_DECISION", {
      decision: input.decision,
      operatorName: input.operatorName,
      note: input.note,
    });
    return;
  }

  const session = getSessionById(input.sessionId);

  if (session.status !== "REPORT_READY") {
    throw new Error("Approval is only allowed in REPORT_READY");
  }

  if (input.decision === "APPROVE") {
    transitionSession(
      input.sessionId,
      "APPROVED",
      `Approved by operator ${input.operatorName}`,
      "OPERATOR",
    );

    const report = getReportBySessionId(input.sessionId);
    if (report) {
      upsertReport(input.sessionId, {
        sessionId: report.sessionId,
        title: report.title,
        summary: report.summary,
        findings: report.findings,
        recommendations: report.recommendations,
        approvedAt: nowIso(),
      });
    }
  } else {
    transitionSession(
      input.sessionId,
      "IN_PROGRESS",
      `Rejected by operator ${input.operatorName}: ${input.note ?? "Needs revisions"}`,
      "OPERATOR",
    );
  }

  addAuditLog(input.sessionId, session.brokerageId, session.clientId, "OPERATOR", "REPORT_DECISION", {
    decision: input.decision,
    operatorName: input.operatorName,
    note: input.note,
  });
}
