import {
  addAuditLog,
  getAuditForSession,
  getBrokerageById,
  getClientById,
  getDb,
  getReportBySessionId,
  getSessionById,
  transitionSession,
  upsertReport,
} from "@/lib/persistence/mockDb";
import { sendInviteForSession } from "@/lib/services/onboardingService";
import { requestMissingItems } from "@/lib/services/intakeService";
import { nowIso } from "@/lib/utils/id";

export function listMissionControlIntakes() {
  const db = getDb();

  return db.intake_sessions.map((session) => {
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
      },
      client: {
        id: client.id,
        businessName: client.businessName,
        contactName: client.contactName,
        email: client.email,
        phone: client.phone,
        assignedOwner: client.assignedOwner,
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
}

export function getReport(sessionId: string) {
  return getReportBySessionId(sessionId);
}

export function getClientTimeline(sessionId: string) {
  return getAuditForSession(sessionId);
}

export function resendInvite(sessionId: string) {
  const invite = sendInviteForSession(sessionId);
  return invite;
}

export function sendNewMagicLink(sessionId: string) {
  const invite = sendInviteForSession(sessionId);
  return invite;
}

export function markMissingItems(input: {
  sessionId: string;
  missingItems: string[];
  requestedBy: string;
}) {
  return requestMissingItems(input);
}

export function processApproval(input: {
  sessionId: string;
  decision: "APPROVE" | "REJECT";
  operatorName: string;
  note?: string;
}) {
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
