import { fail, ok } from "@/lib/api/responses";
import { requireOperatorAccess } from "@/lib/api/operatorAuth";
import { createBrokerageSettings, listBrokerageOptions } from "@/lib/services/brokerageService";

export async function GET(request: Request) {
  const auth = requireOperatorAccess(request, ["ADMIN", "EDITOR"]);
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(request.url);
  const includeArchived = searchParams.get("includeArchived") === "true";
  return ok({ items: await listBrokerageOptions({ includeArchived }) });
}

export async function POST(request: Request) {
  const auth = requireOperatorAccess(request, ["ADMIN"]);
  if (!auth.ok) return auth.response;
  try {
    const body = (await request.json()) as {
      slug: string;
      name: string;
      shortName?: string;
      senderName: string;
      senderEmail: string;
      portalBaseUrl: string;
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

    const brokerage = await createBrokerageSettings({
      slug: body.slug,
      name: body.name,
      shortName: body.shortName,
      senderName: body.senderName,
      senderEmail: body.senderEmail,
      portalBaseUrl: body.portalBaseUrl,
      driveParentFolderId: body.driveParentFolderId,
      isArchived: body.isArchived,
      branding: body.branding,
    });

    return ok({ brokerage });
  } catch (error) {
    return fail((error as Error).message);
  }
}
