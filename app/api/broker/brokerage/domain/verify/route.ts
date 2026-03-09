import { fail, ok } from "@/lib/api/responses";
import { requireBrokerAccess } from "@/lib/api/brokerAuth";
import { verifyBrokerCustomDomain } from "@/lib/services/domainService";

export async function POST(request: Request) {
  const auth = requireBrokerAccess(request);
  if (!auth.ok) return auth.response;
  try {
    const data = await verifyBrokerCustomDomain({
      brokerageId: auth.identity.brokerageId,
      brokerageSlug: auth.identity.brokerageSlug,
    });
    return ok(data);
  } catch (error) {
    return fail((error as Error).message);
  }
}
