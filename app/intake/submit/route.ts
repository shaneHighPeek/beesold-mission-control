import { fail } from "@/lib/api/responses";

export async function POST() {
  return fail("Legacy intake endpoint disabled. Use /api/portal/[brokerageSlug]/submit-final.", 410);
}
