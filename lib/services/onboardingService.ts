import {
  addAuditLog,
  addWebhookIdempotency,
  createIntakeSessionForClient,
  findWebhookIdempotency,
  getBrokerageById,
  getBrokerageBySlug,
  getClientById,
  getSessionById,
  setSessionInviteSent,
  upsertClientIdentity,
} from "@/lib/persistence/mockDb";
import { issueMagicLinkForSession } from "@/lib/services/authService";
import { sendWelcomeEmail } from "@/lib/services/emailService";
import { ensureDriveFolder } from "@/lib/services/googleDriveService";

export function createOrUpdateClientOnboarding(input: {
  brokerageSlug: string;
  businessName: string;
  contactName: string;
  email: string;
  phone?: string;
  assignedOwner?: string;
  triggerInvite?: boolean;
  source: "ADMIN" | "API";
  idempotencyKey?: string;
}): {
  clientId: string;
  sessionId: string;
  inviteSent: boolean;
  magicLinkUrl?: string;
} {
  const brokerage = getBrokerageBySlug(input.brokerageSlug);

  if (input.source === "API" && input.idempotencyKey) {
    const existing = findWebhookIdempotency(input.idempotencyKey, brokerage.id);
    if (existing) {
      const existingSession = createIntakeSessionForClient(existing.clientId, brokerage.id);
      return {
        clientId: existing.clientId,
        sessionId: existingSession.id,
        inviteSent: false,
      };
    }
  }

  const client = upsertClientIdentity({
    brokerageId: brokerage.id,
    businessName: input.businessName,
    contactName: input.contactName,
    email: input.email,
    phone: input.phone,
    assignedOwner: input.assignedOwner,
  });

  const session = createIntakeSessionForClient(client.id, brokerage.id);

  addAuditLog(session.id, brokerage.id, client.id, "SYSTEM", "CLIENT_ONBOARDED", {
    source: input.source,
    businessName: client.businessName,
    contactName: client.contactName,
    email: client.email,
  });

  if (input.source === "API" && input.idempotencyKey) {
    addWebhookIdempotency(input.idempotencyKey, brokerage.id, client.id);
  }

  if (!input.triggerInvite) {
    return {
      clientId: client.id,
      sessionId: session.id,
      inviteSent: false,
    };
  }

  const invite = sendInviteForSession(session.id);

  return {
    clientId: client.id,
    sessionId: session.id,
    inviteSent: true,
    magicLinkUrl: invite.magicLinkUrl,
  };
}

export function sendInviteForSession(sessionId: string): { magicLinkUrl: string } {
  const session = getSessionById(sessionId);
  const client = getClientById(session.clientId);
  const brokerage = getBrokerageById(session.brokerageId);

  ensureDriveFolder({ brokerage, client, session });

  const { rawToken } = issueMagicLinkForSession(session.id);
  const magicLinkUrl = `${brokerage.portalBaseUrl}/portal/auth/magic?token=${encodeURIComponent(rawToken)}`;

  sendWelcomeEmail({
    brokerage,
    client,
    session,
    magicLinkUrl,
  });

  setSessionInviteSent(session.id);

  addAuditLog(session.id, brokerage.id, client.id, "SYSTEM", "CLIENT_INVITED", {
    magicLinkUrl,
  });

  return { magicLinkUrl };
}
