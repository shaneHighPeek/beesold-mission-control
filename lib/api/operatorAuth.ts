import { fail } from "@/lib/api/responses";
import {
  type OperatorRole,
  getOperatorSessionFromRequest,
  isAllowedRole,
  verifyKlorApiKey,
} from "@/lib/security/operatorAccess";

type AuthOk = {
  ok: true;
  identity: {
    email: string;
    role: OperatorRole;
  };
};

type AuthFail = {
  ok: false;
  response: Response;
};

export function requireOperatorAccess(
  request: Request,
  allowedRoles: OperatorRole[],
  options?: { allowKlorApiKey?: boolean },
): AuthOk | AuthFail {
  const session = getOperatorSessionFromRequest(request);
  if (session && isAllowedRole(session.role, allowedRoles)) {
    return {
      ok: true,
      identity: {
        email: session.email,
        role: session.role,
      },
    };
  }

  if (options?.allowKlorApiKey && verifyKlorApiKey(request) && isAllowedRole("KLOR_SYSTEM", allowedRoles)) {
    return {
      ok: true,
      identity: {
        email: "klor-system",
        role: "KLOR_SYSTEM",
      },
    };
  }

  return {
    ok: false,
    response: fail("Unauthorized", 401),
  };
}

