import { fail, ok } from "@/lib/api/responses";
import { getBrokerageById, getClientById, getDb, getSessionById } from "@/lib/persistence/mockDb";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return fail("Not found", 404);
  }

  try {
    const db = getDb();
    const items = db.outbound_emails
      .slice()
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
