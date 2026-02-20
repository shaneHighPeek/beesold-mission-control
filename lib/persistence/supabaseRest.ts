import { INTAKE_STEP_DEFINITIONS } from "@/lib/domain/intakeConfig";
import { assertTransition } from "@/lib/domain/stateMachine";
import type {
  AuditLog,
  Brokerage,
  ClientIdentity,
  IntakeAsset,
  IntakeLifecycleState,
  IntakeSession,
  IntakeStep,
  Job,
  JobStatus,
  MagicLinkToken,
  OutboundEmail,
  PortalAuthSession,
  Report,
} from "@/lib/domain/types";
import { createOpaqueToken, hashMagicToken } from "@/lib/security/auth";

type SupabaseHeaders = {
  apikey: string;
  Authorization: string;
  "Content-Type": string;
};

type BrokerageRow = {
  id: string;
  slug: string;
  name: string;
  short_name: string | null;
  sender_name: string;
  sender_email: string;
  portal_base_url: string;
  drive_parent_folder_id: string | null;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  legal_footer: string;
  show_beesold_branding: boolean;
  portal_tone: "corporate" | "premium_advisory";
  is_archived?: boolean | null;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
};

type ClientRow = {
  id: string;
  brokerage_id: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  assigned_owner: string | null;
  password_salt: string | null;
  password_hash: string | null;
  is_archived?: boolean | null;
  archived_at?: string | null;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
};

type IntakeSessionRow = {
  id: string;
  client_id: string;
  brokerage_id: string;
  status: IntakeLifecycleState;
  current_step: number;
  total_steps: number;
  completion_pct: number;
  partial_submitted_at: string | null;
  final_submitted_at: string | null;
  invite_sent_at: string | null;
  last_portal_access_at: string | null;
  drive_folder_id: string | null;
  drive_folder_url: string | null;
  missing_items: unknown;
  created_at: string;
  updated_at: string;
};

type IntakeStepRow = {
  id: string;
  session_id: string;
  step_key: string;
  title: string;
  step_order: number;
  data: Record<string, unknown>;
  is_complete: boolean;
  updated_at: string;
};

type AuditRow = {
  id: string;
  session_id: string;
  brokerage_id: string;
  client_id: string;
  actor: AuditLog["actor"];
  action: string;
  details: Record<string, unknown>;
  created_at: string;
};

type MagicLinkRow = {
  id: string;
  token_hash: string;
  session_id: string;
  client_id: string;
  brokerage_id: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
};

type PortalAuthSessionRow = {
  id: string;
  session_id: string;
  client_id: string;
  brokerage_id: string;
  expires_at: string;
  created_at: string;
};

type OutboundEmailRow = {
  id: string;
  brokerage_id: string;
  session_id: string;
  recipient: string;
  from_name: string;
  from_email: string;
  subject: string;
  html_body: string;
  provider_message_id: string | null;
  provider_status: string | null;
  created_at: string;
};

type IntakeAssetRow = {
  id: string;
  session_id: string;
  brokerage_id: string;
  client_id: string;
  category: IntakeAsset["category"];
  file_name: string;
  mime_type: string;
  size_bytes: number;
  revision: number;
  drive_file_id: string | null;
  drive_file_url: string | null;
  uploaded_at: string;
};

type JobRow = {
  id: string;
  session_id: string;
  kind: Job["kind"];
  status: JobStatus;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

type ReportRow = {
  id: string;
  session_id: string;
  title: string;
  summary: string;
  findings: unknown;
  recommendations: unknown;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

function getSupabaseConfig(): { baseUrl: string; key: string } {
  const baseUrl = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_ANON_KEY;

  if (!baseUrl || !key) {
    throw new Error("Supabase config missing. Set SUPABASE_URL and a Supabase API key.");
  }

  return { baseUrl, key };
}

function buildHeaders(key: string): SupabaseHeaders {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { baseUrl, key } = getSupabaseConfig();
  const headers = buildHeaders(key);
  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase REST error (${response.status}): ${text}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text.trim()) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

function mapBrokerage(row: BrokerageRow): Brokerage {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortName: row.short_name ?? undefined,
    senderName: row.sender_name,
    senderEmail: row.sender_email,
    portalBaseUrl: row.portal_base_url,
    driveParentFolderId: row.drive_parent_folder_id ?? undefined,
    isArchived: row.is_archived ?? false,
    archivedAt: row.archived_at ?? undefined,
    branding: {
      logoUrl: row.logo_url ?? undefined,
      primaryColor: row.primary_color,
      secondaryColor: row.secondary_color,
      legalFooter: row.legal_footer,
      showBeeSoldBranding: row.show_beesold_branding,
      portalTone: row.portal_tone,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapClient(row: ClientRow): ClientIdentity {
  return {
    id: row.id,
    brokerageId: row.brokerage_id,
    businessName: row.business_name,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone ?? undefined,
    assignedOwner: row.assigned_owner ?? undefined,
    passwordSalt: row.password_salt ?? undefined,
    passwordHash: row.password_hash ?? undefined,
    isArchived: row.is_archived ?? false,
    archivedAt: row.archived_at ?? undefined,
    lastActivityAt: row.last_activity_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSession(row: IntakeSessionRow): IntakeSession {
  return {
    id: row.id,
    clientId: row.client_id,
    brokerageId: row.brokerage_id,
    status: row.status,
    currentStep: row.current_step,
    totalSteps: row.total_steps,
    completionPct: row.completion_pct,
    partialSubmittedAt: row.partial_submitted_at ?? undefined,
    finalSubmittedAt: row.final_submitted_at ?? undefined,
    inviteSentAt: row.invite_sent_at ?? undefined,
    lastPortalAccessAt: row.last_portal_access_at ?? undefined,
    driveFolderId: row.drive_folder_id ?? undefined,
    driveFolderUrl: row.drive_folder_url ?? undefined,
    missingItems: Array.isArray(row.missing_items) ? (row.missing_items as string[]) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapStep(row: IntakeStepRow): IntakeStep {
  return {
    id: row.id,
    sessionId: row.session_id,
    stepKey: row.step_key,
    title: row.title,
    order: row.step_order,
    data: row.data ?? {},
    isComplete: row.is_complete,
    updatedAt: row.updated_at,
  };
}

function mapAudit(row: AuditRow): AuditLog {
  return {
    id: row.id,
    sessionId: row.session_id,
    brokerageId: row.brokerage_id,
    clientId: row.client_id,
    actor: row.actor,
    action: row.action,
    details: row.details ?? {},
    createdAt: row.created_at,
  };
}

function mapMagicLink(row: MagicLinkRow): MagicLinkToken {
  return {
    id: row.id,
    tokenHash: row.token_hash,
    sessionId: row.session_id,
    clientId: row.client_id,
    brokerageId: row.brokerage_id,
    expiresAt: row.expires_at,
    usedAt: row.used_at ?? undefined,
    createdAt: row.created_at,
  };
}

function mapPortalAuthSession(row: PortalAuthSessionRow): PortalAuthSession {
  return {
    id: row.id,
    sessionId: row.session_id,
    clientId: row.client_id,
    brokerageId: row.brokerage_id,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

function mapOutboundEmail(row: OutboundEmailRow): OutboundEmail {
  return {
    id: row.id,
    brokerageId: row.brokerage_id,
    sessionId: row.session_id,
    to: row.recipient,
    fromName: row.from_name,
    fromEmail: row.from_email,
    subject: row.subject,
    html: row.html_body,
    providerMessageId: row.provider_message_id ?? undefined,
    providerStatus: row.provider_status ?? undefined,
    createdAt: row.created_at,
  };
}

function mapAsset(row: IntakeAssetRow): IntakeAsset {
  return {
    id: row.id,
    sessionId: row.session_id,
    brokerageId: row.brokerage_id,
    clientId: row.client_id,
    category: row.category,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    revision: row.revision,
    driveFileId: row.drive_file_id ?? undefined,
    driveFileUrl: row.drive_file_url ?? undefined,
    uploadedAt: row.uploaded_at,
  };
}

function mapReport(row: ReportRow): Report {
  return {
    id: row.id,
    sessionId: row.session_id,
    title: row.title,
    summary: row.summary,
    findings: Array.isArray(row.findings) ? (row.findings as string[]) : [],
    recommendations: Array.isArray(row.recommendations) ? (row.recommendations as string[]) : [],
    approvedAt: row.approved_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listBrokeragesFromSupabase(includeArchived = false): Promise<Brokerage[]> {
  const rows = await request<BrokerageRow[]>("brokerages?select=*&order=created_at.asc", { method: "GET" });
  const items = rows.map(mapBrokerage);
  return includeArchived ? items : items.filter((item) => !item.isArchived);
}

export async function getBrokerageBySlugFromSupabase(slug: string): Promise<Brokerage | null> {
  const rows = await request<BrokerageRow[]>(
    `brokerages?select=*&slug=eq.${encodeURIComponent(slug)}&limit=1`,
    { method: "GET" },
  );
  return rows.length > 0 ? mapBrokerage(rows[0]) : null;
}

export async function updateBrokerageInSupabase(input: {
  brokerageId: string;
  name?: string;
  shortName?: string;
  senderName?: string;
  senderEmail?: string;
  portalBaseUrl?: string;
  driveParentFolderId?: string;
  isArchived?: boolean;
  branding?: {
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    legalFooter?: string;
    showBeeSoldBranding?: boolean;
    portalTone?: "corporate" | "premium_advisory";
  };
}): Promise<Brokerage> {
  const patch: Record<string, unknown> = {};

  if (input.name !== undefined) patch.name = input.name;
  if (input.shortName !== undefined) patch.short_name = input.shortName || null;
  if (input.senderName !== undefined) patch.sender_name = input.senderName;
  if (input.senderEmail !== undefined) patch.sender_email = input.senderEmail;
  if (input.portalBaseUrl !== undefined) patch.portal_base_url = input.portalBaseUrl;
  if (input.driveParentFolderId !== undefined) patch.drive_parent_folder_id = input.driveParentFolderId || null;
  if (input.isArchived !== undefined) {
    patch.is_archived = input.isArchived;
    patch.archived_at = input.isArchived ? new Date().toISOString() : null;
  }

  if (input.branding) {
    if (input.branding.logoUrl !== undefined) patch.logo_url = input.branding.logoUrl || null;
    if (input.branding.primaryColor !== undefined) patch.primary_color = input.branding.primaryColor;
    if (input.branding.secondaryColor !== undefined) patch.secondary_color = input.branding.secondaryColor;
    if (input.branding.legalFooter !== undefined) patch.legal_footer = input.branding.legalFooter;
    if (input.branding.showBeeSoldBranding !== undefined) {
      patch.show_beesold_branding = input.branding.showBeeSoldBranding;
    }
    if (input.branding.portalTone !== undefined) patch.portal_tone = input.branding.portalTone;
  }

  patch.updated_at = new Date().toISOString();

  const rows = await request<BrokerageRow[]>(
    `brokerages?id=eq.${encodeURIComponent(input.brokerageId)}&select=*`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify(patch),
    },
  );

  if (rows.length === 0) {
    throw new Error("Brokerage not found");
  }

  return mapBrokerage(rows[0]);
}

export async function createBrokerageInSupabase(input: {
  slug: string;
  name: string;
  shortName?: string;
  senderName: string;
  senderEmail: string;
  portalBaseUrl: string;
  driveParentFolderId?: string;
  isArchived?: boolean;
  branding?: {
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    legalFooter?: string;
    showBeeSoldBranding?: boolean;
    portalTone?: "corporate" | "premium_advisory";
  };
}): Promise<Brokerage> {
  const rows = await request<BrokerageRow[]>("brokerages?select=*", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      slug: input.slug,
      name: input.name,
      short_name: input.shortName ?? null,
      sender_name: input.senderName,
      sender_email: input.senderEmail,
      portal_base_url: input.portalBaseUrl,
      drive_parent_folder_id: input.driveParentFolderId ?? null,
      is_archived: input.isArchived ?? false,
      archived_at: input.isArchived ? new Date().toISOString() : null,
      logo_url: input.branding?.logoUrl ?? null,
      primary_color: input.branding?.primaryColor ?? "#113968",
      secondary_color: input.branding?.secondaryColor ?? "#d4932e",
      legal_footer: input.branding?.legalFooter ?? "Confidential and intended only for authorized clients.",
      show_beesold_branding: input.branding?.showBeeSoldBranding ?? false,
      portal_tone: input.branding?.portalTone ?? "premium_advisory",
    }),
  });

  if (rows.length === 0) {
    throw new Error("Unable to create brokerage");
  }

  return mapBrokerage(rows[0]);
}

export async function checkSupabaseConnectivity(): Promise<{
  ok: boolean;
  brokerageCount: number;
}> {
  const rows = await request<Array<{ id: string }>>("brokerages?select=id", { method: "GET" });

  return {
    ok: true,
    brokerageCount: rows.length,
  };
}

export async function getBrokerageByIdFromSupabase(id: string): Promise<Brokerage | null> {
  const rows = await request<BrokerageRow[]>(
    `brokerages?select=*&id=eq.${encodeURIComponent(id)}&limit=1`,
    { method: "GET" },
  );
  return rows.length > 0 ? mapBrokerage(rows[0]) : null;
}

export async function getClientByIdFromSupabase(clientId: string): Promise<ClientIdentity | null> {
  const rows = await request<ClientRow[]>(
    `client_identities?select=*&id=eq.${encodeURIComponent(clientId)}&limit=1`,
    { method: "GET" },
  );
  return rows.length > 0 ? mapClient(rows[0]) : null;
}

export async function getClientByBrokerageAndEmailFromSupabase(
  brokerageId: string,
  email: string,
): Promise<ClientIdentity | null> {
  const rows = await request<ClientRow[]>(
    `client_identities?select=*&brokerage_id=eq.${encodeURIComponent(brokerageId)}&email=eq.${encodeURIComponent(email.toLowerCase())}&limit=1`,
    { method: "GET" },
  );
  return rows.length > 0 ? mapClient(rows[0]) : null;
}

export async function upsertClientIdentityInSupabase(input: {
  brokerageId: string;
  businessName: string;
  contactName: string;
  email: string;
  phone?: string;
  assignedOwner?: string;
}): Promise<ClientIdentity> {
  const existing = await getClientByBrokerageAndEmailFromSupabase(input.brokerageId, input.email);
  if (existing) {
    const rows = await request<ClientRow[]>(
      `client_identities?id=eq.${encodeURIComponent(existing.id)}&select=*`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          business_name: input.businessName,
          contact_name: input.contactName,
          phone: input.phone ?? null,
          assigned_owner: input.assignedOwner ?? existing.assignedOwner ?? null,
          is_archived: false,
          archived_at: null,
          updated_at: new Date().toISOString(),
        }),
      },
    );
    return mapClient(rows[0]);
  }

  const created = await request<ClientRow[]>("client_identities?select=*", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      brokerage_id: input.brokerageId,
      business_name: input.businessName,
      contact_name: input.contactName,
      email: input.email.toLowerCase(),
      phone: input.phone ?? null,
      assigned_owner: input.assignedOwner ?? null,
      is_archived: false,
      archived_at: null,
      last_activity_at: new Date().toISOString(),
    }),
  });

  return mapClient(created[0]);
}

export async function setClientArchivedInSupabase(clientId: string, isArchived: boolean): Promise<ClientIdentity> {
  const rows = await request<ClientRow[]>(
    `client_identities?id=eq.${encodeURIComponent(clientId)}&select=*`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        is_archived: isArchived,
        archived_at: isArchived ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }),
    },
  );
  return mapClient(rows[0]);
}

export async function getSessionByIdFromSupabase(sessionId: string): Promise<IntakeSession | null> {
  const rows = await request<IntakeSessionRow[]>(
    `intake_sessions?select=*&id=eq.${encodeURIComponent(sessionId)}&limit=1`,
    { method: "GET" },
  );
  return rows.length > 0 ? mapSession(rows[0]) : null;
}

export async function getActiveSessionByClientFromSupabase(clientId: string): Promise<IntakeSession | null> {
  const rows = await request<IntakeSessionRow[]>(
    `intake_sessions?select=*&client_id=eq.${encodeURIComponent(clientId)}&order=created_at.desc&limit=1`,
    { method: "GET" },
  );
  return rows.length > 0 ? mapSession(rows[0]) : null;
}

export async function createIntakeSessionForClientInSupabase(
  clientId: string,
  brokerageId: string,
): Promise<IntakeSession> {
  const existing = await getActiveSessionByClientFromSupabase(clientId);
  if (existing) return existing;

  const created = await request<IntakeSessionRow[]>("intake_sessions?select=*", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      client_id: clientId,
      brokerage_id: brokerageId,
      status: "INVITED",
      current_step: 1,
      total_steps: INTAKE_STEP_DEFINITIONS.length,
      completion_pct: 0,
      missing_items: [],
    }),
  });
  const session = mapSession(created[0]);

  await request<IntakeStepRow[]>("intake_steps?select=id", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(
      INTAKE_STEP_DEFINITIONS.map((step, index) => ({
        session_id: session.id,
        step_key: step.key,
        title: step.title,
        step_order: index + 1,
        data: {},
        is_complete: false,
      })),
    ),
  });

  await request(
    "intake_status",
    {
      method: "POST",
      body: JSON.stringify({
        session_id: session.id,
        status: "INVITED",
        note: "Intake session created",
      }),
    },
  );

  return session;
}

export async function getStepsForSessionFromSupabase(sessionId: string): Promise<IntakeStep[]> {
  const rows = await request<IntakeStepRow[]>(
    `intake_steps?select=*&session_id=eq.${encodeURIComponent(sessionId)}&order=step_order.asc`,
    { method: "GET" },
  );
  return rows.map(mapStep);
}

export async function upsertStepDataInSupabase(
  sessionId: string,
  stepKey: string,
  data: Record<string, unknown>,
  isComplete: boolean,
): Promise<void> {
  const rows = await request<IntakeStepRow[]>(
    `intake_steps?select=*&session_id=eq.${encodeURIComponent(sessionId)}&step_key=eq.${encodeURIComponent(stepKey)}&limit=1`,
    { method: "GET" },
  );
  if (rows.length === 0) throw new Error("Step not found");
  const step = rows[0];

  await request(
    `intake_steps?id=eq.${encodeURIComponent(step.id)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        data: { ...(step.data ?? {}), ...data },
        is_complete: isComplete || step.is_complete,
        updated_at: new Date().toISOString(),
      }),
    },
  );

  const steps = await getStepsForSessionFromSupabase(sessionId);
  const complete = steps.filter((item) => item.isComplete).length;
  const pct = Math.round((complete / Math.max(steps.length, 1)) * 100);
  await request(`intake_sessions?id=eq.${encodeURIComponent(sessionId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      completion_pct: pct,
      updated_at: new Date().toISOString(),
    }),
  });
}

export async function setCurrentStepInSupabase(sessionId: string, currentStep: number): Promise<void> {
  const session = await getSessionByIdFromSupabase(sessionId);
  if (!session) throw new Error("Session not found");
  await request(`intake_sessions?id=eq.${encodeURIComponent(sessionId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      current_step: Math.max(1, Math.min(currentStep, session.totalSteps)),
      updated_at: new Date().toISOString(),
    }),
  });
}

export async function setSessionInviteSentInSupabase(sessionId: string): Promise<void> {
  await request(`intake_sessions?id=eq.${encodeURIComponent(sessionId)}`, {
    method: "PATCH",
    body: JSON.stringify({ invite_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
  });
}

export async function setSessionLastAccessInSupabase(sessionId: string): Promise<void> {
  await request(`intake_sessions?id=eq.${encodeURIComponent(sessionId)}`, {
    method: "PATCH",
    body: JSON.stringify({ last_portal_access_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
  });
}

export async function setSessionDriveFolderInSupabase(sessionId: string, folderId: string, folderUrl: string): Promise<void> {
  await request(`intake_sessions?id=eq.${encodeURIComponent(sessionId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      drive_folder_id: folderId,
      drive_folder_url: folderUrl,
      updated_at: new Date().toISOString(),
    }),
  });
}

export async function setMissingItemsInSupabase(sessionId: string, missingItems: string[]): Promise<void> {
  await request(`intake_sessions?id=eq.${encodeURIComponent(sessionId)}`, {
    method: "PATCH",
    body: JSON.stringify({ missing_items: missingItems, updated_at: new Date().toISOString() }),
  });
}

export async function touchClientActivityInSupabase(clientId: string): Promise<void> {
  await request(`client_identities?id=eq.${encodeURIComponent(clientId)}`, {
    method: "PATCH",
    body: JSON.stringify({ last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
  });
}

export async function addAuditLogInSupabase(
  sessionId: string,
  brokerageId: string,
  clientId: string,
  actor: AuditLog["actor"],
  action: string,
  details: Record<string, unknown>,
): Promise<AuditLog> {
  const rows = await request<AuditRow[]>("audit_log?select=*", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      session_id: sessionId,
      brokerage_id: brokerageId,
      client_id: clientId,
      actor,
      action,
      details,
    }),
  });
  return mapAudit(rows[0]);
}

export async function getAuditForSessionFromSupabase(sessionId: string): Promise<AuditLog[]> {
  const rows = await request<AuditRow[]>(
    `audit_log?select=*&session_id=eq.${encodeURIComponent(sessionId)}&order=created_at.asc`,
    { method: "GET" },
  );
  return rows.map(mapAudit);
}

export async function addOutboundEmailInSupabase(input: {
  brokerageId: string;
  sessionId: string;
  to: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  html: string;
  providerMessageId?: string;
  providerStatus?: string;
}): Promise<OutboundEmail> {
  const rows = await request<OutboundEmailRow[]>("outbound_emails?select=*", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      brokerage_id: input.brokerageId,
      session_id: input.sessionId,
      recipient: input.to,
      from_name: input.fromName,
      from_email: input.fromEmail,
      subject: input.subject,
      html_body: input.html,
      provider_message_id: input.providerMessageId ?? null,
      provider_status: input.providerStatus ?? null,
    }),
  });
  return mapOutboundEmail(rows[0]);
}

export async function updateOutboundEmailDeliveryInSupabase(
  emailId: string,
  input: { providerStatus: string; providerMessageId?: string },
): Promise<OutboundEmail> {
  const rows = await request<OutboundEmailRow[]>(
    `outbound_emails?id=eq.${encodeURIComponent(emailId)}&select=*`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        provider_status: input.providerStatus,
        provider_message_id: input.providerMessageId ?? null,
      }),
    },
  );
  return mapOutboundEmail(rows[0]);
}

export async function listOutboundEmailsFromSupabase(): Promise<OutboundEmail[]> {
  const rows = await request<OutboundEmailRow[]>("outbound_emails?select=*&order=created_at.desc", { method: "GET" });
  return rows.map(mapOutboundEmail);
}

export async function findWebhookIdempotencyFromSupabase(id: string, brokerageId: string): Promise<{
  id: string;
  brokerageId: string;
  clientId: string;
  createdAt: string;
} | null> {
  const rows = await request<Array<{ id: string; brokerage_id: string; client_id: string; created_at: string }>>(
    `webhook_idempotency?select=*&id=eq.${encodeURIComponent(id)}&brokerage_id=eq.${encodeURIComponent(brokerageId)}&limit=1`,
    { method: "GET" },
  );
  if (rows.length === 0) return null;
  return {
    id: rows[0].id,
    brokerageId: rows[0].brokerage_id,
    clientId: rows[0].client_id,
    createdAt: rows[0].created_at,
  };
}

export async function addWebhookIdempotencyInSupabase(id: string, brokerageId: string, clientId: string): Promise<void> {
  await request("webhook_idempotency", {
    method: "POST",
    body: JSON.stringify({ id, brokerage_id: brokerageId, client_id: clientId }),
  });
}

export async function createMagicLinkInSupabase(input: {
  sessionId: string;
  clientId: string;
  brokerageId: string;
  ttlMinutes?: number;
}): Promise<{ rawToken: string; record: MagicLinkToken }> {
  const rawToken = createOpaqueToken(32);
  const ttl = input.ttlMinutes ?? Number(process.env.MAGIC_LINK_TTL_MINUTES ?? 30);
  const expiresAt = new Date(Date.now() + ttl * 60_000).toISOString();

  const rows = await request<MagicLinkRow[]>("magic_links?select=*", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      token_hash: hashMagicToken(rawToken),
      session_id: input.sessionId,
      client_id: input.clientId,
      brokerage_id: input.brokerageId,
      expires_at: expiresAt,
    }),
  });

  return { rawToken, record: mapMagicLink(rows[0]) };
}

export async function consumeMagicLinkFromSupabase(rawToken: string): Promise<MagicLinkToken> {
  const tokenHash = hashMagicToken(rawToken);
  const rows = await request<MagicLinkRow[]>(
    `magic_links?select=*&token_hash=eq.${encodeURIComponent(tokenHash)}&limit=1`,
    { method: "GET" },
  );
  if (rows.length === 0) throw new Error("Magic link is invalid");
  const found = rows[0];
  if (found.used_at) throw new Error("Magic link already used");
  if (new Date(found.expires_at).getTime() < Date.now()) throw new Error("Magic link expired");

  const updatedRows = await request<MagicLinkRow[]>(
    `magic_links?id=eq.${encodeURIComponent(found.id)}&select=*`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ used_at: new Date().toISOString() }),
    },
  );

  return mapMagicLink(updatedRows[0]);
}

export async function createPortalAuthSessionInSupabase(input: {
  sessionId: string;
  clientId: string;
  brokerageId: string;
  ttlHours?: number;
}): Promise<PortalAuthSession> {
  const ttl = input.ttlHours ?? Number(process.env.PORTAL_SESSION_TTL_HOURS ?? 24);
  const expiresAt = new Date(Date.now() + ttl * 60 * 60_000).toISOString();
  const rows = await request<PortalAuthSessionRow[]>("portal_auth_sessions?select=*", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      session_id: input.sessionId,
      client_id: input.clientId,
      brokerage_id: input.brokerageId,
      expires_at: expiresAt,
    }),
  });
  return mapPortalAuthSession(rows[0]);
}

export async function getPortalAuthSessionByIdFromSupabase(authSessionId: string): Promise<PortalAuthSession | null> {
  const rows = await request<PortalAuthSessionRow[]>(
    `portal_auth_sessions?select=*&id=eq.${encodeURIComponent(authSessionId)}&limit=1`,
    { method: "GET" },
  );
  return rows.length > 0 ? mapPortalAuthSession(rows[0]) : null;
}

export async function setClientPasswordInSupabase(
  clientId: string,
  passwordSalt: string,
  passwordHash: string,
): Promise<void> {
  await request(`client_identities?id=eq.${encodeURIComponent(clientId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      password_salt: passwordSalt,
      password_hash: passwordHash,
      updated_at: new Date().toISOString(),
    }),
  });
}

export async function transitionSessionInSupabase(
  sessionId: string,
  next: IntakeLifecycleState,
  note: string,
  actor: AuditLog["actor"],
): Promise<IntakeSession> {
  const existing = await getSessionByIdFromSupabase(sessionId);
  if (!existing) throw new Error("Session not found");
  assertTransition(existing.status, next);
  const patch: Record<string, unknown> = { status: next, updated_at: new Date().toISOString() };
  if (next === "PARTIAL_SUBMITTED") patch.partial_submitted_at = new Date().toISOString();
  if (next === "FINAL_SUBMITTED") patch.final_submitted_at = new Date().toISOString();

  const rows = await request<IntakeSessionRow[]>(
    `intake_sessions?id=eq.${encodeURIComponent(sessionId)}&select=*`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(patch),
    },
  );
  await request("intake_status", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, status: next, note }),
  });
  await addAuditLogInSupabase(sessionId, existing.brokerageId, existing.clientId, actor, "STATE_TRANSITION", {
    from: existing.status,
    to: next,
    note,
  });
  return mapSession(rows[0]);
}

export async function forceStatusInSupabase(
  sessionId: string,
  next: IntakeLifecycleState,
  note: string,
  actor: AuditLog["actor"],
): Promise<IntakeSession> {
  const existing = await getSessionByIdFromSupabase(sessionId);
  if (!existing) throw new Error("Session not found");
  const rows = await request<IntakeSessionRow[]>(
    `intake_sessions?id=eq.${encodeURIComponent(sessionId)}&select=*`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ status: next, updated_at: new Date().toISOString() }),
    },
  );
  await request("intake_status", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, status: next, note }),
  });
  await addAuditLogInSupabase(sessionId, existing.brokerageId, existing.clientId, actor, "STATE_FORCE_SET", {
    to: next,
    note,
  });
  return mapSession(rows[0]);
}

export async function addIntakeAssetInSupabase(input: {
  sessionId: string;
  brokerageId: string;
  clientId: string;
  category: IntakeAsset["category"];
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<IntakeAsset> {
  const existingRows = await request<IntakeAssetRow[]>(
    `intake_assets?select=id&session_id=eq.${encodeURIComponent(input.sessionId)}&category=eq.${encodeURIComponent(input.category)}&file_name=eq.${encodeURIComponent(input.fileName)}`,
    { method: "GET" },
  );
  const revision = existingRows.length + 1;
  const rows = await request<IntakeAssetRow[]>("intake_assets?select=*", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      session_id: input.sessionId,
      brokerage_id: input.brokerageId,
      client_id: input.clientId,
      category: input.category,
      file_name: input.fileName,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      revision,
    }),
  });
  return mapAsset(rows[0]);
}

export async function updateIntakeAssetDriveInSupabase(
  assetId: string,
  driveFileId: string,
  driveFileUrl: string,
): Promise<void> {
  await request(`intake_assets?id=eq.${encodeURIComponent(assetId)}`, {
    method: "PATCH",
    body: JSON.stringify({ drive_file_id: driveFileId, drive_file_url: driveFileUrl }),
  });
}

export async function listIntakeAssetsForSessionFromSupabase(sessionId: string): Promise<IntakeAsset[]> {
  const rows = await request<IntakeAssetRow[]>(
    `intake_assets?select=*&session_id=eq.${encodeURIComponent(sessionId)}&order=uploaded_at.asc`,
    { method: "GET" },
  );
  return rows.map(mapAsset);
}

export async function listMissionControlIntakesFromSupabase(options?: { includeArchived?: boolean }): Promise<
  Array<{
    id: string;
    brokerage: { id: string; slug: string; name: string; isArchived?: boolean };
    client: {
      id: string;
      businessName: string;
      contactName: string;
      email: string;
      phone?: string;
      assignedOwner?: string;
      isArchived?: boolean;
    };
    status: IntakeLifecycleState;
    completionPct: number;
    currentStep: number;
    totalSteps: number;
    stepsCompleted: number;
    invitedAt?: string;
    partialSubmittedAt?: string;
    finalSubmittedAt?: string;
    lastActivityAt: string;
    missingItems: string[];
    driveFolderUrl?: string;
    report?: unknown;
    jobs: unknown[];
  }>
> {
  const includeArchived = options?.includeArchived ?? false;
  const [sessions, clients, brokerages, steps, reports, jobs] = await Promise.all([
    request<IntakeSessionRow[]>("intake_sessions?select=*", { method: "GET" }),
    request<ClientRow[]>("client_identities?select=*", { method: "GET" }),
    request<BrokerageRow[]>("brokerages?select=*", { method: "GET" }),
    request<IntakeStepRow[]>("intake_steps?select=session_id,is_complete", { method: "GET" }),
    request<ReportRow[]>("reports?select=*", { method: "GET" }),
    request<JobRow[]>("jobs?select=*", { method: "GET" }),
  ]);

  const clientMap = new Map(clients.map((row) => [row.id, mapClient(row)]));
  const brokerageMap = new Map(brokerages.map((row) => [row.id, mapBrokerage(row)]));
  const stepCounts = new Map<string, number>();
  steps.forEach((row) => {
    if (!row.is_complete) return;
    stepCounts.set(row.session_id, (stepCounts.get(row.session_id) ?? 0) + 1);
  });
  const reportMap = new Map(reports.map((row) => [row.session_id, mapReport(row)]));
  const jobsMap = new Map<string, JobRow[]>();
  jobs.forEach((row) => {
    const list = jobsMap.get(row.session_id) ?? [];
    list.push(row);
    jobsMap.set(row.session_id, list);
  });

  const shaped = sessions.map((row) => {
    const session = mapSession(row);
    const client = clientMap.get(session.clientId);
    const brokerage = brokerageMap.get(session.brokerageId);
    if (!client || !brokerage) {
      throw new Error("Session references missing client or brokerage");
    }
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
      stepsCompleted: stepCounts.get(session.id) ?? 0,
      invitedAt: session.inviteSentAt,
      partialSubmittedAt: session.partialSubmittedAt,
      finalSubmittedAt: session.finalSubmittedAt,
      lastActivityAt: client.lastActivityAt,
      missingItems: session.missingItems,
      driveFolderUrl: session.driveFolderUrl,
      report: reportMap.get(session.id),
      jobs: jobsMap.get(session.id) ?? [],
    };
  });

  return includeArchived
    ? shaped
    : shaped.filter((item) => !item.client.isArchived && !item.brokerage.isArchived);
}

export async function createJobInSupabase(sessionId: string, kind: Job["kind"]): Promise<Job> {
  const rows = await request<JobRow[]>("jobs?select=*", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      session_id: sessionId,
      kind,
      status: "QUEUED",
    }),
  });

  await request("job_status", {
    method: "POST",
    body: JSON.stringify({ job_id: rows[0].id, status: "QUEUED" }),
  });

  return {
    id: rows[0].id,
    sessionId: rows[0].session_id,
    kind: rows[0].kind,
    status: rows[0].status,
    createdAt: rows[0].created_at,
    startedAt: rows[0].started_at ?? undefined,
    completedAt: rows[0].completed_at ?? undefined,
  };
}

export async function setJobStatusInSupabase(jobId: string, status: JobStatus): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (status === "RUNNING") patch.started_at = new Date().toISOString();
  if (status === "COMPLETED" || status === "FAILED") patch.completed_at = new Date().toISOString();

  await request(`jobs?id=eq.${encodeURIComponent(jobId)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });

  await request("job_status", {
    method: "POST",
    body: JSON.stringify({ job_id: jobId, status }),
  });
}

export async function addJobOutputInSupabase(
  jobId: string,
  outputType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await request("job_outputs", {
    method: "POST",
    body: JSON.stringify({
      job_id: jobId,
      output_type: outputType,
      payload,
    }),
  });
}

export async function getReportBySessionIdFromSupabase(sessionId: string): Promise<Report | null> {
  const rows = await request<ReportRow[]>(
    `reports?select=*&session_id=eq.${encodeURIComponent(sessionId)}&limit=1`,
    { method: "GET" },
  );
  return rows.length > 0 ? mapReport(rows[0]) : null;
}

export async function upsertReportInSupabase(
  sessionId: string,
  report: Omit<Report, "id" | "createdAt" | "updatedAt">,
): Promise<Report> {
  const existing = await getReportBySessionIdFromSupabase(sessionId);
  if (existing) {
    const rows = await request<ReportRow[]>(
      `reports?session_id=eq.${encodeURIComponent(sessionId)}&select=*`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          title: report.title,
          summary: report.summary,
          findings: report.findings,
          recommendations: report.recommendations,
          approved_at: report.approvedAt ?? null,
          updated_at: new Date().toISOString(),
        }),
      },
    );
    return mapReport(rows[0]);
  }

  const rows = await request<ReportRow[]>("reports?select=*", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      session_id: sessionId,
      title: report.title,
      summary: report.summary,
      findings: report.findings,
      recommendations: report.recommendations,
      approved_at: report.approvedAt ?? null,
    }),
  });
  return mapReport(rows[0]);
}
