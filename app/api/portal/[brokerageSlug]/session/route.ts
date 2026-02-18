import { fail, ok } from "@/lib/api/responses";
import { PORTAL_SESSION_COOKIE } from "@/lib/services/authService";
import { getIntakeSessionView } from "@/lib/services/intakeService";
import { cookies } from "next/headers";

export async function GET(_request: Request, { params }: { params: { brokerageSlug: string } }) {
  try {
    const data = getIntakeSessionView({
      brokerageSlug: params.brokerageSlug,
      signedCookieValue: cookies().get(PORTAL_SESSION_COOKIE)?.value,
    });

    return ok(data);
  } catch (error) {
    return fail((error as Error).message, 401);
  }
}
