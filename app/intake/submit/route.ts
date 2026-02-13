import { fail, ok } from "@/lib/api/responses";
import { submitIntake } from "@/lib/services/intakeService";
import { runFullPipeline } from "@/lib/services/pipelineService";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { token: string };
    const session = submitIntake(body.token);
    const pipeline = runFullPipeline(session.id);
    return ok({ session, pipeline });
  } catch (error) {
    return fail((error as Error).message);
  }
}
