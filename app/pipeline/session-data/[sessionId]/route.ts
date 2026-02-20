import { fail, ok } from "@/lib/api/responses";
import { requireOperatorAccess } from "@/lib/api/operatorAuth";
import { getPipelineSessionData } from "@/lib/services/pipelineService";

export async function GET(request: Request, { params }: { params: { sessionId: string } }) {
  const auth = requireOperatorAccess(request, ["ADMIN", "KLOR_SYSTEM"], { allowKlorApiKey: true });
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const updatedSince = searchParams.get("updatedSince") ?? undefined;
    return ok(await getPipelineSessionData(params.sessionId, { updatedSince }));
  } catch (error) {
    return fail((error as Error).message);
  }
}
