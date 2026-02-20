import { ok } from "@/lib/api/responses";
import { requireOperatorAccess } from "@/lib/api/operatorAuth";
import { listMissionControlIntakes } from "@/lib/services/operatorService";

export async function GET(request: Request) {
  const auth = requireOperatorAccess(request, ["ADMIN", "EDITOR"]);
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(request.url);
  const includeArchived = searchParams.get("includeArchived") === "true";
  return ok({ items: await listMissionControlIntakes({ includeArchived }) });
}
