import { fail, ok } from "@/lib/api/responses";
import { markMissingItems } from "@/lib/services/operatorService";

export async function POST(request: Request, { params }: { params: { sessionId: string } }) {
  try {
    const body = (await request.json()) as {
      missingItems: string[];
      requestedBy?: string;
    };

    const session = markMissingItems({
      sessionId: params.sessionId,
      missingItems: body.missingItems,
      requestedBy: body.requestedBy ?? "Mission Control Operator",
    });

    return ok({ session });
  } catch (error) {
    return fail((error as Error).message);
  }
}
