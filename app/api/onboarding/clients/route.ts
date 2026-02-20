import { fail, ok } from "@/lib/api/responses";
import { requireOperatorAccess } from "@/lib/api/operatorAuth";
import { createOrUpdateClientOnboarding } from "@/lib/services/onboardingService";

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  const raw = await request.text();
  if (!raw.trim()) {
    throw new Error("Request body is empty. Send JSON with -d or --data.");
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error("Invalid JSON body.");
  }
}

export async function POST(request: Request) {
  const auth = requireOperatorAccess(request, ["ADMIN"]);
  if (!auth.ok) return auth.response;
  try {
    const body = (await readJsonBody(request)) as {
      brokerageSlug: string;
      businessName: string;
      contactName: string;
      email: string;
      phone?: string;
      assignedOwner?: string;
      triggerInvite?: boolean;
    };

    const data = await createOrUpdateClientOnboarding({
      ...body,
      source: "ADMIN",
      triggerInvite: body.triggerInvite ?? true,
    });

    return ok(data);
  } catch (error) {
    return fail((error as Error).message);
  }
}
