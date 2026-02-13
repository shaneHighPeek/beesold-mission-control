import { fail, ok } from "@/lib/api/responses";
import { saveIntakeStep } from "@/lib/services/intakeService";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      token: string;
      stepKey: string;
      data: Record<string, unknown>;
      currentStep: number;
      markComplete: boolean;
    };

    const result = saveIntakeStep(body);
    if (!result.ok) {
      return fail("Validation failed", 422);
    }
    return ok(result);
  } catch (error) {
    return fail((error as Error).message);
  }
}
