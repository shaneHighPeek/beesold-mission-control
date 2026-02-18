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
    };

    const data = createOrUpdateClientOnboarding({
      ...body,
      source: "ADMIN",
      triggerInvite: body.triggerInvite ?? true,
    });

    return ok(data);
  } catch (error) {
    return fail((error as Error).message);
  }
}
