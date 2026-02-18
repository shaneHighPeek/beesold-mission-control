import {
  addAuditLog,
  consumeMagicLink,
  createMagicLink,
  createPortalAuthSession,
  getActiveSessionByClient,
  getBrokerageById,
  getBrokerageBySlug,
  getClientByBrokerageAndEmail,
  getClientById,
  getPortalAuthSessionById,
  getSessionById,
  setClientPassword,
  setSessionLastAccess,
  touchClientActivity,
} from "@/lib/persistence/mockDb";
import {
  createPasswordSalt,
  hashPassword,
  signPortalSession,
  verifyPassword,
  verifyPortalSessionSignature,
} from "@/lib/security/auth";

export const PORTAL_SESSION_COOKIE = "beesold_portal_session";

function isExpired(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}

export function resolvePortalAuthForBrokerage(input: {
  brokerageSlug: string;
  signedCookieValue?: string;
}): {
  brokerageId: string;
  clientId: string;
  sessionId: string;
  authSessionId: string;
} {
  const brokerage = getBrokerageBySlug(input.brokerageSlug);
  if (!input.signedCookieValue) {
    throw new Error("Authentication required");
  }

  const authSessionId = verifyPortalSessionSignature(input.signedCookieValue);
  if (!authSessionId) {
    throw new Error("Session signature invalid");
  }

  const authSession = getPortalAuthSessionById(authSessionId);
  if (!authSession || isExpired(authSession.expiresAt)) {
    throw new Error("Session expired");
  }

  if (authSession.brokerageId !== brokerage.id) {
    throw new Error("Cross-tenant access denied");
  }

  const session = getSessionById(authSession.sessionId);
  if (session.brokerageId !== brokerage.id || session.clientId !== authSession.clientId) {
    throw new Error("Session scope invalid");
  }

  setSessionLastAccess(session.id);
  touchClientActivity(authSession.clientId);

  return {
    brokerageId: brokerage.id,
    clientId: authSession.clientId,
    sessionId: authSession.sessionId,
    authSessionId,
  };
}

function establishPortalSession(input: {
  sessionId: string;
  clientId: string;
  brokerageId: string;
  source: "MAGIC_LINK" | "PASSWORD";
}): { cookieValue: string; requiresPasswordSetup: boolean; brokerageSlug: string } {
  const portalSession = createPortalAuthSession({
    sessionId: input.sessionId,
    clientId: input.clientId,
    brokerageId: input.brokerageId,
  });

  const client = getClientById(input.clientId);
  const brokerage = getBrokerageById(input.brokerageId);

  addAuditLog(input.sessionId, input.brokerageId, input.clientId, "CLIENT", "PORTAL_AUTHENTICATED", {
    source: input.source,
    authSessionId: portalSession.id,
  });

  return {
    cookieValue: signPortalSession(portalSession.id),
    requiresPasswordSetup: !client.passwordHash,
    brokerageSlug: brokerage.slug,
  };
}

export function consumeMagicLinkAndAuthenticate(rawToken: string): {
  cookieValue: string;
  brokerageSlug: string;
  requiresPasswordSetup: boolean;
  sessionId: string;
} {
  const link = consumeMagicLink(rawToken);

  addAuditLog(link.sessionId, link.brokerageId, link.clientId, "CLIENT", "MAGIC_LINK_CONSUMED", {
    magicLinkId: link.id,
  });

  const auth = establishPortalSession({
    sessionId: link.sessionId,
    clientId: link.clientId,
    brokerageId: link.brokerageId,
    source: "MAGIC_LINK",
  });

  return {
    ...auth,
    sessionId: link.sessionId,
  };
}

export function setPortalPassword(input: {
  brokerageSlug: string;
  signedCookieValue?: string;
  password: string;
}): { sessionId: string; clientId: string; brokerageId: string } {
  const scope = resolvePortalAuthForBrokerage({
    brokerageSlug: input.brokerageSlug,
    signedCookieValue: input.signedCookieValue,
  });

  if (input.password.length < 10) {
    throw new Error("Password must be at least 10 characters");
  }

  const salt = createPasswordSalt();
  const hashed = hashPassword(input.password, salt);
  setClientPassword(scope.clientId, salt, hashed);

  addAuditLog(scope.sessionId, scope.brokerageId, scope.clientId, "CLIENT", "PASSWORD_SET", {});

  return scope;
}

export function authenticateWithPassword(input: {
  brokerageSlug: string;
  email: string;
  password: string;
}): { cookieValue: string; requiresPasswordSetup: boolean; brokerageSlug: string; sessionId: string } {
  const brokerage = getBrokerageBySlug(input.brokerageSlug);
  const client = getClientByBrokerageAndEmail(brokerage.id, input.email.toLowerCase());
  if (!client || !client.passwordHash || !client.passwordSalt) {
    throw new Error("Invalid email or password");
  }

  if (!verifyPassword(input.password, client.passwordSalt, client.passwordHash)) {
    throw new Error("Invalid email or password");
  }

  const intakeSession = getActiveSessionByClient(client.id);
  if (!intakeSession) {
    throw new Error("No intake session found");
  }

  addAuditLog(intakeSession.id, brokerage.id, client.id, "CLIENT", "PASSWORD_SIGN_IN", {});

  const auth = establishPortalSession({
    sessionId: intakeSession.id,
    clientId: client.id,
    brokerageId: brokerage.id,
    source: "PASSWORD",
  });

  return {
    ...auth,
    sessionId: intakeSession.id,
  };
}

export function issueMagicLinkForSession(sessionId: string): {
  rawToken: string;
  brokerageSlug: string;
  clientId: string;
} {
  const session = getSessionById(sessionId);
  const brokerage = getBrokerageById(session.brokerageId);

  const link = createMagicLink({
    sessionId: session.id,
    clientId: session.clientId,
    brokerageId: session.brokerageId,
  });

  return {
    rawToken: link.rawToken,
    brokerageSlug: brokerage.slug,
    clientId: session.clientId,
  };
}
