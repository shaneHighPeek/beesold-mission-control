import { fail, ok } from "@/lib/api/responses";
import { requireBrokerAccess } from "@/lib/api/brokerAuth";
import { clearBrokerCustomDomain, configureBrokerCustomDomain } from "@/lib/services/domainService";

export async function POST(request: Request) {
  const auth = requireBrokerAccess(request);
  if (!auth.ok) return auth.response;
  try {
    const body = (await request.json()) as { customDomain?: string };
    const customDomain = body.customDomain?.trim() ?? "";
    if (!customDomain) {
      return fail("customDomain is required", 422);
    }
    const data = await configureBrokerCustomDomain({
      brokerageId: auth.identity.brokerageId,
      brokerageSlug: auth.identity.brokerageSlug,
      customDomain,
    });
    return ok(data);
  } catch (error) {
    return fail((error as Error).message);
  }
}

export async function DELETE(request: Request) {
  const auth = requireBrokerAccess(request);
  if (!auth.ok) return auth.response;
  try {
    const data = await clearBrokerCustomDomain({
      brokerageId: auth.identity.brokerageId,
    });
    return ok(data);
  } catch (error) {
    return fail((error as Error).message);
  }
}
