import { fail, ok } from "@/lib/api/responses";
import { getOperatorSessionFromRequest } from "@/lib/security/operatorAccess";

export async function GET(request: Request) {
  const session = getOperatorSessionFromRequest(request);
  if (!session) return fail("Unauthorized", 401);
  return ok({
    email: session.email,
    role: session.role,
  });
}

