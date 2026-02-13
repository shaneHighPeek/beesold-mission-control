import Link from "next/link";
import { getDemoToken } from "@/lib/persistence/mockDb";

export default function HomePage() {
  const demoToken = getDemoToken();

  return (
    <main className="grid" style={{ gap: "1.5rem" }}>
      <header className="card">
        <h1>BeeSold Mission Control</h1>
        <p>
          Phase 1 foundation: secure intake, deterministic pipeline, and explicit operator
          approval gates.
        </p>
      </header>

      <section className="grid two">
        <article className="card">
          <h2>Client Intake Portal</h2>
          <p>Guided multi-step intake with autosave and resumable progress.</p>
          <Link href={`/intake/${demoToken}`}>Open Demo Intake Session</Link>
        </article>

        <article className="card">
          <h2>Mission Control Operator View</h2>
          <p>Track lifecycle status, pipeline jobs, and approve generated reports.</p>
          <Link href="/mission-control">Open Mission Control</Link>
        </article>
      </section>
    </main>
  );
}
