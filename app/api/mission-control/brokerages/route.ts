import { ok } from "@/lib/api/responses";
import { listBrokerageOptions } from "@/lib/services/brokerageService";

export async function GET() {
  return ok({ items: listBrokerageOptions() });
}
