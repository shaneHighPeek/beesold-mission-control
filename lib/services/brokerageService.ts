import { getBrokerageBySlug, listBrokerages, updateBrokerage } from "@/lib/persistence/mockDb";

export function getBrokerageTheme(slug: string) {
  const brokerage = getBrokerageBySlug(slug);
  return {
    id: brokerage.id,
    slug: brokerage.slug,
    name: brokerage.name,
    shortName: brokerage.shortName,
    senderName: brokerage.senderName,
    senderEmail: brokerage.senderEmail,
    portalBaseUrl: brokerage.portalBaseUrl,
    branding: brokerage.branding,
  };
}

export function listBrokerageOptions() {
  return listBrokerages().map((item) => ({
    id: item.id,
    slug: item.slug,
    name: item.name,
    shortName: item.shortName,
    senderName: item.senderName,
    senderEmail: item.senderEmail,
    portalBaseUrl: item.portalBaseUrl,
    branding: item.branding,
  }));
}

export function updateBrokerageSettings(input: {
  brokerageId: string;
  name?: string;
  shortName?: string;
  senderName?: string;
  senderEmail?: string;
  portalBaseUrl?: string;
  branding?: {
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    legalFooter?: string;
    showBeeSoldBranding?: boolean;
    portalTone?: "corporate" | "premium_advisory";
  };
}) {
  return updateBrokerage(input);
}
