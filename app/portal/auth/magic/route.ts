import { PORTAL_SESSION_COOKIE, consumeMagicLinkAndAuthenticate } from "@/lib/services/authService";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  try {
    const result = consumeMagicLinkAndAuthenticate(token);
    const redirectPath = result.requiresPasswordSetup
      ? `/portal/${result.brokerageSlug}/set-password`
      : `/portal/${result.brokerageSlug}/intake`;

    const response = NextResponse.redirect(new URL(redirectPath, request.url));
    response.cookies.set(PORTAL_SESSION_COOKIE, result.cookieValue, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch {
    return NextResponse.redirect(new URL("/", request.url));
  }
}
