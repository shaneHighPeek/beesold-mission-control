import { fail, ok } from "@/lib/api/responses";
import { requireOperatorAccess } from "@/lib/api/operatorAuth";
import { resendInvite } from "@/lib/services/operatorService";

export async function POST(request: Request, { params }: { params: { sessionId: string } }) {
  const auth = requireOperatorAccess(request, ["ADMIN"]);
  if (!auth.ok) return auth.response;
  try {
    return ok(await resendInvite(params.sessionId));
  } catch (error) {
    return fail((error as Error).message);
  }
}
