import { fail, ok } from "@/lib/api/responses";
import { requireOperatorAccess } from "@/lib/api/operatorAuth";
import { getPersistenceDriver } from "@/lib/persistence/driver";
import { checkSupabaseConnectivity } from "@/lib/persistence/supabaseRest";

export async function GET(request: Request) {
  const auth = requireOperatorAccess(request, ["ADMIN"]);
  if (!auth.ok) return auth.response;
  const driver = getPersistenceDriver();

  if (driver !== "postgres") {
    return ok({
      driver,
      active: "mock",
      message: "Set PERSISTENCE_DRIVER=postgres to run Supabase-backed checks.",
    });
  }

  try {
    const result = await checkSupabaseConnectivity();
    return ok({
      driver,
      active: "postgres",
      supabase: result,
    });
  } catch (error) {
    return fail((error as Error).message);
  }
}
