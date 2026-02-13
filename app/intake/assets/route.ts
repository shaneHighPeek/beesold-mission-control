import { fail, ok } from "@/lib/api/responses";
import { addIntakeAsset } from "@/lib/services/intakeService";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      token: string;
      category: "FINANCIALS" | "LEGAL" | "PROPERTY" | "OTHER";
      fileName: string;
      mimeType: string;
      sizeBytes: number;
    };
    return ok(addIntakeAsset(body));
  } catch (error) {
    return fail((error as Error).message);
  }
}
