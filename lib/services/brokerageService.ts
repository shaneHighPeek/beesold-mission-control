import { isPostgresDriver } from "@/lib/persistence/driver";
import {
  createBrokerage as createBrokerageMock,
  getBrokerageBySlug as getBrokerageBySlugMock,
  listBrokerages as listBrokeragesMock,
  updateBrokerage as updateBrokerageMock,
} from "@/lib/persistence/mockDb";
import {
  createBrokerageInSupabase,
  getBrokerageBySlugFromSupabase,
  listBrokeragesFromSupabase,
  updateBrokerageInSupabase,
} from "@/lib/persistence/supabaseRest";

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
    portalBaseUrl: brokerage.portalBaseUrl,
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
    portalBaseUrl: item.portalBaseUrl,
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
  portalBaseUrl?: string;
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
  portalBaseUrl: string;
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
