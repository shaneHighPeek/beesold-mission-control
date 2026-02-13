import { ok } from "@/lib/api/responses";
import { listMissionControlIntakes } from "@/lib/services/operatorService";

export async function GET() {
  return ok({ items: listMissionControlIntakes() });
}
