import { fail } from "@/lib/api/responses";
import {
  OPERATOR_SESSION_COOKIE,
  createOperatorSession,
  resolveRoleForEmail,
  verifyPasswordForRole,
} from "@/lib/security/operatorAccess";
import { NextResponse } from "next/server";

type AttemptState = {
  count: number;
  resetAt: number;
};

const ATTEMPTS = new Map<string, AttemptState>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function getAttemptKey(request: Request, email: string): string {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  return `${ip}:${email.toLowerCase()}`;
}

function consumeAttempt(request: Request, email: string): { allowed: boolean; retryAfterSeconds?: number } {
  const key = getAttemptKey(request, email);
  const now = Date.now();
  const current = ATTEMPTS.get(key);
  if (!current || current.resetAt <= now) {
    ATTEMPTS.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }
  if (current.count >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000) };
  }
  current.count += 1;
  ATTEMPTS.set(key, current);
  return { allowed: true };
}

function clearAttempt(request: Request, email: string): void {
  ATTEMPTS.delete(getAttemptKey(request, email));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";
    if (!email || !password) {
      return fail("Email and password are required");
    }

    const attempt = consumeAttempt(request, email);
    if (!attempt.allowed) {
      return fail(`Too many attempts. Try again in ${attempt.retryAfterSeconds ?? 60} seconds.`, 429);
    }

    const role = resolveRoleForEmail(email);
    if (!role) {
      return fail("Invalid credentials", 401);
    }
    const passwordConfigured =
      role === "ADMIN" ? Boolean(process.env.OPERATOR_ADMIN_PASSWORD) : Boolean(process.env.OPERATOR_EDITOR_PASSWORD);
    if (!passwordConfigured) {
      return fail(`Credentials are not configured for role ${role}`, 500);
    }
    if (!verifyPasswordForRole(role, password)) {
      return fail("Invalid credentials", 401);
    }

    clearAttempt(request, email);
    const session = createOperatorSession(email, role);
    const response = NextResponse.json({ ok: true, data: { role, email } });
    response.cookies.set({
      name: OPERATOR_SESSION_COOKIE,
      value: session.token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: session.expiresAt,
    });
    return response;
  } catch (error) {
    return fail((error as Error).message);
  }
}
