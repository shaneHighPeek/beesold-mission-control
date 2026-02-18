import { fail, ok } from "@/lib/api/responses";
import { PORTAL_SESSION_COOKIE, setPortalPassword } from "@/lib/services/authService";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      brokerageSlug: string;
      password: string;
    };

    setPortalPassword({
      brokerageSlug: body.brokerageSlug,
      password: body.password,
      signedCookieValue: cookies().get(PORTAL_SESSION_COOKIE)?.value,
    });

    return ok({ redirectTo: `/portal/${body.brokerageSlug}/intake` });
  } catch (error) {
    return fail((error as Error).message, 401);
  }
}
