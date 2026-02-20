import { isPostgresDriver } from "@/lib/persistence/driver";
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
import {
  addAuditLogInSupabase,
  addWebhookIdempotencyInSupabase,
  createIntakeSessionForClientInSupabase,
  findWebhookIdempotencyFromSupabase,
  getBrokerageByIdFromSupabase,
  getBrokerageBySlugFromSupabase,
  getClientByIdFromSupabase,
  getSessionByIdFromSupabase,
  setSessionInviteSentInSupabase,
  upsertClientIdentityInSupabase,
} from "@/lib/persistence/supabaseRest";
import { issueMagicLinkForSession } from "@/lib/services/authService";
import { sendWelcomeEmail } from "@/lib/services/emailService";
import { ensureDriveFolder } from "@/lib/services/googleDriveService";

export async function createOrUpdateClientOnboarding(input: {
  brokerageSlug: string;
  businessName: string;
  contactName: string;
  email: string;
  phone?: string;
  assignedOwner?: string;
  triggerInvite?: boolean;
  source: "ADMIN" | "API";
  idempotencyKey?: string;
}): Promise<{
  clientId: string;
  sessionId: string;
  inviteSent: boolean;
  magicLinkUrl?: string;
}> {
  if (isPostgresDriver()) {
    const brokerage = await getBrokerageBySlugFromSupabase(input.brokerageSlug);
    if (!brokerage) {
      throw new Error("Brokerage not found");
    }

    if (input.source === "API" && input.idempotencyKey) {
      const existing = await findWebhookIdempotencyFromSupabase(input.idempotencyKey, brokerage.id);
      if (existing) {
        const existingSession = await createIntakeSessionForClientInSupabase(existing.clientId, brokerage.id);
        return {
          clientId: existing.clientId,
          sessionId: existingSession.id,
          inviteSent: false,
        };
      }
    }

    const client = await upsertClientIdentityInSupabase({
      brokerageId: brokerage.id,
      businessName: input.businessName,
      contactName: input.contactName,
      email: input.email,
      phone: input.phone,
      assignedOwner: input.assignedOwner,
    });

    const session = await createIntakeSessionForClientInSupabase(client.id, brokerage.id);

    await addAuditLogInSupabase(session.id, brokerage.id, client.id, "SYSTEM", "CLIENT_ONBOARDED", {
      source: input.source,
      businessName: client.businessName,
      contactName: client.contactName,
      email: client.email,
    });

    if (input.source === "API" && input.idempotencyKey) {
      await addWebhookIdempotencyInSupabase(input.idempotencyKey, brokerage.id, client.id);
    }

    if (!input.triggerInvite) {
      return {
        clientId: client.id,
        sessionId: session.id,
        inviteSent: false,
      };
    }

    const invite = await sendInviteForSession(session.id);

    return {
      clientId: client.id,
      sessionId: session.id,
      inviteSent: true,
      magicLinkUrl: invite.magicLinkUrl,
    };
  }

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

  const invite = await sendInviteForSession(session.id);

  return {
    clientId: client.id,
    sessionId: session.id,
    inviteSent: true,
    magicLinkUrl: invite.magicLinkUrl,
  };
}

export async function sendInviteForSession(sessionId: string): Promise<{ magicLinkUrl: string }> {
  if (isPostgresDriver()) {
    const session = await getSessionByIdFromSupabase(sessionId);
    if (!session) throw new Error("Session not found");
    const client = await getClientByIdFromSupabase(session.clientId);
    if (!client) throw new Error("Client not found");
    const brokerage = await getBrokerageByIdFromSupabase(session.brokerageId);
    if (!brokerage) throw new Error("Brokerage not found");

    await ensureDriveFolder({ brokerage, client, session });

    const { rawToken } = await issueMagicLinkForSession(session.id);
    const magicLinkUrl = `${brokerage.portalBaseUrl}/portal/auth/magic?token=${encodeURIComponent(rawToken)}`;

    await sendWelcomeEmail({
      brokerage,
      client,
      session,
      magicLinkUrl,
    });

    await setSessionInviteSentInSupabase(session.id);

    await addAuditLogInSupabase(session.id, brokerage.id, client.id, "SYSTEM", "CLIENT_INVITED", {
      magicLinkUrl,
    });

    return { magicLinkUrl };
  }

  const session = getSessionById(sessionId);
  const client = getClientById(session.clientId);
  const brokerage = getBrokerageById(session.brokerageId);

  ensureDriveFolder({ brokerage, client, session });

  const { rawToken } = await issueMagicLinkForSession(session.id);
  const magicLinkUrl = `${brokerage.portalBaseUrl}/portal/auth/magic?token=${encodeURIComponent(rawToken)}`;

  await sendWelcomeEmail({
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
