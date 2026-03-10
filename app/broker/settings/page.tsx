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
  senderDomain?: string;
  senderDomainStatus: "NOT_CONFIGURED" | "PENDING" | "VERIFIED" | "FAILED";
  senderDomainVerifiedAt?: string;
  portalBaseUrl: string;
  customDomain?: string;
  domainStatus: "NOT_CONFIGURED" | "PENDING" | "VERIFIED" | "FAILED";
  domainVerificationToken?: string;
  domainVerifiedAt?: string;
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
  const [domainBusy, setDomainBusy] = useState(false);
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
  const [domainInput, setDomainInput] = useState("");
  const [dnsInstructions, setDnsInstructions] = useState<{
    verificationHost: string;
    verificationType: "TXT";
    verificationValue: string;
    cnameHost: string;
    cnameType: "CNAME";
    cnameTarget: string;
  } | null>(null);
  const [emailInstructions, setEmailInstructions] = useState<{
    provider: "postmark" | "sendgrid" | "stub";
    spf: { host: string; type: "TXT"; value: string; required: boolean };
    dmarc: { host: string; type: "TXT"; value: string };
    returnPath?: { host: string; type: "CNAME"; value: string; required: boolean };
    dkim: Array<{ host: string; type: "CNAME/TXT"; valueHint: string }>;
  } | null>(null);
  const [emailChecks, setEmailChecks] = useState<{
    spfVerified: boolean;
    spfRequired: boolean;
    dmarcVerified: boolean;
    dkimVerified: boolean;
    returnPathVerified: boolean;
  } | null>(null);
  const [domainChecks, setDomainChecks] = useState<{
    txtVerified: boolean;
    cnameVerified: boolean;
    tlsReachable: boolean;
  } | null>(null);
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
        setDomainInput(item.customDomain ?? "");
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

  useEffect(() => {
    if (!brokerage) return;
    fetch("/api/broker/brokerage/email-domain", { cache: "no-store" })
      .then((response) => response.json() as Promise<{
        ok: boolean;
        data?: {
          instructions: {
            provider: "postmark" | "sendgrid" | "stub";
            spf: { host: string; type: "TXT"; value: string; required: boolean };
            dmarc: { host: string; type: "TXT"; value: string };
            returnPath?: { host: string; type: "CNAME"; value: string; required: boolean };
            dkim: Array<{ host: string; type: "CNAME/TXT"; valueHint: string }>;
          };
        };
      }>)
      .then((payload) => {
        if (payload.ok && payload.data) {
          setEmailInstructions(payload.data.instructions);
        }
      })
      .catch(() => {});
  }, [brokerage?.id, brokerage?.senderEmail]);

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

  async function configureDomain() {
    if (!brokerage) return;
    setDomainBusy(true);
    setMessage("");
    setDomainChecks(null);
    try {
      const response = await fetch("/api/broker/brokerage/domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customDomain: domainInput }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        data?: {
          brokerage: BrokerageTheme;
          dns: {
            verificationHost: string;
            verificationType: "TXT";
            verificationValue: string;
            cnameHost: string;
            cnameType: "CNAME";
            cnameTarget: string;
          };
        };
        error?: string;
      };
      if (!payload.ok || !payload.data) {
        setMessage(payload.error ?? "Unable to configure custom domain.");
        return;
      }
      setBrokerage(payload.data.brokerage);
      setDnsInstructions(payload.data.dns);
      setMessage("Custom domain configured. Add DNS records, then click Verify DNS.");
    } finally {
      setDomainBusy(false);
    }
  }

  async function verifyDomain() {
    if (!brokerage) return;
    setDomainBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/broker/brokerage/domain/verify", {
        method: "POST",
      });
      const payload = (await response.json()) as {
        ok: boolean;
        data?: {
          brokerage: BrokerageTheme;
          checks: {
            txtVerified: boolean;
            cnameVerified: boolean;
            tlsReachable: boolean;
          };
          dns: {
            verificationHost: string;
            verificationType: "TXT";
            verificationValue: string;
            cnameHost: string;
            cnameType: "CNAME";
            cnameTarget: string;
          };
        };
        error?: string;
      };
      if (!payload.ok || !payload.data) {
        setMessage(payload.error ?? "Unable to verify DNS records.");
        return;
      }
      setBrokerage(payload.data.brokerage);
      setDnsInstructions(payload.data.dns);
      setDomainChecks(payload.data.checks);
      setMessage(
        payload.data.brokerage.domainStatus === "VERIFIED"
          ? "Domain verified successfully."
          : "Domain verification failed. Check DNS records and retry.",
      );
    } finally {
      setDomainBusy(false);
    }
  }

  async function clearDomain() {
    if (!brokerage) return;
    setDomainBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/broker/brokerage/domain", {
        method: "DELETE",
      });
      const payload = (await response.json()) as {
        ok: boolean;
        data?: {
          brokerage: BrokerageTheme;
        };
        error?: string;
      };
      if (!payload.ok || !payload.data) {
        setMessage(payload.error ?? "Unable to clear custom domain.");
        return;
      }
      setBrokerage(payload.data.brokerage);
      setDomainInput("");
      setDnsInstructions(null);
      setDomainChecks(null);
      setMessage("Custom domain cleared.");
    } finally {
      setDomainBusy(false);
    }
  }

  async function verifyEmailDomain() {
    if (!brokerage) return;
    setDomainBusy(true);
    setMessage("");
    setEmailChecks(null);
    try {
      const response = await fetch("/api/broker/brokerage/email-domain/verify", { method: "POST" });
      const payload = (await response.json()) as {
        ok: boolean;
        data?: {
          brokerage: BrokerageTheme;
          checks: {
            spfVerified: boolean;
            spfRequired: boolean;
            dmarcVerified: boolean;
            dkimVerified: boolean;
            returnPathVerified: boolean;
          };
          instructions: {
            provider: "postmark" | "sendgrid" | "stub";
            spf: { host: string; type: "TXT"; value: string; required: boolean };
            dmarc: { host: string; type: "TXT"; value: string };
            returnPath?: { host: string; type: "CNAME"; value: string; required: boolean };
            dkim: Array<{ host: string; type: "CNAME/TXT"; valueHint: string }>;
          };
        };
        error?: string;
      };
      if (!payload.ok || !payload.data) {
        setMessage(payload.error ?? "Unable to verify sender domain.");
        return;
      }
      setBrokerage(payload.data.brokerage);
      setEmailChecks(payload.data.checks);
      setEmailInstructions(payload.data.instructions);
      setMessage(
        payload.data.brokerage.senderDomainStatus === "VERIFIED"
          ? "Sender domain verified."
          : "Sender domain verification failed. Review DMARC, Return-Path, and DKIM records.",
      );
    } finally {
      setDomainBusy(false);
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
        <h3 style={{ marginBottom: "0.5rem" }}>Branded Email Domain</h3>
        <p className="small" style={{ marginBottom: "0.65rem" }}>
          Verify your sender DNS so invites send from your branded email domain. Update <strong>Sender Email</strong> in{" "}
          <a href="#branding-details">Branding Details</a>, then click <strong>Save Branding</strong> before verifying.
        </p>
        <div style={{ display: "grid", gap: "0.5rem", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          <label className="field">
            <span>Sender Email</span>
            <input value={form.senderEmail} readOnly />
          </label>
          <label className="field">
            <span>Sender Domain</span>
            <input value={brokerage?.senderDomain ?? ""} readOnly />
          </label>
          <label className="field">
            <span>Verification Status</span>
            <input value={brokerage?.senderDomainStatus ?? "NOT_CONFIGURED"} readOnly />
          </label>
          <label className="field">
            <span>Verified At</span>
            <input value={brokerage?.senderDomainVerifiedAt ?? ""} readOnly />
          </label>
        </div>
        <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button className="secondary" type="button" onClick={verifyEmailDomain} disabled={domainBusy || !brokerage}>
            Verify Sender DNS
          </button>
        </div>
        {emailInstructions ? (
          <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.5rem" }}>
            <p className="small">
              Provider: <strong>{emailInstructions.provider}</strong>. Configure these DNS records in your DNS provider.
            </p>
            <div className="card" style={{ borderRadius: 12 }}>
              <p className="small"><strong>{emailInstructions.spf.type}</strong> {emailInstructions.spf.host}</p>
              <p className="small">{emailInstructions.spf.value}</p>
              <p className="small">
                {emailInstructions.spf.required
                  ? "Required"
                  : "Optional for Postmark subdomain mode (recommended for alignment)."}
              </p>
            </div>
            <div className="card" style={{ borderRadius: 12 }}>
              <p className="small"><strong>{emailInstructions.dmarc.type}</strong> {emailInstructions.dmarc.host}</p>
              <p className="small">{emailInstructions.dmarc.value}</p>
            </div>
            {emailInstructions.returnPath ? (
              <div className="card" style={{ borderRadius: 12 }}>
                <p className="small"><strong>{emailInstructions.returnPath.type}</strong> {emailInstructions.returnPath.host}</p>
                <p className="small">{emailInstructions.returnPath.value}</p>
              </div>
            ) : null}
            {emailInstructions.dkim.map((record) => (
              <div key={record.host} className="card" style={{ borderRadius: 12 }}>
                <p className="small"><strong>{record.type}</strong> {record.host}</p>
                <p className="small">{record.valueHint}</p>
              </div>
            ))}
          </div>
        ) : null}
        {emailChecks ? (
          <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.25rem" }}>
            <p className="small">
              SPF{emailChecks.spfRequired ? "" : " (optional)"}: {emailChecks.spfVerified ? "PASS" : "FAIL"}
            </p>
            <p className="small">DMARC: {emailChecks.dmarcVerified ? "PASS" : "FAIL"}</p>
            <p className="small">Return-Path: {emailChecks.returnPathVerified ? "PASS" : "FAIL"}</p>
            <p className="small">DKIM: {emailChecks.dkimVerified ? "PASS" : "FAIL"}</p>
          </div>
        ) : null}
      </section>

      <section id="branding-details" className="card" style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginBottom: "0.5rem" }}>Custom Domain and DNS</h3>
        <p className="small" style={{ marginBottom: "0.65rem" }}>
          Configure your white-label domain (for example `portal.yourbrokerage.com`) and verify DNS ownership.
        </p>
        <div style={{ display: "grid", gap: "0.5rem", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          <label className="field">
            <span>Custom Domain</span>
            <input value={domainInput} onChange={(event) => setDomainInput(event.target.value)} placeholder="portal.example.com" />
          </label>
          <label className="field">
            <span>Status</span>
            <input value={brokerage?.domainStatus ?? "NOT_CONFIGURED"} readOnly />
          </label>
          <label className="field">
            <span>Verified At</span>
            <input value={brokerage?.domainVerifiedAt ?? ""} readOnly />
          </label>
        </div>
        <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            className="primary"
            type="button"
            onClick={configureDomain}
            disabled={domainBusy || !domainInput.trim()}
          >
            {domainBusy ? "Working..." : "Save Domain"}
          </button>
          <button className="secondary" type="button" onClick={verifyDomain} disabled={domainBusy || !brokerage?.customDomain}>
            Verify DNS
          </button>
          <button className="secondary" type="button" onClick={clearDomain} disabled={domainBusy || !brokerage?.customDomain}>
            Clear Domain
          </button>
          {brokerage?.customDomain && brokerage.domainStatus === "VERIFIED" ? (
            <a className="secondary" href={`https://${brokerage.customDomain}`} target="_blank" rel="noreferrer">
              Open Custom Domain
            </a>
          ) : null}
        </div>
        {dnsInstructions ? (
          <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.5rem" }}>
            <p className="small">
              Add these DNS records at your DNS provider, wait for propagation, then click <strong>Verify DNS</strong>.
            </p>
            <div className="card" style={{ borderRadius: 12 }}>
              <p className="small"><strong>{dnsInstructions.verificationType}</strong> {dnsInstructions.verificationHost}</p>
              <p className="small">{dnsInstructions.verificationValue}</p>
            </div>
            <div className="card" style={{ borderRadius: 12 }}>
              <p className="small"><strong>{dnsInstructions.cnameType}</strong> {dnsInstructions.cnameHost}</p>
              <p className="small">{dnsInstructions.cnameTarget}</p>
            </div>
          </div>
        ) : null}
        {domainChecks ? (
          <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.25rem" }}>
            <p className="small">TXT verification: {domainChecks.txtVerified ? "PASS" : "FAIL"}</p>
            <p className="small">CNAME verification: {domainChecks.cnameVerified ? "PASS" : "FAIL"}</p>
            <p className="small">TLS reachable: {domainChecks.tlsReachable ? "PASS" : "FAIL"}</p>
          </div>
        ) : null}
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
