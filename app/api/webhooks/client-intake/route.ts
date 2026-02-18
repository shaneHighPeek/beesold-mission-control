import { fail, ok } from "@/lib/api/responses";
import { createOrUpdateClientOnboarding } from "@/lib/services/onboardingService";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      brokerageSlug: string;
      businessName: string;
      contactName: string;
      email: string;
      phone?: string;
      assignedOwner?: string;
      triggerInvite?: boolean;
      idempotencyKey: string;
    };

    if (!body.idempotencyKey) {
      return fail("idempotencyKey is required", 422);
    }

    const data = createOrUpdateClientOnboarding({
      brokerageSlug: body.brokerageSlug,
      businessName: body.businessName,
      contactName: body.contactName,
      email: body.email,
      phone: body.phone,
      assignedOwner: body.assignedOwner,
      triggerInvite: body.triggerInvite ?? true,
      source: "API",
      idempotencyKey: body.idempotencyKey,
    });

    return ok(data);
  } catch (error) {
    return fail((error as Error).message);
  }
}
