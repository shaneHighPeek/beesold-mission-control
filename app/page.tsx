import Link from "next/link";
import { AppShell } from "@/components/ui/AppShell";

export default function HomePage() {
  return (
    <AppShell
      active="home"
      title="BeeSold Mission Control"
      subtitle="Brokerage-branded onboarding, secure intake sessions, and operator governance"
    >
      <section className="quick-actions">
        <Link href="/mission-control" className="quick-card">
          <span className="quick-tag">Admin Flow</span>
          <h3>Create + Invite Clients</h3>
          <p>Manual onboarding, resend invites, request missing items, and review audit trails.</p>
        </Link>

        <Link href="/portal/off-market-group" className="quick-card">
          <span className="quick-tag">Client Flow</span>
          <h3>Open OMG Branded Portal</h3>
          <p>Password and magic-link sign-in with save/resume intake sessions.</p>
        </Link>
      </section>

      <section className="highlight-panel">
        <div className="highlight-head">
          <h2>Workflow Lifecycle</h2>
          <span className="badge">Tenant Isolated</span>
        </div>

        <div className="highlight-grid">
          <article className="highlight-card">
            <span>1</span>
            <h3>Onboard</h3>
            <p>Create client via admin or webhook with idempotent update semantics.</p>
          </article>
          <article className="highlight-card">
            <span>2</span>
            <h3>Authenticate</h3>
            <p>Magic links + password sign-in with tenant-scoped portal sessions.</p>
          </article>
          <article className="highlight-card">
            <span>3</span>
            <h3>Complete Intake</h3>
            <p>Autosave, Save & Exit, partial submissions, and revision loops.</p>
          </article>
          <article className="highlight-card">
            <span>4</span>
            <h3>Operate</h3>
            <p>Mission Control tracks progress, missing items, Drive links, and audit events.</p>
          </article>
        </div>
      </section>
    </AppShell>
  );
}
