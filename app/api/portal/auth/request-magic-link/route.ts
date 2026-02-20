import { fail, ok } from "@/lib/api/responses";
import { isPostgresDriver } from "@/lib/persistence/driver";
import { getActiveSessionByClient, getBrokerageBySlug, getClientByBrokerageAndEmail } from "@/lib/persistence/mockDb";
import {
  getActiveSessionByClientFromSupabase,
  getBrokerageBySlugFromSupabase,
  getClientByBrokerageAndEmailFromSupabase,
} from "@/lib/persistence/supabaseRest";
import { sendInviteForSession } from "@/lib/services/onboardingService";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      brokerageSlug: string;
      email: string;
    };

    const brokerage = isPostgresDriver()
      ? await getBrokerageBySlugFromSupabase(body.brokerageSlug)
      : getBrokerageBySlug(body.brokerageSlug);
    if (!brokerage) throw new Error("Brokerage not found");
    const client = isPostgresDriver()
      ? await getClientByBrokerageAndEmailFromSupabase(brokerage.id, body.email.toLowerCase())
      : getClientByBrokerageAndEmail(brokerage.id, body.email.toLowerCase());

    if (client) {
      const session = isPostgresDriver()
        ? await getActiveSessionByClientFromSupabase(client.id)
        : getActiveSessionByClient(client.id);
      if (session) {
        await sendInviteForSession(session.id);
      }
    }

    return ok({ accepted: true });
  } catch (error) {
    return fail((error as Error).message);
  }
}
