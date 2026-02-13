import Link from "next/link";
import { AppShell } from "@/components/ui/AppShell";
import { getDemoToken } from "@/lib/persistence/mockDb";

export default function HomePage() {
  const demoToken = getDemoToken();

  return (
    <AppShell
      active="home"
      title="Hi Shane, what will we run today?"
      subtitle="Workflow-first operations for secure intake, synthesis, and operator decisions."
    >
      <section className="quick-actions">
        <Link href={`/intake/${demoToken}`} className="quick-card">
          <span className="quick-tag">Client Flow</span>
          <h3>Continue Intake Session</h3>
          <p>Guide your client through structured onboarding with autosave and validation.</p>
        </Link>

        <Link href="/mission-control" className="quick-card">
          <span className="quick-tag">Operator Flow</span>
          <h3>Open Mission Control</h3>
          <p>Review lifecycle state, inspect outputs, and approve or reject reports.</p>
        </Link>
      </section>

      <section className="highlight-panel">
        <div className="highlight-head">
          <h2>Phase 1 Intelligence Pipeline</h2>
          <span className="badge">Deterministic</span>
        </div>

        <div className="highlight-grid">
          <article className="highlight-card">
            <span>1 · Intake</span>
            <h3>Capture clean business context</h3>
            <p>Tokenized, resumable, and validated entry from clients.</p>
          </article>
          <article className="highlight-card">
            <span>2 · Klor</span>
            <h3>Synthesize listing intelligence</h3>
            <p>Deterministic transformation with traceable workflow logs.</p>
          </article>
          <article className="highlight-card">
            <span>3 · Council</span>
            <h3>Generate strategic report</h3>
            <p>Action-oriented findings and recommendation blocks for review.</p>
          </article>
          <article className="highlight-card">
            <span>4 · Approval</span>
            <h3>Human gate before publish</h3>
            <p>Operator decision controls final state transition to APPROVED.</p>
          </article>
        </div>
      </section>
    </AppShell>
  );
}
