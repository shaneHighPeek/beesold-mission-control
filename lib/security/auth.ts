import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";

const MAGIC_SECRET = process.env.MAGIC_LINK_SECRET ?? "dev-magic-link-secret-change-me";
const SESSION_SECRET = process.env.PORTAL_SESSION_SECRET ?? "dev-portal-session-secret-change-me";

export function createOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashMagicToken(token: string): string {
  return createHmac("sha256", MAGIC_SECRET).update(token).digest("hex");
}

export function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString("hex");
}

export function createPasswordSalt(): string {
  return randomBytes(16).toString("hex");
}

export function verifyPassword(password: string, salt: string, storedHash: string): boolean {
  const computed = Buffer.from(hashPassword(password, salt), "hex");
  const existing = Buffer.from(storedHash, "hex");
  if (computed.length !== existing.length) {
    return false;
  }
  return timingSafeEqual(computed, existing);
}

export function signPortalSession(sessionId: string): string {
  const sig = createHmac("sha256", SESSION_SECRET).update(sessionId).digest("base64url");
  return `${sessionId}.${sig}`;
}

export function verifyPortalSessionSignature(signedValue: string): string | null {
  const [sessionId, sig] = signedValue.split(".");
  if (!sessionId || !sig) {
    return null;
  }

  const expected = createHmac("sha256", SESSION_SECRET).update(sessionId).digest("base64url");
  const sigBuffer = Buffer.from(sig);
  const expectedBuffer = Buffer.from(expected);
  if (sigBuffer.length !== expectedBuffer.length) {
    return null;
  }

  return timingSafeEqual(sigBuffer, expectedBuffer) ? sessionId : null;
}
