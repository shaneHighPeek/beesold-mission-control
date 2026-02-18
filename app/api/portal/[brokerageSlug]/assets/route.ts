import { fail, ok } from "@/lib/api/responses";
import { PORTAL_SESSION_COOKIE } from "@/lib/services/authService";
import { addAssetToSession } from "@/lib/services/intakeService";
import { cookies } from "next/headers";

export async function POST(request: Request, { params }: { params: { brokerageSlug: string } }) {
  try {
    const body = (await request.json()) as {
      category: "FINANCIALS" | "LEGAL" | "PROPERTY" | "OTHER";
      fileName: string;
      mimeType: string;
      sizeBytes: number;
    };

    const asset = addAssetToSession({
      brokerageSlug: params.brokerageSlug,
      signedCookieValue: cookies().get(PORTAL_SESSION_COOKIE)?.value,
      category: body.category,
      fileName: body.fileName,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
    });

    return ok(asset);
  } catch (error) {
    return fail((error as Error).message, 401);
  }
}
