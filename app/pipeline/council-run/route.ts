import { fail, ok } from "@/lib/api/responses";
import { requireOperatorAccess } from "@/lib/api/operatorAuth";
import { runCouncil } from "@/lib/services/pipelineService";

export async function POST(request: Request) {
  const auth = requireOperatorAccess(request, ["ADMIN", "KLOR_SYSTEM"], { allowKlorApiKey: true });
  if (!auth.ok) return auth.response;
  try {
    const body = (await request.json()) as { sessionId: string };
    return ok(await runCouncil(body.sessionId));
  } catch (error) {
    return fail((error as Error).message);
  }
}
