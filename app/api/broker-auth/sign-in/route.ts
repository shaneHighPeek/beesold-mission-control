import { fail } from "@/lib/api/responses";
import { getBrokerageTheme } from "@/lib/services/brokerageService";
import {
  BROKER_SESSION_COOKIE,
  createBrokerSession,
  verifyBrokerCredentials,
} from "@/lib/security/brokerAccess";
import { NextResponse } from "next/server";

type AttemptState = {
  count: number;
  resetAt: number;
};

const ATTEMPTS = new Map<string, AttemptState>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function getAttemptKey(request: Request, brokerageSlug: string, email: string): string {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  return `${ip}:${brokerageSlug.toLowerCase()}:${email.toLowerCase()}`;
}

function consumeAttempt(
  request: Request,
  brokerageSlug: string,
  email: string,
): { allowed: boolean; retryAfterSeconds?: number } {
  const key = getAttemptKey(request, brokerageSlug, email);
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

function clearAttempt(request: Request, brokerageSlug: string, email: string): void {
  ATTEMPTS.delete(getAttemptKey(request, brokerageSlug, email));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { brokerageSlug?: string; email?: string; password?: string };
    const brokerageSlug = body.brokerageSlug?.trim().toLowerCase() ?? "";
    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";
    if (!brokerageSlug || !email || !password) {
      return fail("Brokerage slug, email and password are required");
    }

    const attempt = consumeAttempt(request, brokerageSlug, email);
    if (!attempt.allowed) {
      return fail(`Too many attempts. Try again in ${attempt.retryAfterSeconds ?? 60} seconds.`, 429);
    }

    const brokerage = await getBrokerageTheme(brokerageSlug);
    if (!verifyBrokerCredentials({ brokerageSlug, email, password, brokerageSenderEmail: brokerage.senderEmail })) {
      return fail("Invalid credentials", 401);
    }

    clearAttempt(request, brokerageSlug, email);
    const session = createBrokerSession({
      email,
      brokerageId: brokerage.id,
      brokerageSlug: brokerage.slug,
      brokerageName: brokerage.name,
    });

    const response = NextResponse.json({
      ok: true,
      data: {
        email,
        brokerage: {
          id: brokerage.id,
          slug: brokerage.slug,
          name: brokerage.name,
        },
      },
    });
    response.cookies.set({
      name: BROKER_SESSION_COOKIE,
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
