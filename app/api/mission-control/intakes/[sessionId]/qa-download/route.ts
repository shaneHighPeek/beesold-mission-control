import { fail } from "@/lib/api/responses";
import { requireOperatorAccess } from "@/lib/api/operatorAuth";
import { getIntakeStepDefinitions } from "@/lib/domain/intakeConfig";
import { isPostgresDriver } from "@/lib/persistence/driver";
import {
  getBrokerageById,
  getClientById,
  getSessionById,
  getStepsForSession,
} from "@/lib/persistence/mockDb";
import {
  getBrokerageByIdFromSupabase,
  getClientByIdFromSupabase,
  getSessionByIdFromSupabase,
  getStepsForSessionFromSupabase,
} from "@/lib/persistence/supabaseRest";

function sanitizeFilePart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function formatAnswer(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map((item) => String(item)).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export async function GET(
  request: Request,
  { params }: { params: { sessionId: string } },
) {
  const auth = requireOperatorAccess(request, ["ADMIN", "EDITOR"]);
  if (!auth.ok) return auth.response;

  try {
    const sessionId = params.sessionId;

    const session = isPostgresDriver()
      ? await getSessionByIdFromSupabase(sessionId)
      : getSessionById(sessionId);
    if (!session) {
      return fail("Session not found", 404);
    }

    const [client, brokerage, steps] = isPostgresDriver()
      ? await Promise.all([
          getClientByIdFromSupabase(session.clientId),
          getBrokerageByIdFromSupabase(session.brokerageId),
          getStepsForSessionFromSupabase(session.id),
        ])
      : [getClientById(session.clientId), getBrokerageById(session.brokerageId), getStepsForSession(session.id)];

    if (!client || !brokerage) {
      return fail("Session scope invalid", 404);
    }

    const definitions = getIntakeStepDefinitions(session.intakeTemplate);
    const stepMap = new Map(steps.map((step) => [step.stepKey, step]));

    const lines: string[] = [];
    lines.push("# BeeSold Client Intake Q&A Export");
    lines.push("");
    lines.push(`- Session ID: ${session.id}`);
    lines.push(`- Brokerage: ${brokerage.name} (${brokerage.slug})`);
    lines.push(`- Business: ${client.businessName}`);
    lines.push(`- Contact: ${client.contactName}`);
    lines.push(`- Email: ${client.email}`);
    lines.push(`- Status: ${session.status}`);
    lines.push(`- Exported: ${new Date().toLocaleString("en-AU")}`);
    lines.push("");

    definitions.forEach((definition, index) => {
      const step = stepMap.get(definition.key);
      const data = step?.data ?? {};
      lines.push(`## ${index + 1}. ${definition.title}`);
      lines.push(`Step key: \`${definition.key}\``);
      lines.push("");

      definition.fields.forEach((field) => {
        const raw = data[field.name];
        const answer = formatAnswer(raw);
        if (!answer.trim()) return;
        lines.push(`- ${field.label}: ${answer}`);
      });

      const extraFields = Object.entries(data).filter(
        ([key, value]) =>
          formatAnswer(value).trim().length > 0 &&
          !definition.fields.some((field) => field.name === key),
      );
      extraFields.forEach(([key, value]) => {
        lines.push(`- ${key}: ${formatAnswer(value)}`);
      });

      if (
        definition.fields.every((field) => !formatAnswer(data[field.name]).trim()) &&
        extraFields.length === 0
      ) {
        lines.push("- (No answers captured for this step)");
      }
      lines.push("");
    });

    const fileName = [
      "beesold-intake-qa",
      sanitizeFilePart(brokerage.slug || "brokerage"),
      sanitizeFilePart(client.businessName || "business"),
      sanitizeFilePart(session.id.slice(0, 8)),
    ]
      .filter(Boolean)
      .join("-")
      .concat(".md");

    return new Response(lines.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"${fileName}\"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return fail((error as Error).message);
  }
}

