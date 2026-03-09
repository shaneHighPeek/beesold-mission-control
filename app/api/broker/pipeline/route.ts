import { ok } from "@/lib/api/responses";
import { requireBrokerAccess } from "@/lib/api/brokerAuth";
import { getBrokerageTheme } from "@/lib/services/brokerageService";
import { getLatestStatusChangeBySessionId, listMissionControlIntakes } from "@/lib/services/operatorService";

export async function GET(request: Request) {
  const auth = requireBrokerAccess(request);
  if (!auth.ok) return auth.response;
  const brokerage = await getBrokerageTheme(auth.identity.brokerageSlug);

  const items = await listMissionControlIntakes({
    includeArchived: false,
    brokerageId: brokerage.id,
  });
  const statusMap = await getLatestStatusChangeBySessionId(items.map((item) => item.id));

  return ok({
    brokerage: {
      id: brokerage.id,
      slug: brokerage.slug,
      name: brokerage.name,
    },
    items: items.map((item) => ({
      ...item,
      statusEnteredAt: statusMap[item.id]?.createdAt ?? item.updatedAt ?? item.createdAt,
    })),
  });
}
