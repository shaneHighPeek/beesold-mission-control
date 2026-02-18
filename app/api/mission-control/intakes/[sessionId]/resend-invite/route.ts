import { fail, ok } from "@/lib/api/responses";
import { resendInvite } from "@/lib/services/operatorService";

export async function POST(_request: Request, { params }: { params: { sessionId: string } }) {
  try {
    return ok(resendInvite(params.sessionId));
  } catch (error) {
    return fail((error as Error).message);
  }
}
