import { OPERATOR_SESSION_COOKIE } from "@/lib/security/operatorAccess";
import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true, data: { signedOut: true } });
  response.cookies.set({
    name: OPERATOR_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
  return response;
}
