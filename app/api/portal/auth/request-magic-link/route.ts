import { fail, ok } from "@/lib/api/responses";
import { getActiveSessionByClient, getBrokerageBySlug, getClientByBrokerageAndEmail } from "@/lib/persistence/mockDb";
import { sendInviteForSession } from "@/lib/services/onboardingService";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      brokerageSlug: string;
      email: string;
    };

    const brokerage = getBrokerageBySlug(body.brokerageSlug);
    const client = getClientByBrokerageAndEmail(brokerage.id, body.email.toLowerCase());

    if (client) {
      const session = getActiveSessionByClient(client.id);
      if (session) {
        sendInviteForSession(session.id);
      }
    }

    return ok({ accepted: true });
  } catch (error) {
    return fail((error as Error).message);
  }
}
