import { fail, ok } from "@/lib/api/responses";
import { requireBrokerAccess } from "@/lib/api/brokerAuth";
import { getBrokerageTheme, updateBrokerageSettings } from "@/lib/services/brokerageService";

export async function GET(request: Request) {
  const auth = requireBrokerAccess(request);
  if (!auth.ok) return auth.response;
  try {
    const brokerage = await getBrokerageTheme(auth.identity.brokerageSlug);
    return ok({ brokerage });
  } catch (error) {
    return fail((error as Error).message);
  }
}

export async function PATCH(request: Request) {
  const auth = requireBrokerAccess(request);
  if (!auth.ok) return auth.response;
  try {
    const body = (await request.json()) as {
      name?: string;
      shortName?: string;
      senderName?: string;
      senderEmail?: string;
      portalBaseUrl?: string;
      driveParentFolderId?: string;
      branding?: {
        logoUrl?: string;
        primaryColor?: string;
        secondaryColor?: string;
        legalFooter?: string;
        showBeeSoldBranding?: boolean;
        portalTone?: "corporate" | "premium_advisory";
      };
    };

    const brokerage = await updateBrokerageSettings({
      brokerageId: auth.identity.brokerageId,
      ...body,
    });

    return ok({ brokerage });
  } catch (error) {
    return fail((error as Error).message);
  }
}
