import { fail } from "@/lib/api/responses";

export async function GET() {
  return fail("Legacy token sessions are disabled. Use brokerage portal session endpoints.", 410);
}
