import { fail, ok } from "@/lib/api/responses";
import { requireOperatorAccess } from "@/lib/api/operatorAuth";
import { isPostgresDriver } from "@/lib/persistence/driver";
import { getBrokerageById, getClientById, getDb, getSessionById } from "@/lib/persistence/mockDb";
import {
  getBrokerageByIdFromSupabase,
  getClientByIdFromSupabase,
  getSessionByIdFromSupabase,
  listOutboundEmailsFromSupabase,
} from "@/lib/persistence/supabaseRest";

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return fail("Not found", 404);
  }
  const auth = requireOperatorAccess(request, ["ADMIN"]);
  if (!auth.ok) return auth.response;

  try {
    const items = isPostgresDriver()
      ? await Promise.all(
          (await listOutboundEmailsFromSupabase()).map(async (email) => {
            const session = await getSessionByIdFromSupabase(email.sessionId);
            if (!session) return null;
            const client = await getClientByIdFromSupabase(session.clientId);
            const brokerage = await getBrokerageByIdFromSupabase(email.brokerageId);
            if (!client || !brokerage) return null;
            const match = email.html.match(/https?:\/\/[^\"'\s<]+/i);
            const magicLinkUrl = match?.[0] ?? null;
            return {
              id: email.id,
              createdAt: email.createdAt,
              to: email.to,
              subject: email.subject,
              providerStatus: email.providerStatus ?? null,
              providerMessageId: email.providerMessageId ?? null,
              brokerageSlug: brokerage.slug,
              brokerageName: brokerage.name,
              clientName: client.contactName,
              businessName: client.businessName,
              sessionId: session.id,
              magicLinkUrl,
            };
          }),
        ).then((rows) => rows.filter((row): row is NonNullable<typeof row> => Boolean(row)))
      : getDb()
          .outbound_emails.slice()
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .map((email) => {
            const session = getSessionById(email.sessionId);
            const client = getClientById(session.clientId);
            const brokerage = getBrokerageById(email.brokerageId);

            const match = email.html.match(/https?:\/\/[^\"'\s<]+/i);
            const magicLinkUrl = match?.[0] ?? null;

            return {
              id: email.id,
              createdAt: email.createdAt,
              to: email.to,
              subject: email.subject,
              providerStatus: email.providerStatus ?? null,
              providerMessageId: email.providerMessageId ?? null,
              brokerageSlug: brokerage.slug,
              brokerageName: brokerage.name,
              clientName: client.contactName,
              businessName: client.businessName,
              sessionId: session.id,
              magicLinkUrl,
            };
          });

    return ok({ items });
  } catch (error) {
    return fail((error as Error).message);
  }
}
