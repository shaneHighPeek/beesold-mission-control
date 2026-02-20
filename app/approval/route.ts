import { fail, ok } from "@/lib/api/responses";
import { requireOperatorAccess } from "@/lib/api/operatorAuth";
import { processApproval } from "@/lib/services/operatorService";

export async function POST(request: Request) {
  const auth = requireOperatorAccess(request, ["ADMIN"]);
  if (!auth.ok) return auth.response;
  try {
    const body = (await request.json()) as {
      sessionId: string;
      decision: "APPROVE" | "REJECT";
      operatorName: string;
      note?: string;
    };

    await processApproval(body);
    return ok({ accepted: true });
  } catch (error) {
    return fail((error as Error).message);
  }
}
