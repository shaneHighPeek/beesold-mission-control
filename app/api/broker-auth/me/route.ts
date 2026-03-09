import { fail, ok } from "@/lib/api/responses";
import { getBrokerSessionFromRequest } from "@/lib/security/brokerAccess";
import { getBrokerageTheme } from "@/lib/services/brokerageService";

export async function GET(request: Request) {
  const session = getBrokerSessionFromRequest(request);
  if (!session) return fail("Unauthorized", 401);
  const brokerage = await getBrokerageTheme(session.brokerageSlug);
  return ok({
    email: session.email,
    brokerage: {
      id: brokerage.id,
      slug: brokerage.slug,
      name: brokerage.name,
    },
  });
}
