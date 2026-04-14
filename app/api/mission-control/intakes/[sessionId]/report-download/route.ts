import { fail } from "@/lib/api/responses";
import { requireOperatorAccess } from "@/lib/api/operatorAuth";
import { getReport, listMissionControlIntakes } from "@/lib/services/operatorService";

function sanitizeFilePart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function GET(
  request: Request,
  { params }: { params: { sessionId: string } },
) {
  const auth = requireOperatorAccess(request, ["ADMIN", "EDITOR"]);
  if (!auth.ok) return auth.response;

  try {
    const sessionId = params.sessionId;
    const [report, sessions] = await Promise.all([
      getReport(sessionId),
      listMissionControlIntakes({ includeArchived: true }),
    ]);

    const session = sessions.find((item) => item.id === sessionId);
    if (!session) {
      return fail("Session not found", 404);
    }
    if (session.status !== "REPORT_READY" && session.status !== "APPROVED") {
      return fail("Report download is only available for REPORT_READY or APPROVED sessions.", 409);
    }
    if (!report) {
      return fail("Report is not available yet.", 404);
    }

    const content = [
      `# BeeSold Report`,
      ``,
      `- Session ID: ${session.id}`,
      `- Brokerage: ${session.brokerage.name} (${session.brokerage.slug})`,
      `- Business: ${session.client.businessName}`,
      `- Contact: ${session.client.contactName}`,
      `- Email: ${session.client.email}`,
      `- Status: ${session.status}`,
      `- Generated: ${new Date(report.updatedAt ?? report.createdAt).toLocaleString("en-AU")}`,
      ``,
      `## Report Title`,
      `${report.title}`,
      ``,
      `## Summary`,
      `${report.summary}`,
      ``,
      `## Findings`,
      ...report.findings.map((item, index) => `${index + 1}. ${item}`),
      ``,
      `## Recommendations`,
      ...report.recommendations.map((item, index) => `${index + 1}. ${item}`),
      ``,
      `## Intake Snapshot`,
      `- Completion: ${session.completionPct}% (${session.currentStep}/${session.totalSteps})`,
      `- Last Activity: ${new Date(session.lastActivityAt).toLocaleString("en-AU")}`,
      `- Drive Folder: ${session.driveFolderUrl ?? "Not linked"}`,
      ``,
      `## Missing Items`,
      ...(session.missingItems.length > 0 ? session.missingItems.map((item) => `- ${item}`) : ["- None"]),
      ``,
    ].join("\n");

    const fileName = [
      "beesold-report",
      sanitizeFilePart(session.brokerage.slug || "brokerage"),
      sanitizeFilePart(session.client.businessName || "business"),
      sanitizeFilePart(sessionId.slice(0, 8)),
    ]
      .filter(Boolean)
      .join("-")
      .concat(".md");

    return new Response(content, {
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

