import { fail, ok } from "@/lib/api/responses";
import { PORTAL_SESSION_COOKIE } from "@/lib/services/authService";
import { submitFinal } from "@/lib/services/intakeService";
import { runFullPipeline } from "@/lib/services/pipelineService";
import { cookies } from "next/headers";

export async function POST(_request: Request, { params }: { params: { brokerageSlug: string } }) {
  try {
    const session = submitFinal({
      brokerageSlug: params.brokerageSlug,
      signedCookieValue: cookies().get(PORTAL_SESSION_COOKIE)?.value,
    });

    const pipeline = runFullPipeline(session.id);

    return ok({ session, pipeline });
  } catch (error) {
    return fail((error as Error).message, 401);
  }
}
