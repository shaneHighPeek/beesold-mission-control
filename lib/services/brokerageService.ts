import { isPostgresDriver } from "@/lib/persistence/driver";
import {
  createBrokerage as createBrokerageMock,
  getBrokerageByCustomDomain as getBrokerageByCustomDomainMock,
  getBrokerageBySlug as getBrokerageBySlugMock,
  listBrokerages as listBrokeragesMock,
  updateBrokerage as updateBrokerageMock,
} from "@/lib/persistence/mockDb";
import {
  createBrokerageInSupabase,
  getBrokerageByCustomDomainFromSupabase,
  getBrokerageBySlugFromSupabase,
  listBrokeragesFromSupabase,
  updateBrokerageInSupabase,
} from "@/lib/persistence/supabaseRest";
import type { Brokerage } from "@/lib/domain/types";
import { createHash, randomBytes } from "crypto";

function withLogoVersion(url: string | undefined, updatedAt: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("data:")) return url;
  const stamp = encodeURIComponent(updatedAt);
  return `${url}${url.includes("?") ? "&" : "?"}v=${stamp}`;
}

export async function getBrokerageTheme(slug: string) {
  const brokerage = isPostgresDriver()
    ? await getBrokerageBySlugFromSupabase(slug)
    : getBrokerageBySlugMock(slug);
  if (!brokerage) {
    throw new Error("Brokerage not found");
  }

  return {
    id: brokerage.id,
    slug: brokerage.slug,
    name: brokerage.name,
    shortName: brokerage.shortName,
    senderName: brokerage.senderName,
    senderEmail: brokerage.senderEmail,
    senderDomain: brokerage.senderDomain,
    senderDomainStatus: brokerage.senderDomainStatus,
    senderDomainVerifiedAt: brokerage.senderDomainVerifiedAt,
    portalBaseUrl: brokerage.portalBaseUrl,
    customDomain: brokerage.customDomain,
    domainStatus: brokerage.domainStatus,
    domainVerificationToken: brokerage.domainVerificationToken,
    domainVerifiedAt: brokerage.domainVerifiedAt,
    driveParentFolderId: brokerage.driveParentFolderId,
    branding: {
      ...brokerage.branding,
      logoUrl: withLogoVersion(brokerage.branding.logoUrl, brokerage.updatedAt),
    },
  };
}

export async function listBrokerageOptions(options?: { includeArchived?: boolean }) {
  const includeArchived = options?.includeArchived ?? false;
  const brokerages = isPostgresDriver()
    ? await listBrokeragesFromSupabase(includeArchived)
    : listBrokeragesMock(includeArchived);

  return brokerages.map((item) => ({
    id: item.id,
    slug: item.slug,
    name: item.name,
    shortName: item.shortName,
    senderName: item.senderName,
    senderEmail: item.senderEmail,
    senderDomain: item.senderDomain,
    senderDomainStatus: item.senderDomainStatus,
    senderDomainVerifiedAt: item.senderDomainVerifiedAt,
    portalBaseUrl: item.portalBaseUrl,
    customDomain: item.customDomain,
    domainStatus: item.domainStatus,
    domainVerificationToken: item.domainVerificationToken,
    domainVerifiedAt: item.domainVerifiedAt,
    driveParentFolderId: item.driveParentFolderId,
    isArchived: item.isArchived,
    archivedAt: item.archivedAt,
    branding: {
      ...item.branding,
      logoUrl: withLogoVersion(item.branding.logoUrl, item.updatedAt),
    },
  }));
}

export async function updateBrokerageSettings(input: {
  brokerageId: string;
  name?: string;
  shortName?: string;
  senderName?: string;
  senderEmail?: string;
  senderDomain?: string;
  senderDomainStatus?: Brokerage["senderDomainStatus"];
  senderDomainVerifiedAt?: string;
  portalBaseUrl?: string;
  customDomain?: string;
  domainStatus?: Brokerage["domainStatus"];
  domainVerificationToken?: string;
  domainVerifiedAt?: string;
  driveParentFolderId?: string;
  isArchived?: boolean;
  branding?: {
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    legalFooter?: string;
    showBeeSoldBranding?: boolean;
    portalTone?: "corporate" | "premium_advisory";
  };
}) {
  return isPostgresDriver() ? updateBrokerageInSupabase(input) : updateBrokerageMock(input);
}

export async function createBrokerageSettings(input: {
  slug: string;
  name: string;
  shortName?: string;
  senderName: string;
  senderEmail: string;
  senderDomain?: string;
  senderDomainStatus?: Brokerage["senderDomainStatus"];
  senderDomainVerifiedAt?: string;
  portalBaseUrl: string;
  customDomain?: string;
  domainStatus?: Brokerage["domainStatus"];
  domainVerificationToken?: string;
  domainVerifiedAt?: string;
  driveParentFolderId?: string;
  isArchived?: boolean;
  branding?: {
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    legalFooter?: string;
    showBeeSoldBranding?: boolean;
    portalTone?: "corporate" | "premium_advisory";
  };
}) {
  const normalizedSlug = input.slug.trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(normalizedSlug)) {
    throw new Error("Slug must use lowercase letters, numbers, and hyphens only");
  }

  return isPostgresDriver()
    ? createBrokerageInSupabase({
        ...input,
        slug: normalizedSlug,
      })
    : createBrokerageMock({
        ...input,
        slug: normalizedSlug,
      });
}

export function normalizeCustomDomain(raw: string): string {
  return raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

export function generateDomainVerificationToken(domain: string, brokerageId: string): string {
  const nonce = randomBytes(8).toString("hex");
  const digest = createHash("sha256")
    .update(`${domain}:${brokerageId}:${nonce}`)
    .digest("hex")
    .slice(0, 24);
  return `beesold-verify-${digest}`;
}

export function getDomainDnsInstructions(domain: string, token: string): {
  verificationHost: string;
  verificationType: "TXT";
  verificationValue: string;
  cnameHost: string;
  cnameType: "CNAME";
  cnameTarget: string;
} {
  const cnameTarget = process.env.BROKER_CUSTOM_DOMAIN_CNAME_TARGET ?? "cname.vercel-dns.com";
  return {
    verificationHost: `_beesold-verify.${domain}`,
    verificationType: "TXT",
    verificationValue: token,
    cnameHost: domain,
    cnameType: "CNAME",
    cnameTarget,
  };
}

export async function getBrokerageByCustomDomain(domain: string): Promise<Brokerage | null> {
  const normalized = normalizeCustomDomain(domain);
  return isPostgresDriver()
    ? getBrokerageByCustomDomainFromSupabase(normalized)
    : getBrokerageByCustomDomainMock(normalized) ?? null;
}

export async function resolveBrokerageSlugFromHost(host: string): Promise<string | null> {
  const normalized = normalizeCustomDomain(host.split(":")[0] ?? host);
  if (!normalized) return null;
  const brokerage = await getBrokerageByCustomDomain(normalized);
  if (!brokerage) return null;
  if (brokerage.domainStatus !== "VERIFIED") return null;
  return brokerage.slug;
}
