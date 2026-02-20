import { PortalLogin } from "@/components/portal/PortalLogin";
import { getBrokerageTheme } from "@/lib/services/brokerageService";

export const dynamic = "force-dynamic";

export default async function BrokeragePortalLoginPage({ params }: { params: { brokerageSlug: string } }) {
  const brokerage = await getBrokerageTheme(params.brokerageSlug);

  return (
    <main
      className="portal-theme"
      style={{
        ["--portal-primary" as string]: brokerage.branding.primaryColor,
        ["--portal-secondary" as string]: brokerage.branding.secondaryColor,
      }}
    >
      <PortalLogin
        brokerageSlug={brokerage.slug}
        brokerageName={brokerage.name}
        brokerageShortName={brokerage.shortName}
        logoUrl={brokerage.branding.logoUrl}
        legalFooter={brokerage.branding.legalFooter}
        showBeeSoldBranding={brokerage.branding.showBeeSoldBranding}
      />
    </main>
  );
}
