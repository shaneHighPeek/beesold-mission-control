import { fail } from "@/lib/api/responses";
import { getBrokerageTheme } from "@/lib/services/brokerageService";

function parseDataUrl(value: string): { mimeType: string; bytes: Uint8Array } | null {
  const match = value.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const mimeType = match[1] || "application/octet-stream";
  const base64 = match[2] || "";
  try {
    return {
      mimeType,
      bytes: Buffer.from(base64, "base64"),
    };
  } catch {
    return null;
  }
}

export async function GET(
  request: Request,
  { params }: { params: { brokerageSlug: string } },
) {
  try {
    const brokerage = await getBrokerageTheme(params.brokerageSlug);
    const logoUrl = brokerage.branding.logoUrl?.trim() ?? "";
    if (!logoUrl) {
      return fail("Logo not configured", 404);
    }

    if (logoUrl.startsWith("data:")) {
      const parsed = parseDataUrl(logoUrl);
      if (!parsed) {
        return fail("Invalid logo data", 422);
      }
      return new Response(parsed.bytes, {
        status: 200,
        headers: {
          "Content-Type": parsed.mimeType,
          "Cache-Control": "public, max-age=300",
        },
      });
    }

    if (/^https?:\/\//i.test(logoUrl)) {
      return Response.redirect(logoUrl, 302);
    }

    if (logoUrl.startsWith("/")) {
      const origin = new URL(request.url).origin;
      return Response.redirect(`${origin}${logoUrl}`, 302);
    }

    return fail("Logo URL format unsupported", 422);
  } catch (error) {
    return fail((error as Error).message, 404);
  }
}

