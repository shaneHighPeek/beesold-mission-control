import {
  addAuditLog,
  addJobOutput,
  createJob,
  getReportBySessionId,
  getSessionById,
  getStepsForSession,
  setJobStatus,
  transitionSession,
  upsertReport,
} from "@/lib/persistence/mockDb";

export function runKlorSynthesis(sessionId: string): { jobId: string } {
  const session = getSessionById(sessionId);
  if (session.status !== "FINAL_SUBMITTED") {
    throw new Error("Klor synthesis requires FINAL_SUBMITTED status");
  }

  transitionSession(sessionId, "KLOR_SYNTHESIS", "Klor synthesis job started", "SYSTEM");

  const job = createJob(sessionId, "KLOR_RUN");
  setJobStatus(job.id, "RUNNING");

  const steps = getStepsForSession(sessionId);
  const synthesis = {
    completeness: steps.filter((step) => step.isComplete).length / Math.max(steps.length, 1),
    extractedThemes: ["Financial readiness", "Strategic timing", "Risk controls"],
  };

  addJobOutput(job.id, "KLOR_SYNTHESIS_SUMMARY", synthesis);
  setJobStatus(job.id, "COMPLETED");

  addAuditLog(sessionId, session.brokerageId, session.clientId, "SYSTEM", "KLOR_SYNTHESIS_COMPLETED", synthesis);
  return { jobId: job.id };
}

export function runCouncil(sessionId: string): { jobId: string } {
  const session = getSessionById(sessionId);
  if (session.status !== "KLOR_SYNTHESIS") {
    throw new Error("Council run requires KLOR_SYNTHESIS status");
  }

  transitionSession(sessionId, "COUNCIL_RUNNING", "Council analysis and report generation started", "SYSTEM");

  const job = createJob(sessionId, "COUNCIL_RUN");
  setJobStatus(job.id, "RUNNING");

  const report = upsertReport(sessionId, {
    sessionId,
    title: "Strategic Intake Report",
    summary: "Council completed structured synthesis. Listing is ready for operator review.",
    findings: [
      "Intake data quality is sufficient for downstream planning.",
      "Timeline pressure requires staged execution controls.",
      "Risk profile indicates review checkpoints should be retained.",
    ],
    recommendations: [
      "Approve with milestone-based execution gates.",
      "Validate legal and financial attachments before publishing output.",
      "Assign owner for deal execution orchestration.",
    ],
  });

  addJobOutput(job.id, "COUNCIL_REPORT", {
    reportId: report.id,
    summary: report.summary,
  });

  setJobStatus(job.id, "COMPLETED");
  transitionSession(sessionId, "REPORT_READY", "Report generated and awaiting operator decision", "SYSTEM");

  addAuditLog(sessionId, session.brokerageId, session.clientId, "SYSTEM", "COUNCIL_COMPLETED", {
    reportId: report.id,
  });
  return { jobId: job.id };
}

export function runFullPipeline(sessionId: string): { reportId: string } {
  runKlorSynthesis(sessionId);
  runCouncil(sessionId);

  const report = getReportBySessionId(sessionId);
  if (!report) {
    throw new Error("Report generation failed");
  }

  return { reportId: report.id };
}
