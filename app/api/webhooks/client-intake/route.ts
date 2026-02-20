import { fail, ok } from "@/lib/api/responses";
import { createOrUpdateClientOnboarding } from "@/lib/services/onboardingService";

export async function POST(request: Request) {
  const configuredSecret = process.env.WEBHOOK_SHARED_SECRET;
  if (configuredSecret) {
    const incomingSecret = request.headers.get("x-beesold-webhook-secret") ?? "";
    if (incomingSecret !== configuredSecret) {
      return fail("Unauthorized", 401);
    }
  } else if (process.env.NODE_ENV === "production") {
    return fail("Webhook secret is not configured", 500);
  }

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

    const data = await createOrUpdateClientOnboarding({
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
