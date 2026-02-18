import { fail, ok } from "@/lib/api/responses";
import { updateBrokerageSettings } from "@/lib/services/brokerageService";

export async function PATCH(
  request: Request,
  { params }: { params: { brokerageId: string } },
) {
  try {
    const body = (await request.json()) as {
      name?: string;
      shortName?: string;
      senderName?: string;
      senderEmail?: string;
      portalBaseUrl?: string;
      branding?: {
        logoUrl?: string;
        primaryColor?: string;
        secondaryColor?: string;
        legalFooter?: string;
        showBeeSoldBranding?: boolean;
        portalTone?: "corporate" | "premium_advisory";
      };
    };

    const brokerage = updateBrokerageSettings({
      brokerageId: params.brokerageId,
      ...body,
    });

    return ok({ brokerage });
  } catch (error) {
    return fail((error as Error).message);
  }
}
