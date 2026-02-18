import { fail, ok } from "@/lib/api/responses";
import { getClientTimeline } from "@/lib/services/operatorService";

export async function GET(_request: Request, { params }: { params: { sessionId: string } }) {
  try {
    return ok({ events: getClientTimeline(params.sessionId) });
  } catch (error) {
    return fail((error as Error).message);
  }
}
