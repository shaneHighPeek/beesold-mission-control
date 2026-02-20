export type IntakeLifecycleState =
  | "INVITED"
  | "IN_PROGRESS"
  | "PARTIAL_SUBMITTED"
  | "MISSING_ITEMS_REQUESTED"
  | "FINAL_SUBMITTED"
  | "KLOR_SYNTHESIS"
  | "COUNCIL_RUNNING"
  | "REPORT_READY"
  | "APPROVED";

export type JobStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";

export type JobKind = "KLOR_RUN" | "COUNCIL_RUN";

export type IntakeActor = "SYSTEM" | "OPERATOR" | "CLIENT";
export type BrokeragePortalTone = "corporate" | "premium_advisory";

export interface BrokerageBranding {
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  legalFooter: string;
  showBeeSoldBranding: boolean;
  portalTone: BrokeragePortalTone;
}

export interface Brokerage {
  id: string;
  slug: string;
  name: string;
  shortName?: string;
  senderName: string;
  senderEmail: string;
  portalBaseUrl: string;
  driveParentFolderId?: string;
  isArchived: boolean;
  archivedAt?: string;
  branding: BrokerageBranding;
  createdAt: string;
  updatedAt: string;
}

export interface ClientIdentity {
  id: string;
  brokerageId: string;
  businessName: string;
  contactName: string;
  email: string;
  phone?: string;
  assignedOwner?: string;
  passwordSalt?: string;
  passwordHash?: string;
  isArchived: boolean;
  archivedAt?: string;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface IntakeSession {
  id: string;
  clientId: string;
  brokerageId: string;
  status: IntakeLifecycleState;
  currentStep: number;
  totalSteps: number;
  completionPct: number;
  partialSubmittedAt?: string;
  finalSubmittedAt?: string;
  inviteSentAt?: string;
  lastPortalAccessAt?: string;
  driveFolderId?: string;
  driveFolderUrl?: string;
  missingItems: string[];
  createdAt: string;
  updatedAt: string;
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
  brokerageId: string;
  clientId: string;
  category: "FINANCIALS" | "LEGAL" | "PROPERTY" | "OTHER";
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  revision: number;
  driveFileId?: string;
  driveFileUrl?: string;
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
  brokerageId: string;
  clientId: string;
  actor: IntakeActor;
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

export interface MagicLinkToken {
  id: string;
  tokenHash: string;
  sessionId: string;
  clientId: string;
  brokerageId: string;
  expiresAt: string;
  usedAt?: string;
  createdAt: string;
}

export interface PortalAuthSession {
  id: string;
  sessionId: string;
  clientId: string;
  brokerageId: string;
  expiresAt: string;
  createdAt: string;
}

export interface OutboundEmail {
  id: string;
  brokerageId: string;
  sessionId: string;
  to: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  html: string;
  providerMessageId?: string;
  providerStatus?: string;
  createdAt: string;
}

export interface MockDatabase {
  brokerages: Brokerage[];
  client_identities: ClientIdentity[];
  intake_sessions: IntakeSession[];
  intake_steps: IntakeStep[];
  intake_assets: IntakeAsset[];
  intake_status: IntakeStatusRecord[];
  jobs: Job[];
  job_status: Array<{ id: string; jobId: string; status: JobStatus; createdAt: string }>;
  job_outputs: JobOutput[];
  audit_log: AuditLog[];
  reports: Report[];
  magic_links: MagicLinkToken[];
  portal_auth_sessions: PortalAuthSession[];
  outbound_emails: OutboundEmail[];
  webhook_idempotency: Array<{ id: string; brokerageId: string; clientId: string; createdAt: string }>;
}
