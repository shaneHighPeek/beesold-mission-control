import { resolveCname, resolveTxt } from "dns/promises";
import {
  generateDomainVerificationToken,
  getBrokerageTheme,
  getDomainDnsInstructions,
  normalizeCustomDomain,
  updateBrokerageSettings,
} from "@/lib/services/brokerageService";

export async function configureBrokerCustomDomain(input: {
  brokerageId: string;
  brokerageSlug: string;
  customDomain: string;
}) {
  const normalizedDomain = normalizeCustomDomain(input.customDomain);
  if (!normalizedDomain) {
    throw new Error("Custom domain is required");
  }
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalizedDomain)) {
    throw new Error("Custom domain format is invalid");
  }

  const token = generateDomainVerificationToken(normalizedDomain, input.brokerageId);
  const updated = await updateBrokerageSettings({
    brokerageId: input.brokerageId,
    customDomain: normalizedDomain,
    domainStatus: "PENDING",
    domainVerificationToken: token,
    domainVerifiedAt: "",
  });

  return {
    brokerage: updated,
    dns: getDomainDnsInstructions(normalizedDomain, token),
  };
}

export async function clearBrokerCustomDomain(input: { brokerageId: string }) {
  const updated = await updateBrokerageSettings({
    brokerageId: input.brokerageId,
    customDomain: "",
    domainStatus: "NOT_CONFIGURED",
    domainVerificationToken: "",
    domainVerifiedAt: "",
  });
  return { brokerage: updated };
}

async function hasTxtRecord(host: string, value: string): Promise<boolean> {
  try {
    const records = await resolveTxt(host);
    return records.some((entry) => entry.join("").trim() === value);
  } catch {
    return false;
  }
}

async function hasCnameRecord(host: string, target: string): Promise<boolean> {
  try {
    const records = await resolveCname(host);
    const normalizedTarget = target.replace(/\.$/, "").toLowerCase();
    return records.some((record) => record.replace(/\.$/, "").toLowerCase() === normalizedTarget);
  } catch {
    return false;
  }
}

async function checkTlsReachable(domain: string): Promise<boolean> {
  try {
    const response = await fetch(`https://${domain}`, {
      method: "HEAD",
      redirect: "follow",
      cache: "no-store",
    });
    return response.ok || response.status < 500;
  } catch {
    return false;
  }
}

export async function verifyBrokerCustomDomain(input: { brokerageId: string; brokerageSlug: string }) {
  const brokerage = await getBrokerageTheme(input.brokerageSlug);
  if (brokerage.id !== input.brokerageId) {
    throw new Error("Cross-tenant access denied");
  }
  if (!brokerage.customDomain || !brokerage.domainVerificationToken) {
    throw new Error("Custom domain is not configured");
  }

  const dns = getDomainDnsInstructions(brokerage.customDomain, brokerage.domainVerificationToken);
  const [txtVerified, cnameVerified, tlsReachable] = await Promise.all([
    hasTxtRecord(dns.verificationHost, dns.verificationValue),
    hasCnameRecord(dns.cnameHost, dns.cnameTarget),
    checkTlsReachable(brokerage.customDomain),
  ]);

  const verified = txtVerified && cnameVerified;
  const status = verified ? "VERIFIED" : "FAILED";

  const updated = await updateBrokerageSettings({
    brokerageId: brokerage.id,
    domainStatus: status,
    domainVerifiedAt: verified ? new Date().toISOString() : "",
  });

  return {
    brokerage: updated,
    checks: {
      txtVerified,
      cnameVerified,
      tlsReachable,
    },
    dns,
  };
}
