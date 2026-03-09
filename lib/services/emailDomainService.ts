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
  if (provider === "postmark") return ["pm._domainkey"];
  if (provider === "sendgrid") return ["s1._domainkey", "s2._domainkey"];
  return ["default._domainkey"];
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
    const txtOk = txtRows.some((row) => row.join("").toLowerCase().includes("v=dkim1"));
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

export function getEmailDomainInstructions(domain: string): {
  provider: EmailProvider;
  spf: { host: string; type: "TXT"; value: string };
  dmarc: { host: string; type: "TXT"; value: string };
  dkim: Array<{ host: string; type: "CNAME/TXT"; valueHint: string }>;
} {
  const provider = getEmailProvider();
  const spfInclude = getSpfInclude(provider);
  const dkimSelectors = getDkimSelectors(provider);
  return {
    provider,
    spf: {
      host: domain,
      type: "TXT",
      value: `v=spf1 include:${spfInclude} ~all`,
    },
    dmarc: {
      host: `_dmarc.${domain}`,
      type: "TXT",
      value: `v=DMARC1; p=none; rua=mailto:postmaster@${domain}`,
    },
    dkim: dkimSelectors.map((selector) => ({
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
  checks: { spfVerified: boolean; dmarcVerified: boolean; dkimVerified: boolean };
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
  const [spfVerified, dmarcVerified, dkimChecks] = await Promise.all([
    hasTxtContains(domain, spfInclude),
    hasTxtStartsWith(`_dmarc.${domain}`, "v=dmarc1"),
    Promise.all(dkimSelectors.map((selector) => hasDkimRecord(`${selector}.${domain}`))),
  ]);

  const dkimVerified = dkimChecks.some(Boolean);
  const verified = spfVerified && dmarcVerified && dkimVerified;

  await updateBrokerageSettings({
    brokerageId: brokerage.id,
    senderDomain: domain,
    senderDomainStatus: verified ? "VERIFIED" : "FAILED",
    senderDomainVerifiedAt: verified ? new Date().toISOString() : "",
  });
  const refreshed = await getBrokerageTheme(input.brokerageSlug);

  return {
    domain,
    checks: { spfVerified, dmarcVerified, dkimVerified },
    brokerage: refreshed,
    instructions: getEmailDomainInstructions(domain),
  };
}
