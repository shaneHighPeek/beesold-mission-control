"use client";

import { useState } from "react";

type PortalLoginProps = {
  brokerageSlug: string;
  brokerageName: string;
  brokerageShortName?: string;
  logoUrl?: string;
  legalFooter: string;
  showBeeSoldBranding: boolean;
};

export function PortalLogin(props: PortalLoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function signInWithPassword() {
    setBusy(true);
    const response = await fetch("/api/portal/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brokerageSlug: props.brokerageSlug,
        email,
        password,
      }),
    });
    const payload = (await response.json()) as { ok: boolean; data?: { redirectTo: string }; error?: string };
    setBusy(false);

    if (!payload.ok || !payload.data) {
      setMessage(payload.error ?? "Sign-in failed");
      return;
    }

    window.location.href = payload.data.redirectTo;
  }

  async function requestMagicLink() {
    setBusy(true);
    await fetch("/api/portal/auth/request-magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brokerageSlug: props.brokerageSlug,
        email,
      }),
    });
    setBusy(false);
    setMessage("If an account exists, a fresh magic link has been sent.");
  }

  return (
    <section className="portal-auth-wrap">
      <article className="card portal-auth-card">
        <h1>{props.brokerageName} Listings Portal</h1>
        {props.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={props.logoUrl} alt={`${props.brokerageName} logo`} style={{ maxWidth: 220, height: "auto" }} />
        ) : null}
        {props.brokerageShortName ? <p className="small">Welcome to {props.brokerageShortName}</p> : null}
        <p>Complete your intake across multiple sessions. Progress saves automatically.</p>

        <label className="field">
          <span>Email</span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        <div className="row">
          <button className="primary" onClick={signInWithPassword} disabled={busy || !email || !password}>
            Sign In
          </button>
          <button className="secondary" onClick={requestMagicLink} disabled={busy || !email}>
            Send Magic Link
          </button>
        </div>

        {message ? <p className="small">{message}</p> : null}
        <p className="small">{props.legalFooter}</p>
        {props.showBeeSoldBranding ? <p className="small">Powered by BeeSold</p> : null}
      </article>
    </section>
  );
}
