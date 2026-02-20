import { fail, ok } from "@/lib/api/responses";
import { PORTAL_SESSION_COOKIE, authenticateWithPassword } from "@/lib/services/authService";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      brokerageSlug: string;
      email: string;
      password: string;
    };

    const auth = await authenticateWithPassword(body);
    const response = NextResponse.json({ ok: true, data: { redirectTo: `/portal/${auth.brokerageSlug}/intake` } });

    response.cookies.set(PORTAL_SESSION_COOKIE, auth.cookieValue, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch (error) {
    return fail((error as Error).message, 401);
  }
}
