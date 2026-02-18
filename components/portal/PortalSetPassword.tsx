"use client";

import { useState } from "react";

type PortalSetPasswordProps = {
  brokerageSlug: string;
  brokerageName: string;
  brokerageShortName?: string;
  logoUrl?: string;
};

export function PortalSetPassword({
  brokerageSlug,
  brokerageName,
  brokerageShortName,
  logoUrl,
}: PortalSetPasswordProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");

  async function submit() {
    if (password !== confirm) {
      setMessage("Passwords do not match");
      return;
    }

    const response = await fetch("/api/portal/auth/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brokerageSlug, password }),
    });

    const payload = (await response.json()) as { ok: boolean; data?: { redirectTo: string }; error?: string };
    if (!payload.ok || !payload.data) {
      setMessage(payload.error ?? "Unable to set password");
      return;
    }

    window.location.href = payload.data.redirectTo;
  }

  return (
    <section className="portal-auth-wrap">
      <article className="card portal-auth-card">
        <h1>{brokerageName}: Set Your Password</h1>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={`${brokerageName} logo`} style={{ maxWidth: 220, height: "auto" }} />
        ) : null}
        {brokerageShortName ? <p className="small">Secure access for {brokerageShortName}</p> : null}
        <p>This only needs to be done once. You can still use magic links whenever needed.</p>

        <label className="field">
          <span>New password</span>
          <input
            type="password"
            value={password}
            minLength={10}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        <label className="field">
          <span>Confirm password</span>
          <input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
        </label>

        <button className="primary" onClick={submit} disabled={!password || !confirm}>
          Save Password
        </button>
        {message ? <p className="small">{message}</p> : null}
      </article>
    </section>
  );
}
