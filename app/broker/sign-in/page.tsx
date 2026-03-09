"use client";

import { useEffect, useState } from "react";

export default function BrokerSignInPage() {
  const [brokerageSlug, setBrokerageSlug] = useState("off-market-group");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/broker-auth/me", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = (await response.json()) as { ok: boolean };
        if (payload.ok) window.location.href = "/broker/pipeline";
      })
      .catch(() => {});
  }, []);

  async function submit() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/broker-auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brokerageSlug, email, password }),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!payload.ok) {
        setMessage(payload.error ?? "Unable to sign in");
        return;
      }
      window.location.href = "/broker/pipeline";
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "1rem", background: "#edf1ff" }}>
      <section className="card" style={{ width: "100%", maxWidth: 480 }}>
        <h1>Broker Portal Sign In</h1>
        <p className="small">Tenant-scoped access for white-label brokerages.</p>
        <label className="field">
          <span>Brokerage Slug</span>
          <input value={brokerageSlug} onChange={(event) => setBrokerageSlug(event.target.value)} />
        </label>
        <label className="field">
          <span>Email</span>
          <input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </label>
        <button
          className="primary"
          type="button"
          onClick={submit}
          disabled={busy || !brokerageSlug || !email || !password}
        >
          {busy ? "Signing in..." : "Sign In"}
        </button>
        {message ? <p className="error">{message}</p> : null}
      </section>
    </main>
  );
}
