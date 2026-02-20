import { fail, ok } from "@/lib/api/responses";
import { requireOperatorAccess } from "@/lib/api/operatorAuth";
import { setClientArchiveState } from "@/lib/services/operatorService";

export async function POST(
  request: Request,
  { params }: { params: { sessionId: string } },
) {
  const auth = requireOperatorAccess(request, ["ADMIN"]);
  if (!auth.ok) return auth.response;
  try {
    const body = (await request.json()) as {
      isArchived: boolean;
      actorName?: string;
    };
    if (typeof body.isArchived !== "boolean") {
      return fail("isArchived must be a boolean");
    }

    await setClientArchiveState({
      sessionId: params.sessionId,
      isArchived: body.isArchived,
      actorName: body.actorName ?? "Mission Control Operator",
    });
    return ok({ accepted: true });
  } catch (error) {
    return fail((error as Error).message);
  }
}
