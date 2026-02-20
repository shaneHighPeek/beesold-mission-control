import { fail, ok } from "@/lib/api/responses";
import { requireOperatorAccess } from "@/lib/api/operatorAuth";
import { markMissingItems } from "@/lib/services/operatorService";

export async function POST(request: Request, { params }: { params: { sessionId: string } }) {
  const auth = requireOperatorAccess(request, ["ADMIN"]);
  if (!auth.ok) return auth.response;
  try {
    const body = (await request.json()) as {
      missingItems: string[];
      requestedBy?: string;
    };

    const session = await markMissingItems({
      sessionId: params.sessionId,
      missingItems: body.missingItems,
      requestedBy: body.requestedBy ?? "Mission Control Operator",
    });

    return ok({ session });
  } catch (error) {
    return fail((error as Error).message);
  }
}
