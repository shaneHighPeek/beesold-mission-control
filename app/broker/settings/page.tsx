"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

type BrokerageTheme = {
  id: string;
  slug: string;
  name: string;
  shortName?: string;
  senderName: string;
  senderEmail: string;
  portalBaseUrl: string;
  branding: {
    logoUrl?: string;
    primaryColor: string;
    secondaryColor: string;
    legalFooter: string;
  };
};

export default function BrokerSettingsPage() {
  const [brokerage, setBrokerage] = useState<BrokerageTheme | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    shortName: "",
    senderName: "",
    senderEmail: "",
    portalBaseUrl: "",
    logoUrl: "",
    primaryColor: "#113968",
    secondaryColor: "#d4932e",
    legalFooter: "",
  });
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/broker-auth/me", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          window.location.href = "/broker/sign-in";
          return null;
        }
        return (await response.json()) as { ok: boolean };
      })
      .then((payload) => {
        if (!payload?.ok) window.location.href = "/broker/sign-in";
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/broker/brokerage", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          window.location.href = "/broker/sign-in";
          return null;
        }
        return (await response.json()) as {
          ok: boolean;
          data?: { brokerage: BrokerageTheme };
          error?: string;
        };
      })
      .then((payload) => {
        if (!payload?.ok || !payload.data) {
          setMessage(payload?.error ?? "Unable to load brokerage settings.");
          return;
        }
        const item = payload.data.brokerage;
        setBrokerage(item);
        setForm({
          name: item.name,
          shortName: item.shortName ?? "",
          senderName: item.senderName,
          senderEmail: item.senderEmail,
          portalBaseUrl: item.portalBaseUrl,
          logoUrl: item.branding.logoUrl ?? "",
          primaryColor: item.branding.primaryColor,
          secondaryColor: item.branding.secondaryColor,
          legalFooter: item.branding.legalFooter,
        });
      })
      .catch(() => setMessage("Unable to load brokerage settings."));
  }, []);

  async function signOut() {
    await fetch("/api/broker-auth/sign-out", { method: "POST" });
    window.location.href = "/broker/sign-in";
  }

  async function saveSettings() {
    if (!brokerage) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/broker/brokerage", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          shortName: form.shortName.trim() || undefined,
          senderName: form.senderName.trim(),
          senderEmail: form.senderEmail.trim(),
          portalBaseUrl: form.portalBaseUrl.trim(),
          branding: {
            logoUrl: form.logoUrl.trim() || undefined,
            primaryColor: form.primaryColor,
            secondaryColor: form.secondaryColor,
            legalFooter: form.legalFooter.trim(),
          },
        }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        data?: { brokerage: BrokerageTheme };
        error?: string;
      };
      if (!payload.ok || !payload.data) {
        setMessage(payload.error ?? "Unable to save branding settings.");
        return;
      }
      setBrokerage(payload.data.brokerage);
      setMessage("Branding settings saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", padding: "1rem" }}>
      <section className="card" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
          <div>
            <h1>Broker Branding Settings</h1>
            <p className="small">Mirror of Update Brokerage fields for your white-label portal.</p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Link className="secondary" href="/broker/pipeline">
              Back to Pipeline
            </Link>
            <button className="secondary" type="button" onClick={signOut}>
              Sign Out
            </button>
          </div>
        </div>
        {message ? <p className="error">{message}</p> : null}
      </section>

      <section className="card" style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginBottom: "0.5rem" }}>Branding Details</h3>
        <p className="small" style={{ marginBottom: "0.65rem" }}>
          Update your white-label branding and sender details for portal and invite communications.
        </p>
        {!brokerage ? (
          <p className="small">Loading...</p>
        ) : (
          <div style={{ display: "grid", gap: "0.5rem", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            <label className="field">
              <span>Brokerage Name</span>
              <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
            </label>
            <label className="field">
              <span>Brokerage Slug</span>
              <input value={brokerage.slug} readOnly />
            </label>
            <label className="field">
              <span>Short Name</span>
              <input
                value={form.shortName}
                onChange={(event) => setForm((prev) => ({ ...prev, shortName: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>Sender Name</span>
              <input
                value={form.senderName}
                onChange={(event) => setForm((prev) => ({ ...prev, senderName: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>Sender Email</span>
              <input
                value={form.senderEmail}
                onChange={(event) => setForm((prev) => ({ ...prev, senderEmail: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>Portal Base URL</span>
              <input
                value={form.portalBaseUrl}
                onChange={(event) => setForm((prev) => ({ ...prev, portalBaseUrl: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>Logo URL</span>
              <input
                value={form.logoUrl}
                onChange={(event) => setForm((prev) => ({ ...prev, logoUrl: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>Primary Color</span>
              <input
                type="color"
                value={form.primaryColor}
                onChange={(event) => setForm((prev) => ({ ...prev, primaryColor: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>Secondary Color</span>
              <input
                type="color"
                value={form.secondaryColor}
                onChange={(event) => setForm((prev) => ({ ...prev, secondaryColor: event.target.value }))}
              />
            </label>
            <label className="field" style={{ gridColumn: "1 / -1" }}>
              <span>Legal Footer</span>
              <textarea
                value={form.legalFooter}
                onChange={(event) => setForm((prev) => ({ ...prev, legalFooter: event.target.value }))}
                rows={4}
              />
            </label>
          </div>
        )}
        <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
          <button className="primary" type="button" onClick={saveSettings} disabled={!brokerage || saving}>
            {saving ? "Saving..." : "Save Branding"}
          </button>
          {brokerage ? (
            <a
              className="secondary"
              href={`/portal/${brokerage.slug}?t=${Date.now()}`}
              target="_blank"
              rel="noreferrer"
            >
              Open Client Portal
            </a>
          ) : null}
        </div>
      </section>

      <section className="card" style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginBottom: "0.5rem" }}>Client Portal Preview</h3>
        <p className="small" style={{ marginBottom: "0.65rem" }}>
          Preview reflects your current settings form values. Save first, then open client portal to verify live output.
        </p>
        <div
          className="portal-theme"
          style={
            {
              ["--portal-primary" as string]: form.primaryColor || "#113968",
              ["--portal-secondary" as string]: form.secondaryColor || "#d4932e",
              borderRadius: 16,
              padding: "0.75rem",
              border: "1px solid #d7def5",
            } as CSSProperties
          }
        >
          <section className="portal-auth-wrap" style={{ minHeight: 0, padding: "0.25rem" }}>
            <article className="card portal-auth-card" style={{ margin: 0, width: "100%" }}>
              <h1>{form.name || "Brokerage"} Listings Portal</h1>
              {form.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.logoUrl} alt={`${form.name || "Brokerage"} logo`} style={{ maxWidth: 220, height: "auto" }} />
              ) : null}
              {form.shortName ? <p className="small">Welcome to {form.shortName}</p> : null}
              <p>Complete your intake across multiple sessions. Progress saves automatically.</p>
              <p className="small">{form.legalFooter || "Confidential and intended only for authorized clients."}</p>
            </article>
          </section>
        </div>
      </section>
    </main>
  );
}
