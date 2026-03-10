import { resolveCname, resolveTxt } from "dns/promises";
import { getBrokerageTheme, updateBrokerageSettings } from "@/lib/services/brokerageService";

type EmailProvider = "postmark" | "sendgrid" | "stub";

function getEmailProvider(): EmailProvider {
  const value = (process.env.EMAIL_PROVIDER ?? "stub").toLowerCase();
  if (value === "postmark") return "postmark";
  if (value === "sendgrid") return "sendgrid";
  return "stub";
}

function getSpfInclude(provider: EmailProvider): string {
  if (provider === "postmark") return "spf.mtasv.net";
  if (provider === "sendgrid") return "sendgrid.net";
  return "spf.beesold.local";
}

function getDkimSelectors(provider: EmailProvider): string[] {
  const raw = process.env.EMAIL_DOMAIN_DKIM_SELECTORS;
  if (raw) {
    const parsed = raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (parsed.length > 0) return parsed;
  }
  if (provider === "postmark") return [];
  if (provider === "sendgrid") return ["s1._domainkey", "s2._domainkey"];
  return ["default._domainkey"];
}

function getPostmarkReturnPath(): { prefix: string; target: string } {
  return {
    prefix: process.env.POSTMARK_RETURN_PATH_PREFIX?.trim() || "pm-bounces",
    target: process.env.POSTMARK_RETURN_PATH_TARGET?.trim() || "pm.mtasv.net",
  };
}

function normalizeDomain(value: string): string {
  return value.trim().toLowerCase();
}

async function hasTxtContains(host: string, fragment: string): Promise<boolean> {
  try {
    const rows = await resolveTxt(host);
    return rows.some((row) => row.join("").toLowerCase().includes(fragment.toLowerCase()));
  } catch {
    return false;
  }
}

async function hasTxtStartsWith(host: string, prefix: string): Promise<boolean> {
  try {
    const rows = await resolveTxt(host);
    return rows.some((row) => row.join("").toLowerCase().startsWith(prefix.toLowerCase()));
  } catch {
    return false;
  }
}

async function hasDkimRecord(host: string): Promise<boolean> {
  try {
    const txtRows = await resolveTxt(host);
    const txtOk = txtRows.some((row) => {
      const value = row.join("").toLowerCase();
      // Some providers publish "v=DKIM1; ..." while others provide "k=rsa; p=...".
      const hasCanonical = value.includes("v=dkim1");
      const hasRsaPayload = value.includes("k=rsa") && value.includes("p=");
      return hasCanonical || hasRsaPayload;
    });
    if (txtOk) return true;
  } catch {
    // ignore and fallback to CNAME check
  }

  try {
    const cnames = await resolveCname(host);
    return cnames.length > 0;
  } catch {
    return false;
  }
}

async function hasCnameRecord(host: string, expectedTarget: string): Promise<boolean> {
  try {
    const cnames = await resolveCname(host);
    const normalizedExpected = expectedTarget.replace(/\.$/, "").toLowerCase();
    return cnames.some((record) => record.replace(/\.$/, "").toLowerCase() === normalizedExpected);
  } catch {
    return false;
  }
}

export function getEmailDomainInstructions(domain: string): {
  provider: EmailProvider;
  spf: { host: string; type: "TXT"; value: string; required: boolean };
  dmarc: { host: string; type: "TXT"; value: string };
  returnPath?: { host: string; type: "CNAME"; value: string; required: boolean };
  dkim: Array<{ host: string; type: "CNAME/TXT"; valueHint: string }>;
} {
  const provider = getEmailProvider();
  const spfInclude = getSpfInclude(provider);
  const dkimSelectors = getDkimSelectors(provider);
  const postmarkReturnPath = getPostmarkReturnPath();
  const hasCustomSelectors = Boolean(process.env.EMAIL_DOMAIN_DKIM_SELECTORS?.trim());

  return {
    provider,
    spf: {
      host: domain,
      type: "TXT",
      value: `v=spf1 include:${spfInclude} ~all`,
      required: provider !== "postmark",
    },
    dmarc: {
      host: `_dmarc.${domain}`,
      type: "TXT",
      value: `v=DMARC1; p=none; rua=mailto:postmaster@${domain}`,
    },
    returnPath:
      provider === "postmark"
        ? {
            host: `${postmarkReturnPath.prefix}.${domain}`,
            type: "CNAME",
            value: postmarkReturnPath.target,
            required: true,
          }
        : undefined,
    dkim:
      provider === "postmark" && !hasCustomSelectors
        ? [
            {
              host: "<from-postmark-dkim-host>." + domain,
              type: "CNAME/TXT",
              valueHint:
                "Use the exact DKIM host/value shown in Postmark. If selector is dynamic, set EMAIL_DOMAIN_DKIM_SELECTORS to match for strict verification.",
            },
          ]
        : dkimSelectors.map((selector) => ({
            host: `${selector}.${domain}`,
            type: "CNAME/TXT",
            valueHint: "Provider-generated DKIM value/target from email provider dashboard",
          })),
  };
}

export async function getBrokerSenderDomainSetup(input: {
  brokerageId: string;
  brokerageSlug: string;
}): Promise<{
  domain: string;
  brokerage: Awaited<ReturnType<typeof getBrokerageTheme>>;
  instructions: ReturnType<typeof getEmailDomainInstructions>;
}> {
  const brokerage = await getBrokerageTheme(input.brokerageSlug);
  if (brokerage.id !== input.brokerageId) {
    throw new Error("Cross-tenant access denied");
  }
  const senderEmail = brokerage.senderEmail?.trim().toLowerCase() ?? "";
  const domain = normalizeDomain(senderEmail.split("@")[1] ?? "");
  if (!domain) {
    throw new Error("Sender email is invalid. Save a valid sender email first.");
  }
  return {
    domain,
    brokerage,
    instructions: getEmailDomainInstructions(domain),
  };
}

export async function verifyBrokerSenderDomain(input: {
  brokerageId: string;
  brokerageSlug: string;
}): Promise<{
  domain: string;
  checks: {
    spfVerified: boolean;
    spfRequired: boolean;
    dmarcVerified: boolean;
    dkimVerified: boolean;
    returnPathVerified: boolean;
  };
  brokerage: Awaited<ReturnType<typeof getBrokerageTheme>>;
  instructions: ReturnType<typeof getEmailDomainInstructions>;
}> {
  const brokerage = await getBrokerageTheme(input.brokerageSlug);
  if (brokerage.id !== input.brokerageId) {
    throw new Error("Cross-tenant access denied");
  }
  const senderEmail = brokerage.senderEmail?.trim().toLowerCase() ?? "";
  const domain = normalizeDomain(senderEmail.split("@")[1] ?? "");
  if (!domain) {
    throw new Error("Sender email is invalid. Save a valid sender email first.");
  }

  const provider = getEmailProvider();
  const spfInclude = getSpfInclude(provider);
  const dkimSelectors = getDkimSelectors(provider);
  const instructions = getEmailDomainInstructions(domain);
  const spfRequired = instructions.spf.required;
  const returnPath = getPostmarkReturnPath();
  const returnPathHost = `${returnPath.prefix}.${domain}`;
  const [spfVerified, dmarcVerified, dkimChecks, returnPathVerified] = await Promise.all([
    hasTxtContains(domain, spfInclude),
    hasTxtStartsWith(`_dmarc.${domain}`, "v=dmarc1"),
    Promise.all(dkimSelectors.map((selector) => hasDkimRecord(`${selector}.${domain}`))),
    provider === "postmark" ? hasCnameRecord(returnPathHost, returnPath.target) : Promise.resolve(true),
  ]);

  // Postmark often uses per-domain dynamic DKIM selectors. If selectors are not explicitly configured,
  // rely on verified Return-Path + DMARC as operational proof to avoid false negatives.
  const dkimVerified = dkimSelectors.length > 0 ? dkimChecks.some(Boolean) : provider === "postmark" ? returnPathVerified : false;
  const verified = dmarcVerified && returnPathVerified && (spfRequired ? spfVerified : true) && dkimVerified;

  await updateBrokerageSettings({
    brokerageId: brokerage.id,
    senderDomain: domain,
    senderDomainStatus: verified ? "VERIFIED" : "FAILED",
    senderDomainVerifiedAt: verified ? new Date().toISOString() : "",
  });
  const refreshed = await getBrokerageTheme(input.brokerageSlug);

  return {
    domain,
    checks: { spfVerified, spfRequired, dmarcVerified, dkimVerified, returnPathVerified },
    brokerage: refreshed,
    instructions,
  };
}
