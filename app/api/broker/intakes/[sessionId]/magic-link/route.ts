import { fail, ok } from "@/lib/api/responses";
import { requireBrokerAccess } from "@/lib/api/brokerAuth";
import { assertSessionInBrokerage, sendNewMagicLink } from "@/lib/services/operatorService";

export async function POST(request: Request, { params }: { params: { sessionId: string } }) {
  const auth = requireBrokerAccess(request);
  if (!auth.ok) return auth.response;
  try {
    await assertSessionInBrokerage({
      sessionId: params.sessionId,
      brokerageId: auth.identity.brokerageId,
    });
    return ok(await sendNewMagicLink(params.sessionId));
  } catch (error) {
    return fail((error as Error).message);
  }
}
