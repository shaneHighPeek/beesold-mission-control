"use client";

import { useState } from "react";
import { useEffect } from "react";

export default function OperatorSignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/operator-auth/me", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { ok: boolean }) => {
        if (payload.ok) window.location.href = "/mission-control";
      })
      .catch(() => {});
  }, []);

  async function submit() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/operator-auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!payload.ok) {
        setMessage(payload.error ?? "Unable to sign in");
        return;
      }
      window.location.href = "/mission-control";
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "1rem", background: "#edf1ff" }}>
      <section className="card" style={{ width: "100%", maxWidth: 480 }}>
        <h1>BeeSold Dashboard Sign In</h1>
        <p className="small">Authorized operator access only.</p>
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
        <button className="primary" type="button" onClick={submit} disabled={busy || !email || !password}>
          {busy ? "Signing in..." : "Sign In"}
        </button>
        {message ? <p className="error">{message}</p> : null}
      </section>
    </main>
  );
}
