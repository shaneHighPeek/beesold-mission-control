import { IntakeClient } from "@/components/intake/IntakeClient";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PORTAL_SESSION_COOKIE, resolvePortalAuthForBrokerage } from "@/lib/services/authService";
import { getBrokerageTheme } from "@/lib/services/brokerageService";

export default async function BrokerageIntakePage({ params }: { params: { brokerageSlug: string } }) {
  try {
    await resolvePortalAuthForBrokerage({
      brokerageSlug: params.brokerageSlug,
      signedCookieValue: cookies().get(PORTAL_SESSION_COOKIE)?.value,
    });
  } catch {
    redirect(`/portal/${params.brokerageSlug}`);
  }

  const brokerage = await getBrokerageTheme(params.brokerageSlug);

  return (
    <main
      className="portal-theme"
      style={{
        ["--portal-primary" as string]: brokerage.branding.primaryColor,
        ["--portal-secondary" as string]: brokerage.branding.secondaryColor,
      }}
    >
      <div className="portal-intake-wrap">
        <section className="portal-header">
          {brokerage.branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brokerage.branding.logoUrl} alt={`${brokerage.name} logo`} style={{ maxWidth: 220, height: "auto" }} />
          ) : null}
          <h1>{brokerage.name} Intake Portal</h1>
          {brokerage.shortName ? <p className="small">{brokerage.shortName} secure client onboarding</p> : null}
          <p>Complete this in multiple sessions. Your progress is continuously saved.</p>
        </section>
        <IntakeClient brokerageSlug={params.brokerageSlug} />
        <footer className="portal-footer-note">{brokerage.branding.legalFooter}</footer>
        {brokerage.branding.showBeeSoldBranding ? <p className="portal-footer-note">Powered by BeeSold</p> : null}
      </div>
    </main>
  );
}
