import { INTAKE_STEP_DEFINITIONS } from "@/lib/domain/intakeConfig";
import type {
  AuditLog,
  Brokerage,
  ClientIdentity,
  IntakeAsset,
  IntakeLifecycleState,
  IntakeSession,
  IntakeStatusRecord,
  Job,
  JobOutput,
  JobStatus,
  MagicLinkToken,
  MockDatabase,
  OutboundEmail,
  PortalAuthSession,
  Report,
} from "@/lib/domain/types";
import { assertTransition } from "@/lib/domain/stateMachine";
import { createOpaqueToken, hashMagicToken } from "@/lib/security/auth";
import { newId, nowIso } from "@/lib/utils/id";

const DEFAULT_MAGIC_LINK_TTL_MINUTES = Number(process.env.MAGIC_LINK_TTL_MINUTES ?? 30);
const DEFAULT_PORTAL_SESSION_TTL_HOURS = Number(process.env.PORTAL_SESSION_TTL_HOURS ?? 24);

const initialBrokerage: Brokerage = {
  id: newId("brokerage"),
  slug: "off-market-group",
  name: "Off Market Group",
  shortName: "OffMarket",
  senderName: "Off Market Group",
  senderEmail: "clientservices@offmarketgroup.example",
  portalBaseUrl: process.env.DEFAULT_PORTAL_BASE_URL ?? "http://localhost:3000",
  driveParentFolderId: process.env.OMG_DRIVE_PARENT_FOLDER_ID,
  isArchived: false,
  branding: {
    logoUrl: "/logo.png?v=2",
    primaryColor: "#113968",
    secondaryColor: "#d4932e",
    legalFooter: "Confidential and intended only for Off Market Group clients.",
    showBeeSoldBranding: false,
    portalTone: "premium_advisory",
  },
  createdAt: nowIso(),
  updatedAt: nowIso(),
};

const seededClient: ClientIdentity = {
  id: newId("client"),
  brokerageId: initialBrokerage.id,
  businessName: "Acme Holdings",
  contactName: "Avery Owner",
  email: "owner@acme.example",
  phone: "",
  assignedOwner: "Ops Lead",
  isArchived: false,
  createdAt: nowIso(),
  updatedAt: nowIso(),
  lastActivityAt: nowIso(),
};

const seededSession: IntakeSession = {
  id: newId("session"),
  clientId: seededClient.id,
  brokerageId: initialBrokerage.id,
  status: "INVITED",
  currentStep: 1,
  totalSteps: INTAKE_STEP_DEFINITIONS.length,
  completionPct: 0,
  missingItems: [],
  createdAt: nowIso(),
  updatedAt: nowIso(),
};

const seededSteps = INTAKE_STEP_DEFINITIONS.map((step, index) => ({
  id: newId("step"),
  sessionId: seededSession.id,
  stepKey: step.key,
  title: step.title,
  order: index + 1,
  data: {},
  isComplete: false,
  updatedAt: nowIso(),
}));

function createInitialDb(): MockDatabase {
  return {
    brokerages: [initialBrokerage],
    client_identities: [seededClient],
    intake_sessions: [seededSession],
    intake_steps: seededSteps,
    intake_assets: [],
    intake_status: [
      {
        id: newId("status"),
        sessionId: seededSession.id,
        status: "INVITED",
        note: "Client created and awaiting invite send",
        createdAt: nowIso(),
      },
    ],
    jobs: [],
    job_status: [],
    job_outputs: [],
    audit_log: [],
    reports: [],
    magic_links: [],
    portal_auth_sessions: [],
    outbound_emails: [],
    webhook_idempotency: [],
  };
}

declare global {
  // eslint-disable-next-line no-var
  var __beesoldMockDb: MockDatabase | undefined;
}

const db: MockDatabase = globalThis.__beesoldMockDb ?? createInitialDb();
globalThis.__beesoldMockDb = db;

export function getDb(): MockDatabase {
  return db;
}

export function getBrokerageBySlug(slug: string): Brokerage {
  const brokerage = db.brokerages.find((item) => item.slug === slug);
  if (!brokerage) {
    throw new Error("Brokerage not found");
  }
  return brokerage;
}

export function getBrokerageById(id: string): Brokerage {
  const brokerage = db.brokerages.find((item) => item.id === id);
  if (!brokerage) {
    throw new Error("Brokerage not found");
  }
  return brokerage;
}

export function listBrokerages(includeArchived = false): Brokerage[] {
  return includeArchived ? db.brokerages : db.brokerages.filter((item) => !item.isArchived);
}

export function updateBrokerage(input: {
  brokerageId: string;
  name?: string;
  shortName?: string;
  senderName?: string;
  senderEmail?: string;
  portalBaseUrl?: string;
  driveParentFolderId?: string;
  isArchived?: boolean;
  branding?: Partial<Brokerage["branding"]>;
}): Brokerage {
  const brokerage = getBrokerageById(input.brokerageId);
  if (input.name !== undefined) brokerage.name = input.name;
  if (input.shortName !== undefined) brokerage.shortName = input.shortName;
  if (input.senderName !== undefined) brokerage.senderName = input.senderName;
  if (input.senderEmail !== undefined) brokerage.senderEmail = input.senderEmail;
  if (input.portalBaseUrl !== undefined) brokerage.portalBaseUrl = input.portalBaseUrl;
  if (input.driveParentFolderId !== undefined) brokerage.driveParentFolderId = input.driveParentFolderId;
  if (input.isArchived !== undefined) {
    brokerage.isArchived = input.isArchived;
    brokerage.archivedAt = input.isArchived ? nowIso() : undefined;
  }
  if (input.branding) {
    brokerage.branding = { ...brokerage.branding, ...input.branding };
  }
  brokerage.updatedAt = nowIso();
  return brokerage;
}

export function createBrokerage(input: {
  slug: string;
  name: string;
  shortName?: string;
  senderName: string;
  senderEmail: string;
  portalBaseUrl: string;
  driveParentFolderId?: string;
  isArchived?: boolean;
  branding?: Partial<Brokerage["branding"]>;
}): Brokerage {
  const existing = db.brokerages.find((item) => item.slug === input.slug);
  if (existing) {
    throw new Error("Brokerage slug already exists");
  }

  const created: Brokerage = {
    id: newId("brokerage"),
    slug: input.slug,
    name: input.name,
    shortName: input.shortName,
    senderName: input.senderName,
    senderEmail: input.senderEmail,
    portalBaseUrl: input.portalBaseUrl,
    driveParentFolderId: input.driveParentFolderId,
    isArchived: input.isArchived ?? false,
    archivedAt: input.isArchived ? nowIso() : undefined,
    branding: {
      logoUrl: input.branding?.logoUrl,
      primaryColor: input.branding?.primaryColor ?? "#113968",
      secondaryColor: input.branding?.secondaryColor ?? "#d4932e",
      legalFooter: input.branding?.legalFooter ?? "Confidential and intended only for authorized clients.",
      showBeeSoldBranding: input.branding?.showBeeSoldBranding ?? false,
      portalTone: input.branding?.portalTone ?? "premium_advisory",
    },
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  db.brokerages.push(created);
  return created;
}

export function getClientById(clientId: string): ClientIdentity {
  const client = db.client_identities.find((item) => item.id === clientId);
  if (!client) {
    throw new Error("Client not found");
  }
  return client;
}

export function getClientByBrokerageAndEmail(brokerageId: string, email: string): ClientIdentity | undefined {
  return db.client_identities.find(
    (item) => item.brokerageId === brokerageId && item.email.toLowerCase() === email.toLowerCase(),
  );
}

export function upsertClientIdentity(input: {
  brokerageId: string;
  businessName: string;
  contactName: string;
  email: string;
  phone?: string;
  assignedOwner?: string;
}): ClientIdentity {
  const existing = getClientByBrokerageAndEmail(input.brokerageId, input.email);
  if (existing) {
    existing.businessName = input.businessName;
    existing.contactName = input.contactName;
    existing.phone = input.phone;
    existing.assignedOwner = input.assignedOwner ?? existing.assignedOwner;
    existing.isArchived = false;
    existing.archivedAt = undefined;
    existing.updatedAt = nowIso();
    return existing;
  }

  const client: ClientIdentity = {
    id: newId("client"),
    brokerageId: input.brokerageId,
    businessName: input.businessName,
    contactName: input.contactName,
    email: input.email.toLowerCase(),
    phone: input.phone,
    assignedOwner: input.assignedOwner,
    isArchived: false,
    archivedAt: undefined,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    lastActivityAt: nowIso(),
  };

  db.client_identities.push(client);
  return client;
}

export function setClientArchived(clientId: string, isArchived: boolean): ClientIdentity {
  const client = getClientById(clientId);
  client.isArchived = isArchived;
  client.archivedAt = isArchived ? nowIso() : undefined;
  client.updatedAt = nowIso();
  return client;
}

export function getActiveSessionByClient(clientId: string): IntakeSession | undefined {
  return db.intake_sessions.find((item) => item.clientId === clientId);
}

export function createIntakeSessionForClient(clientId: string, brokerageId: string): IntakeSession {
  const existing = getActiveSessionByClient(clientId);
  if (existing) {
    return existing;
  }

  const session: IntakeSession = {
    id: newId("session"),
    clientId,
    brokerageId,
    status: "INVITED",
    currentStep: 1,
    totalSteps: INTAKE_STEP_DEFINITIONS.length,
    completionPct: 0,
    missingItems: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  db.intake_sessions.push(session);

  db.intake_steps.push(
    ...INTAKE_STEP_DEFINITIONS.map((step, index) => ({
      id: newId("step"),
      sessionId: session.id,
      stepKey: step.key,
      title: step.title,
      order: index + 1,
      data: {},
      isComplete: false,
      updatedAt: nowIso(),
    })),
  );

  db.intake_status.push({
    id: newId("status"),
    sessionId: session.id,
    status: "INVITED",
    note: "Intake session created",
    createdAt: nowIso(),
  });

  return session;
}

export function getSessionById(sessionId: string): IntakeSession {
  const session = db.intake_sessions.find((item) => item.id === sessionId);
  if (!session) {
    throw new Error("Session not found");
  }
  return session;
}

export function getStepsForSession(sessionId: string) {
  return db.intake_steps.filter((item) => item.sessionId === sessionId).sort((a, b) => a.order - b.order);
}

export function upsertStepData(
  sessionId: string,
  stepKey: string,
  data: Record<string, unknown>,
  isComplete: boolean,
): void {
  const step = db.intake_steps.find((item) => item.sessionId === sessionId && item.stepKey === stepKey);
  if (!step) {
    throw new Error("Step not found");
  }

  step.data = { ...step.data, ...data };
  step.isComplete = isComplete || step.isComplete;
  step.updatedAt = nowIso();

  const session = getSessionById(sessionId);
  const steps = getStepsForSession(sessionId);
  const completeSteps = steps.filter((item) => item.isComplete).length;
  session.completionPct = Math.round((completeSteps / Math.max(steps.length, 1)) * 100);
  session.updatedAt = nowIso();
}

export function setCurrentStep(sessionId: string, currentStep: number): void {
  const session = getSessionById(sessionId);
  session.currentStep = Math.max(1, Math.min(currentStep, session.totalSteps));
  session.updatedAt = nowIso();
}

export function touchClientActivity(clientId: string): void {
  const client = getClientById(clientId);
  client.lastActivityAt = nowIso();
  client.updatedAt = nowIso();
}

export function transitionSession(
  sessionId: string,
  next: IntakeLifecycleState,
  note: string,
  actor: AuditLog["actor"],
): IntakeSession {
  const session = getSessionById(sessionId);
  const previous = session.status;
  assertTransition(session.status, next);
  session.status = next;
  session.updatedAt = nowIso();

  if (next === "PARTIAL_SUBMITTED") {
    session.partialSubmittedAt = nowIso();
  }

  if (next === "FINAL_SUBMITTED") {
    session.finalSubmittedAt = nowIso();
  }

  db.intake_status.push({
    id: newId("status"),
    sessionId,
    status: next,
    note,
    createdAt: nowIso(),
  });

  const context = getSessionContext(sessionId);
  addAuditLog(sessionId, context.brokerageId, context.clientId, actor, "STATE_TRANSITION", {
    from: previous,
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

  const context = getSessionContext(sessionId);
  addAuditLog(sessionId, context.brokerageId, context.clientId, actor, "STATE_FORCE_SET", {
    to: next,
    note,
  });

  return session;
}

export function createMagicLink(input: {
  sessionId: string;
  clientId: string;
  brokerageId: string;
  ttlMinutes?: number;
}): { rawToken: string; record: MagicLinkToken } {
  const rawToken = createOpaqueToken(32);
  const expiresAt = new Date(Date.now() + (input.ttlMinutes ?? DEFAULT_MAGIC_LINK_TTL_MINUTES) * 60_000).toISOString();

  const record: MagicLinkToken = {
    id: newId("magic"),
    tokenHash: hashMagicToken(rawToken),
    sessionId: input.sessionId,
    clientId: input.clientId,
    brokerageId: input.brokerageId,
    expiresAt,
    createdAt: nowIso(),
  };

  db.magic_links.push(record);
  return { rawToken, record };
}

export function consumeMagicLink(rawToken: string): MagicLinkToken {
  const tokenHash = hashMagicToken(rawToken);
  const record = db.magic_links.find((item) => item.tokenHash === tokenHash);
  if (!record) {
    throw new Error("Magic link is invalid");
  }
  if (record.usedAt) {
    throw new Error("Magic link already used");
  }
  if (new Date(record.expiresAt).getTime() < Date.now()) {
    throw new Error("Magic link expired");
  }

  record.usedAt = nowIso();
  return record;
}

export function createPortalAuthSession(input: {
  sessionId: string;
  clientId: string;
  brokerageId: string;
  ttlHours?: number;
}): PortalAuthSession {
  const session: PortalAuthSession = {
    id: newId("portal_auth"),
    sessionId: input.sessionId,
    clientId: input.clientId,
    brokerageId: input.brokerageId,
    expiresAt: new Date(Date.now() + (input.ttlHours ?? DEFAULT_PORTAL_SESSION_TTL_HOURS) * 60 * 60_000).toISOString(),
    createdAt: nowIso(),
  };

  db.portal_auth_sessions.push(session);
  return session;
}

export function getPortalAuthSessionById(authSessionId: string): PortalAuthSession | undefined {
  return db.portal_auth_sessions.find((item) => item.id === authSessionId);
}

export function revokePortalAuthSession(authSessionId: string): void {
  const index = db.portal_auth_sessions.findIndex((item) => item.id === authSessionId);
  if (index >= 0) {
    db.portal_auth_sessions.splice(index, 1);
  }
}

export function setClientPassword(clientId: string, passwordSalt: string, passwordHash: string): void {
  const client = getClientById(clientId);
  client.passwordSalt = passwordSalt;
  client.passwordHash = passwordHash;
  client.updatedAt = nowIso();
}

export function setSessionInviteSent(sessionId: string): void {
  const session = getSessionById(sessionId);
  session.inviteSentAt = nowIso();
  session.updatedAt = nowIso();
}

export function setSessionLastAccess(sessionId: string): void {
  const session = getSessionById(sessionId);
  session.lastPortalAccessAt = nowIso();
  session.updatedAt = nowIso();
}

export function setSessionDriveFolder(sessionId: string, folderId: string, folderUrl: string): void {
  const session = getSessionById(sessionId);
  session.driveFolderId = folderId;
  session.driveFolderUrl = folderUrl;
  session.updatedAt = nowIso();
}

export function setMissingItems(sessionId: string, missingItems: string[]): void {
  const session = getSessionById(sessionId);
  session.missingItems = missingItems;
  session.updatedAt = nowIso();
}

export function addIntakeAsset(input: Omit<IntakeAsset, "id" | "uploadedAt" | "revision">): IntakeAsset {
  const existingCount = db.intake_assets.filter(
    (asset) =>
      asset.sessionId === input.sessionId && asset.category === input.category && asset.fileName === input.fileName,
  ).length;

  const asset: IntakeAsset = {
    id: newId("asset"),
    ...input,
    revision: existingCount + 1,
    uploadedAt: nowIso(),
  };

  db.intake_assets.push(asset);
  return asset;
}

export function addOutboundEmail(input: Omit<OutboundEmail, "id" | "createdAt">): OutboundEmail {
  const email: OutboundEmail = {
    id: newId("email"),
    ...input,
    createdAt: nowIso(),
  };
  db.outbound_emails.push(email);
  return email;
}

export function updateOutboundEmailDelivery(
  emailId: string,
  input: { providerStatus: string; providerMessageId?: string },
): OutboundEmail {
  const email = db.outbound_emails.find((item) => item.id === emailId);
  if (!email) {
    throw new Error("Outbound email not found");
  }
  email.providerStatus = input.providerStatus;
  email.providerMessageId = input.providerMessageId;
  return email;
}

export function addWebhookIdempotency(id: string, brokerageId: string, clientId: string): void {
  if (db.webhook_idempotency.some((item) => item.id === id && item.brokerageId === brokerageId)) {
    return;
  }

  db.webhook_idempotency.push({ id, brokerageId, clientId, createdAt: nowIso() });
}

export function findWebhookIdempotency(id: string, brokerageId: string): { id: string; brokerageId: string; clientId: string; createdAt: string } | undefined {
  return db.webhook_idempotency.find((item) => item.id === id && item.brokerageId === brokerageId);
}

export function getSessionContext(sessionId: string): { session: IntakeSession; client: ClientIdentity; brokerage: Brokerage; clientId: string; brokerageId: string } {
  const session = getSessionById(sessionId);
  const client = getClientById(session.clientId);
  const brokerage = getBrokerageById(session.brokerageId);

  return {
    session,
    client,
    brokerage,
    clientId: client.id,
    brokerageId: brokerage.id,
  };
}

export function addAuditLog(
  sessionId: string,
  brokerageId: string,
  clientId: string,
  actor: AuditLog["actor"],
  action: string,
  details: Record<string, unknown>,
): AuditLog {
  const log: AuditLog = {
    id: newId("audit"),
    sessionId,
    brokerageId,
    clientId,
    actor,
    action,
    details,
    createdAt: nowIso(),
  };

  db.audit_log.push(log);
  return log;
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
  pushJobStatus(job.id, status);
}

function pushJobStatus(jobId: string, status: JobStatus): void {
  db.job_status.push({ id: newId("job_status"), jobId, status, createdAt: nowIso() });
}

export function addJobOutput(jobId: string, outputType: string, payload: Record<string, unknown>): JobOutput {
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

  const created: Report = {
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
  db.reports.push(created);
  return created;
}

export function getReportBySessionId(sessionId: string): Report | undefined {
  return db.reports.find((item) => item.sessionId === sessionId);
}

export function getAuditForSession(sessionId: string): AuditLog[] {
  return db.audit_log
    .filter((item) => item.sessionId === sessionId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}
