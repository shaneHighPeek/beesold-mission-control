import { fail, ok } from "@/lib/api/responses";
import { requireBrokerAccess } from "@/lib/api/brokerAuth";
import { createOrUpdateClientOnboarding } from "@/lib/services/onboardingService";

export async function POST(request: Request) {
  const auth = requireBrokerAccess(request);
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as {
      businessName?: string;
      contactName?: string;
      email?: string;
      phone?: string;
      assignedOwner?: string;
      triggerInvite?: boolean;
      intakeTemplate?: "OMG_V1" | "COMMERCIAL_V1";
    };

    const businessName = body.businessName?.trim() ?? "";
    const contactName = body.contactName?.trim() ?? "";
    const email = body.email?.trim().toLowerCase() ?? "";

    if (!businessName || !contactName || !email) {
      return fail("businessName, contactName, and email are required", 422);
    }

    const data = await createOrUpdateClientOnboarding({
      brokerageSlug: auth.identity.brokerageSlug,
      businessName,
      contactName,
      email,
      phone: body.phone?.trim(),
      assignedOwner: body.assignedOwner?.trim() || auth.identity.email,
      triggerInvite: body.triggerInvite ?? true,
      source: "BROKER",
      intakeTemplate: body.intakeTemplate,
    });

    return ok(data);
  } catch (error) {
    return fail((error as Error).message);
  }
}
