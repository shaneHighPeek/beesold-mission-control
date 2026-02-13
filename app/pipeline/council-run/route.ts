import { fail, ok } from "@/lib/api/responses";
import { runCouncil } from "@/lib/services/pipelineService";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { sessionId: string };
    return ok(runCouncil(body.sessionId));
  } catch (error) {
    return fail((error as Error).message);
  }
}
