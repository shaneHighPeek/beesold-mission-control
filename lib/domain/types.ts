export type IntakeLifecycleState =
  | "DRAFT"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "KLOR_SYNTHESIS"
  | "COUNCIL_RUNNING"
  | "REPORT_READY"
  | "APPROVED";

export type JobStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";

export type JobKind = "KLOR_RUN" | "COUNCIL_RUN";

export interface IntakeSession {
  id: string;
  token: string;
  clientName: string;
  clientEmail: string;
  status: IntakeLifecycleState;
  currentStep: number;
  totalSteps: number;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
}

export interface IntakeStep {
  id: string;
  sessionId: string;
  stepKey: string;
  title: string;
  order: number;
  data: Record<string, unknown>;
  isComplete: boolean;
  updatedAt: string;
}

export interface IntakeAsset {
  id: string;
  sessionId: string;
  category: "FINANCIALS" | "LEGAL" | "PROPERTY" | "OTHER";
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
}

export interface IntakeStatusRecord {
  id: string;
  sessionId: string;
  status: IntakeLifecycleState;
  note: string;
  createdAt: string;
}

export interface Job {
  id: string;
  sessionId: string;
  kind: JobKind;
  status: JobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface JobOutput {
  id: string;
  jobId: string;
  outputType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  sessionId: string;
  actor: "SYSTEM" | "OPERATOR" | "CLIENT";
  action: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface Report {
  id: string;
  sessionId: string;
  title: string;
  summary: string;
  findings: string[];
  recommendations: string[];
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
}

export interface MockDatabase {
  intake_sessions: IntakeSession[];
  intake_steps: IntakeStep[];
  intake_assets: IntakeAsset[];
  intake_status: IntakeStatusRecord[];
  jobs: Job[];
  job_status: Array<{ id: string; jobId: string; status: JobStatus; createdAt: string }>;
  job_outputs: JobOutput[];
  audit_log: AuditLog[];
  reports: Report[];
}
