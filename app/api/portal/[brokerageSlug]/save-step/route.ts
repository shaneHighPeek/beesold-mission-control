import { fail, ok } from "@/lib/api/responses";
import { PORTAL_SESSION_COOKIE } from "@/lib/services/authService";
import { saveIntakeStep } from "@/lib/services/intakeService";
import { cookies } from "next/headers";

export async function POST(request: Request, { params }: { params: { brokerageSlug: string } }) {
  try {
    const body = (await request.json()) as {
      stepKey: string;
      data: Record<string, unknown>;
      currentStep: number;
      markComplete: boolean;
    };

    const result = await saveIntakeStep({
      brokerageSlug: params.brokerageSlug,
      signedCookieValue: cookies().get(PORTAL_SESSION_COOKIE)?.value,
      stepKey: body.stepKey,
      data: body.data,
      currentStep: body.currentStep,
      markComplete: body.markComplete,
    });

    if (!result.ok) {
      return fail("Validation failed", 422);
    }

    return ok(result);
  } catch (error) {
    return fail((error as Error).message, 401);
  }
}
