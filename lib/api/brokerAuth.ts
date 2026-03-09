import { fail } from "@/lib/api/responses";
import { getBrokerSessionFromRequest } from "@/lib/security/brokerAccess";

type AuthOk = {
  ok: true;
  identity: {
    email: string;
    brokerageId: string;
    brokerageSlug: string;
    brokerageName: string;
  };
};

type AuthFail = {
  ok: false;
  response: Response;
};

export function requireBrokerAccess(request: Request): AuthOk | AuthFail {
  const session = getBrokerSessionFromRequest(request);
  if (!session) {
    return {
      ok: false,
      response: fail("Unauthorized", 401),
    };
  }
  return {
    ok: true,
    identity: {
      email: session.email,
      brokerageId: session.brokerageId,
      brokerageSlug: session.brokerageSlug,
      brokerageName: session.brokerageName,
    },
  };
}
