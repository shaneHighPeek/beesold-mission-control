import { createHmac, timingSafeEqual } from "crypto";

export type OperatorRole = "ADMIN" | "EDITOR" | "KLOR_SYSTEM";

export type OperatorSession = {
  email: string;
  role: Exclude<OperatorRole, "KLOR_SYSTEM">;
  exp: number;
};

export const OPERATOR_SESSION_COOKIE = "beesold_operator_session";

const DEFAULT_ADMIN_EMAILS = ["shane@highpeekpro.com", "lori@highpeekpro.com"];

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

function getSessionSecret(): string {
  return process.env.OPERATOR_SESSION_SECRET ?? process.env.PORTAL_SESSION_SECRET ?? "dev-operator-session-secret";
}

function getAdminEmails(): string[] {
  const fromEnv = splitCsv(process.env.OPERATOR_ADMIN_EMAILS).map(normalizeEmail);
  return fromEnv.length > 0 ? fromEnv : DEFAULT_ADMIN_EMAILS;
}

function getEditorEmails(): string[] {
  return splitCsv(process.env.OPERATOR_EDITOR_EMAILS).map(normalizeEmail);
}

function getOperatorTtlSeconds(): number {
  const hours = Number(process.env.OPERATOR_SESSION_TTL_HOURS ?? "12");
  if (!Number.isFinite(hours) || hours <= 0) return 12 * 60 * 60;
  return Math.floor(hours * 60 * 60);
}

function signPayload(rawPayload: string): string {
  return createHmac("sha256", getSessionSecret()).update(rawPayload).digest("base64url");
}

function safeEq(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function resolveRoleForEmail(email: string): Exclude<OperatorRole, "KLOR_SYSTEM"> | null {
  const normalized = normalizeEmail(email);
  if (getAdminEmails().includes(normalized)) return "ADMIN";
  if (getEditorEmails().includes(normalized)) return "EDITOR";
  return null;
}

export function verifyPasswordForRole(role: Exclude<OperatorRole, "KLOR_SYSTEM">, password: string): boolean {
  const expected = role === "ADMIN" ? process.env.OPERATOR_ADMIN_PASSWORD : process.env.OPERATOR_EDITOR_PASSWORD;
  if (!expected) return false;
  return safeEq(password, expected);
}

export function createOperatorSession(email: string, role: Exclude<OperatorRole, "KLOR_SYSTEM">): {
  token: string;
  expiresAt: Date;
} {
  const ttlSeconds = getOperatorTtlSeconds();
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload: OperatorSession = {
    email: normalizeEmail(email),
    role,
    exp,
  };
  const raw = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = signPayload(raw);
  return {
    token: `${raw}.${sig}`,
    expiresAt: new Date(exp * 1000),
  };
}

export function parseOperatorSession(token: string | undefined): OperatorSession | null {
  if (!token) return null;
  const [raw, sig] = token.split(".");
  if (!raw || !sig) return null;
  const expected = signPayload(raw);
  if (!safeEq(sig, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as OperatorSession;
    if (!payload || typeof payload.email !== "string" || (payload.role !== "ADMIN" && payload.role !== "EDITOR")) {
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

export function getOperatorSessionFromRequest(request: Request): OperatorSession | null {
  const cookieHeader = request.headers.get("cookie");
  const token = readCookie(cookieHeader, OPERATOR_SESSION_COOKIE);
  return parseOperatorSession(token);
}

export function isAllowedRole(role: OperatorRole, allowed: OperatorRole[]): boolean {
  return allowed.includes(role);
}

export function verifyKlorApiKey(request: Request): boolean {
  const configuredKeys = splitCsv(process.env.KLOR_SYSTEM_API_KEYS);
  if (configuredKeys.length === 0) return false;
  const incoming = request.headers.get("x-klor-api-key") ?? "";
  if (!incoming) return false;
  return configuredKeys.some((key) => safeEq(incoming, key));
}

