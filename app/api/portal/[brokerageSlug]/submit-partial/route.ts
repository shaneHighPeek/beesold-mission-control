import { fail, ok } from "@/lib/api/responses";
import { PORTAL_SESSION_COOKIE } from "@/lib/services/authService";
import { submitPartial } from "@/lib/services/intakeService";
import { cookies } from "next/headers";

export async function POST(request: Request, { params }: { params: { brokerageSlug: string } }) {
  try {
    const body = (await request.json()) as { note?: string };
    const session = submitPartial({
      brokerageSlug: params.brokerageSlug,
      signedCookieValue: cookies().get(PORTAL_SESSION_COOKIE)?.value,
      note: body.note,
    });

    return ok({ session });
  } catch (error) {
    return fail((error as Error).message, 401);
  }
}
