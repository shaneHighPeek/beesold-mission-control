import { createHmac, timingSafeEqual } from "crypto";

export type BrokerSession = {
  email: string;
  brokerageId: string;
  brokerageSlug: string;
  brokerageName: string;
  exp: number;
};

export const BROKER_SESSION_COOKIE = "beesold_broker_session";

type ConfiguredBrokerUser = {
  brokerageSlug: string;
  email: string;
  password: string;
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function splitCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function safeEq(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function getSessionSecret(): string {
  return process.env.BROKER_SESSION_SECRET ?? process.env.OPERATOR_SESSION_SECRET ?? "dev-broker-session-secret";
}

function getBrokerSessionTtlSeconds(): number {
  const hours = Number(process.env.BROKER_SESSION_TTL_HOURS ?? "12");
  if (!Number.isFinite(hours) || hours <= 0) return 12 * 60 * 60;
  return Math.floor(hours * 60 * 60);
}

function signPayload(rawPayload: string): string {
  return createHmac("sha256", getSessionSecret()).update(rawPayload).digest("base64url");
}

function parseConfiguredBrokerUsers(): ConfiguredBrokerUser[] {
  const raw = splitCsv(process.env.BROKER_PORTAL_USERS);
  return raw
    .map((entry) => {
      const pipeParts = entry.split("|").map((item) => item.trim());
      const colonParts = entry.split(":").map((item) => item.trim());
      const parts = pipeParts.length === 3 ? pipeParts : colonParts.length === 3 ? colonParts : [];
      if (parts.length !== 3) return null;
      const [brokerageSlug, email, password] = parts;
      if (!brokerageSlug || !email || !password) return null;
      return {
        brokerageSlug: brokerageSlug.toLowerCase(),
        email: normalizeEmail(email),
        password,
      };
    })
    .filter((item): item is ConfiguredBrokerUser => Boolean(item));
}

export function verifyBrokerCredentials(input: {
  brokerageSlug: string;
  email: string;
  password: string;
  brokerageSenderEmail: string;
}): boolean {
  const normalizedSlug = input.brokerageSlug.trim().toLowerCase();
  const normalizedEmail = normalizeEmail(input.email);
  const configuredUsers = parseConfiguredBrokerUsers();
  if (configuredUsers.length > 0) {
    return configuredUsers.some(
      (user) =>
        user.brokerageSlug === normalizedSlug &&
        user.email === normalizedEmail &&
        safeEq(user.password, input.password),
    );
  }

  const fallbackPassword = process.env.BROKER_PORTAL_PASSWORD;
  if (!fallbackPassword) return false;

  // Safe fallback for demos: only brokerage sender email can sign in when explicit users are not configured.
  if (normalizeEmail(input.brokerageSenderEmail) !== normalizedEmail) return false;
  return safeEq(fallbackPassword, input.password);
}

export function createBrokerSession(input: {
  email: string;
  brokerageId: string;
  brokerageSlug: string;
  brokerageName: string;
}): { token: string; expiresAt: Date } {
  const ttlSeconds = getBrokerSessionTtlSeconds();
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload: BrokerSession = {
    email: normalizeEmail(input.email),
    brokerageId: input.brokerageId,
    brokerageSlug: input.brokerageSlug,
    brokerageName: input.brokerageName,
    exp,
  };
  const raw = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = signPayload(raw);
  return {
    token: `${raw}.${sig}`,
    expiresAt: new Date(exp * 1000),
  };
}

export function parseBrokerSession(token: string | undefined): BrokerSession | null {
  if (!token) return null;
  const [raw, sig] = token.split(".");
  if (!raw || !sig) return null;
  const expected = signPayload(raw);
  if (!safeEq(sig, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as BrokerSession;
    if (
      !payload ||
      typeof payload.email !== "string" ||
      typeof payload.brokerageId !== "string" ||
      typeof payload.brokerageSlug !== "string" ||
      typeof payload.brokerageName !== "string"
    ) {
      return null;
    }
    if (!Number.isFinite(payload.exp) || payload.exp * 1000 <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function readCookie(cookieHeader: string | null, key: string): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [name, ...rest] = part.trim().split("=");
    if (name === key) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export function getBrokerSessionFromRequest(request: Request): BrokerSession | null {
  const cookieHeader = request.headers.get("cookie");
  const token = readCookie(cookieHeader, BROKER_SESSION_COOKIE);
  return parseBrokerSession(token);
}
