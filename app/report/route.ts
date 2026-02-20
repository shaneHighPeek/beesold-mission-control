import { fail, ok } from "@/lib/api/responses";
import { getReport, listMissionControlIntakes } from "@/lib/services/operatorService";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return fail("sessionId is required", 422);
    }

    const report = await getReport(sessionId);
    const session = (await listMissionControlIntakes()).find((item) => item.id === sessionId);

    return ok({ report, session });
  } catch (error) {
    return fail((error as Error).message);
  }
}
