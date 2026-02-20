import { fail, ok } from "@/lib/api/responses";
import { requireOperatorAccess } from "@/lib/api/operatorAuth";
import { updateBrokerageSettings } from "@/lib/services/brokerageService";

export async function PATCH(
  request: Request,
  { params }: { params: { brokerageId: string } },
) {
  const auth = requireOperatorAccess(request, ["ADMIN"]);
  if (!auth.ok) return auth.response;
  try {
    const body = (await request.json()) as {
      name?: string;
      shortName?: string;
      senderName?: string;
      senderEmail?: string;
      portalBaseUrl?: string;
      driveParentFolderId?: string;
      isArchived?: boolean;
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
      brokerageId: params.brokerageId,
      ...body,
    });

    return ok({ brokerage });
  } catch (error) {
    return fail((error as Error).message);
  }
}
