import { fail, ok } from "@/lib/api/responses";
import { requireOperatorAccess } from "@/lib/api/operatorAuth";
import { getClientTimeline } from "@/lib/services/operatorService";

export async function GET(request: Request, { params }: { params: { sessionId: string } }) {
  const auth = requireOperatorAccess(request, ["ADMIN", "EDITOR"]);
  if (!auth.ok) return auth.response;
  try {
    return ok({ events: await getClientTimeline(params.sessionId) });
  } catch (error) {
    return fail((error as Error).message);
  }
}
