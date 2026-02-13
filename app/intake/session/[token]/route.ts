import { fail, ok } from "@/lib/api/responses";
import { getIntakeSessionView } from "@/lib/services/intakeService";

export async function GET(
  _request: Request,
  { params }: { params: { token: string } },
) {
  try {
    return ok(getIntakeSessionView(params.token));
  } catch (error) {
    return fail((error as Error).message, 404);
  }
}
