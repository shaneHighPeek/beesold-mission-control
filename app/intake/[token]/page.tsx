import Link from "next/link";

export default function LegacyIntakePage() {
  return (
    <main className="legacy-message">
      <h1>Legacy intake link</h1>
      <p>This link format has been replaced by brokerage-branded secure portal links.</p>
      <Link href="/">Return to dashboard</Link>
    </main>
  );
}
