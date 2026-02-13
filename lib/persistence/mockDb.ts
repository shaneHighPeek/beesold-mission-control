import { INTAKE_STEP_DEFINITIONS } from "@/lib/domain/intakeConfig";
import type {
  AuditLog,
  IntakeLifecycleState,
  IntakeSession,
  IntakeStatusRecord,
  IntakeStep,
  Job,
  JobOutput,
  JobStatus,
  MockDatabase,
  Report,
} from "@/lib/domain/types";
import { assertTransition } from "@/lib/domain/stateMachine";
import { newId, nowIso } from "@/lib/utils/id";

const DEMO_TOKEN = "client-demo-001";

const initialSession: IntakeSession = {
  id: newId("session"),
  token: DEMO_TOKEN,
  clientName: "Acme Holdings",
  clientEmail: "owner@acme.example",
  status: "DRAFT",
  currentStep: 1,
  totalSteps: INTAKE_STEP_DEFINITIONS.length,
  createdAt: nowIso(),
  updatedAt: nowIso(),
};

const initialSteps: IntakeStep[] = INTAKE_STEP_DEFINITIONS.map((step, index) => ({
  id: newId("step"),
  sessionId: initialSession.id,
  stepKey: step.key,
  title: step.title,
  order: index + 1,
  data: {},
  isComplete: false,
  updatedAt: nowIso(),
}));

const db: MockDatabase = {
  intake_sessions: [initialSession],
  intake_steps: initialSteps,
  intake_assets: [],
  intake_status: [
    {
      id: newId("status"),
      sessionId: initialSession.id,
      status: "DRAFT",
      note: "Secure intake session initialized",
      createdAt: nowIso(),
    },
  ],
  jobs: [],
  job_status: [],
  job_outputs: [],
  audit_log: [],
  reports: [],
};

export function getDemoToken(): string {
  return DEMO_TOKEN;
}

export function getDb(): MockDatabase {
  return db;
}

export function getSessionByToken(token: string): IntakeSession {
  const session = db.intake_sessions.find((item) => item.token === token);
  if (!session) {
    throw new Error("Session not found");
  }
  return session;
}

export function getSessionById(sessionId: string): IntakeSession {
  const session = db.intake_sessions.find((item) => item.id === sessionId);
  if (!session) {
    throw new Error("Session not found");
  }
  return session;
}

export function getStepsForSession(sessionId: string): IntakeStep[] {
  return db.intake_steps
    .filter((step) => step.sessionId === sessionId)
    .sort((a, b) => a.order - b.order);
}

export function upsertStepData(
  sessionId: string,
  stepKey: string,
  data: Record<string, unknown>,
  isComplete: boolean,
): IntakeStep {
  const step = db.intake_steps.find(
    (item) => item.sessionId === sessionId && item.stepKey === stepKey,
  );

  if (!step) {
    throw new Error("Step not found");
  }

  step.data = { ...step.data, ...data };
  step.isComplete = isComplete;
  step.updatedAt = nowIso();
  return step;
}

export function setCurrentStep(sessionId: string, currentStep: number): void {
  const session = getSessionById(sessionId);
  session.currentStep = currentStep;
  session.updatedAt = nowIso();
}

export function transitionSession(
  sessionId: string,
  next: IntakeLifecycleState,
  note: string,
  actor: AuditLog["actor"],
): IntakeSession {
  const session = getSessionById(sessionId);
  const previousStatus = session.status;
  assertTransition(session.status, next);

  session.status = next;
  session.updatedAt = nowIso();

  const statusRecord: IntakeStatusRecord = {
    id: newId("status"),
    sessionId,
    status: next,
    note,
    createdAt: nowIso(),
  };
  db.intake_status.push(statusRecord);

  addAuditLog(sessionId, actor, "STATE_TRANSITION", {
    from: previousStatus,
    to: next,
    note,
  });

  return session;
}

export function forceStatus(
  sessionId: string,
  next: IntakeLifecycleState,
  note: string,
  actor: AuditLog["actor"],
): IntakeSession {
  const session = getSessionById(sessionId);
  session.status = next;
  session.updatedAt = nowIso();

  db.intake_status.push({
    id: newId("status"),
    sessionId,
    status: next,
    note,
    createdAt: nowIso(),
  });

  addAuditLog(sessionId, actor, "STATE_FORCE_SET", {
    to: next,
    note,
  });

  return session;
}

export function setSubmittedAt(sessionId: string): void {
  const session = getSessionById(sessionId);
  session.submittedAt = nowIso();
  session.updatedAt = nowIso();
}

export function createJob(sessionId: string, kind: Job["kind"]): Job {
  const job: Job = {
    id: newId("job"),
    sessionId,
    kind,
    status: "QUEUED",
    createdAt: nowIso(),
  };
  db.jobs.push(job);
  pushJobStatus(job.id, "QUEUED");
  return job;
}

export function setJobStatus(jobId: string, status: JobStatus): void {
  const job = db.jobs.find((item) => item.id === jobId);
  if (!job) {
    throw new Error("Job not found");
  }

  job.status = status;
  if (status === "RUNNING") {
    job.startedAt = nowIso();
  }
  if (status === "COMPLETED" || status === "FAILED") {
    job.completedAt = nowIso();
  }
  pushJobStatus(jobId, status);
}

function pushJobStatus(jobId: string, status: JobStatus): void {
  db.job_status.push({ id: newId("job_status"), jobId, status, createdAt: nowIso() });
}

export function addJobOutput(
  jobId: string,
  outputType: string,
  payload: Record<string, unknown>,
): JobOutput {
  const output: JobOutput = {
    id: newId("job_output"),
    jobId,
    outputType,
    payload,
    createdAt: nowIso(),
  };
  db.job_outputs.push(output);
  return output;
}

export function upsertReport(sessionId: string, report: Omit<Report, "id" | "createdAt" | "updatedAt">): Report {
  const existing = db.reports.find((item) => item.sessionId === sessionId);
  if (existing) {
    existing.title = report.title;
    existing.summary = report.summary;
    existing.findings = report.findings;
    existing.recommendations = report.recommendations;
    existing.approvedAt = report.approvedAt;
    existing.updatedAt = nowIso();
    return existing;
  }

  const newReport: Report = {
    id: newId("report"),
    sessionId,
    title: report.title,
    summary: report.summary,
    findings: report.findings,
    recommendations: report.recommendations,
    approvedAt: report.approvedAt,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  db.reports.push(newReport);
  return newReport;
}

export function getReportBySessionId(sessionId: string): Report | undefined {
  return db.reports.find((item) => item.sessionId === sessionId);
}

export function addAuditLog(
  sessionId: string,
  actor: AuditLog["actor"],
  action: string,
  details: Record<string, unknown>,
): AuditLog {
  const log: AuditLog = {
    id: newId("audit"),
    sessionId,
    actor,
    action,
    details,
    createdAt: nowIso(),
  };
  db.audit_log.push(log);
  return log;
}
