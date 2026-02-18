import { PortalSetPassword } from "@/components/portal/PortalSetPassword";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PORTAL_SESSION_COOKIE, resolvePortalAuthForBrokerage } from "@/lib/services/authService";
import { getBrokerageTheme } from "@/lib/services/brokerageService";

export default function BrokerageSetPasswordPage({ params }: { params: { brokerageSlug: string } }) {
  try {
    resolvePortalAuthForBrokerage({
      brokerageSlug: params.brokerageSlug,
      signedCookieValue: cookies().get(PORTAL_SESSION_COOKIE)?.value,
    });
  } catch {
    redirect(`/portal/${params.brokerageSlug}`);
  }

  const brokerage = getBrokerageTheme(params.brokerageSlug);

  return (
    <main
      className="portal-theme"
      style={{
        ["--portal-primary" as string]: brokerage.branding.primaryColor,
        ["--portal-secondary" as string]: brokerage.branding.secondaryColor,
      }}
    >
      <PortalSetPassword
        brokerageSlug={brokerage.slug}
        brokerageName={brokerage.name}
        brokerageShortName={brokerage.shortName}
        logoUrl={brokerage.branding.logoUrl}
      />
    </main>
  );
}
