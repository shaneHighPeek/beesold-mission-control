import { fail, ok } from "@/lib/api/responses";
import { PORTAL_SESSION_COOKIE } from "@/lib/services/authService";
import { addAssetToSession } from "@/lib/services/intakeService";
import { cookies } from "next/headers";

export async function POST(request: Request, { params }: { params: { brokerageSlug: string } }) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let asset;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const category = String(form.get("category") ?? "OTHER") as "FINANCIALS" | "LEGAL" | "PROPERTY" | "OTHER";
      const uploaded = form.get("file");
      if (!(uploaded instanceof File)) {
        return fail("file is required", 422);
      }

      const bytes = new Uint8Array(await uploaded.arrayBuffer());

      asset = await addAssetToSession({
        brokerageSlug: params.brokerageSlug,
        signedCookieValue: cookies().get(PORTAL_SESSION_COOKIE)?.value,
        category,
        fileName: uploaded.name,
        mimeType: uploaded.type || "application/octet-stream",
        sizeBytes: uploaded.size,
        fileBytes: bytes,
      });
    } else {
      const body = (await request.json()) as {
        category: "FINANCIALS" | "LEGAL" | "PROPERTY" | "OTHER";
        fileName: string;
        mimeType: string;
        sizeBytes: number;
      };

      asset = await addAssetToSession({
        brokerageSlug: params.brokerageSlug,
        signedCookieValue: cookies().get(PORTAL_SESSION_COOKIE)?.value,
        category: body.category,
        fileName: body.fileName,
        mimeType: body.mimeType,
        sizeBytes: body.sizeBytes,
      });
    }

    return ok(asset);
  } catch (error) {
    return fail((error as Error).message, 401);
  }
}
