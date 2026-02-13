import {
  addAuditLog,
  getDb,
  getReportBySessionId,
  getSessionById,
  transitionSession,
  upsertReport,
} from "@/lib/persistence/mockDb";
import { nowIso } from "@/lib/utils/id";

export function listMissionControlIntakes() {
  const db = getDb();
  return db.intake_sessions.map((session) => ({
    ...session,
    jobs: db.jobs.filter((job) => job.sessionId === session.id),
    report: db.reports.find((report) => report.sessionId === session.id),
  }));
}

export function getReport(sessionId: string) {
  return getReportBySessionId(sessionId);
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

  addAuditLog(input.sessionId, "OPERATOR", "REPORT_DECISION", {
    decision: input.decision,
    operatorName: input.operatorName,
    note: input.note,
  });
}
