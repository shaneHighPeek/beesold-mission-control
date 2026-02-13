import { fail, ok } from "@/lib/api/responses";
import { processApproval } from "@/lib/services/operatorService";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionId: string;
      decision: "APPROVE" | "REJECT";
      operatorName: string;
      note?: string;
    };

    processApproval(body);
    return ok({ accepted: true });
  } catch (error) {
    return fail((error as Error).message);
  }
}
