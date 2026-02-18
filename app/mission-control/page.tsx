"use client";

import { AppShell } from "@/components/ui/AppShell";
import { useCallback, useEffect, useMemo, useState } from "react";

type IntakeStatus =
  | "INVITED"
  | "IN_PROGRESS"
  | "PARTIAL_SUBMITTED"
  | "MISSING_ITEMS_REQUESTED"
  | "FINAL_SUBMITTED"
  | "KLOR_SYNTHESIS"
  | "COUNCIL_RUNNING"
  | "REPORT_READY"
  | "APPROVED";

type IntakeItem = {
  id: string;
  brokerage: { slug: string; name: string };
  client: {
    businessName: string;
    contactName: string;
    email: string;
    phone?: string;
    assignedOwner?: string;
  };
  status: IntakeStatus;
  completionPct: number;
  currentStep: number;
  totalSteps: number;
  invitedAt?: string;
  partialSubmittedAt?: string;
  finalSubmittedAt?: string;
  lastActivityAt: string;
  missingItems: string[];
  driveFolderUrl?: string;
};

type TimelineEvent = {
  id: string;
  actor: string;
  action: string;
  createdAt: string;
  details: Record<string, unknown>;
};

type DevInvite = {
  id: string;
  createdAt: string;
  to: string;
  businessName: string;
  clientName: string;
  brokerageName: string;
  magicLinkUrl: string | null;
};

type BrokerageItem = {
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
    showBeeSoldBranding: boolean;
    portalTone: "corporate" | "premium_advisory";
  };
};

export default function MissionControlPage() {
  const [items, setItems] = useState<IntakeItem[]>([]);
  const [brokerages, setBrokerages] = useState<BrokerageItem[]>([]);
  const [selectedBrokerageId, setSelectedBrokerageId] = useState<string>("");
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [devInvites, setDevInvites] = useState<DevInvite[]>([]);
  const [message, setMessage] = useState("");
  const [missingItemsDraft, setMissingItemsDraft] = useState("");
  const [createForm, setCreateForm] = useState({
    brokerageSlug: "off-market-group",
    businessName: "",
    contactName: "",
    email: "",
    phone: "",
    assignedOwner: "",
  });
  const [brandingForm, setBrandingForm] = useState({
    name: "",
    shortName: "",
    senderName: "",
    senderEmail: "",
    portalBaseUrl: "",
    portalTone: "premium_advisory" as "corporate" | "premium_advisory",
    logoUrl: "",
    primaryColor: "#113968",
    secondaryColor: "#d4932e",
    legalFooter: "",
    showBeeSoldBranding: false,
  });

  const refresh = useCallback(async () => {
    const response = await fetch("/api/mission-control/intakes", { cache: "no-store" });
    const payload = (await response.json()) as { ok: boolean; data: { items: IntakeItem[] } };
    if (payload.ok) {
      setItems(payload.data.items);
      if (!selectedSessionId && payload.data.items.length > 0) {
        setSelectedSessionId(payload.data.items[0].id);
      }
    }

    const brokeragesResponse = await fetch("/api/mission-control/brokerages", { cache: "no-store" });
    const brokeragesPayload = (await brokeragesResponse.json()) as {
      ok: boolean;
      data?: { items: BrokerageItem[] };
    };
    if (brokeragesPayload.ok && brokeragesPayload.data) {
      setBrokerages(brokeragesPayload.data.items);
      if (!selectedBrokerageId && brokeragesPayload.data.items.length > 0) {
        setSelectedBrokerageId(brokeragesPayload.data.items[0].id);
      }
    }

    const inviteResponse = await fetch("/api/dev/invites", { cache: "no-store" });
    const invitePayload = (await inviteResponse.json()) as {
      ok: boolean;
      data?: { items: DevInvite[] };
    };
    if (invitePayload.ok && invitePayload.data) {
      setDevInvites(invitePayload.data.items.slice(0, 8));
    }
  }, [selectedSessionId, selectedBrokerageId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selectedBrokerage = useMemo(
    () => brokerages.find((item) => item.id === selectedBrokerageId),
    [brokerages, selectedBrokerageId],
  );

  useEffect(() => {
    if (!selectedBrokerage) return;

    setBrandingForm({
      name: selectedBrokerage.name,
      shortName: selectedBrokerage.shortName ?? "",
      senderName: selectedBrokerage.senderName,
      senderEmail: selectedBrokerage.senderEmail,
      portalBaseUrl: selectedBrokerage.portalBaseUrl,
      portalTone: selectedBrokerage.branding.portalTone,
      logoUrl: selectedBrokerage.branding.logoUrl ?? "",
      primaryColor: selectedBrokerage.branding.primaryColor,
      secondaryColor: selectedBrokerage.branding.secondaryColor,
      legalFooter: selectedBrokerage.branding.legalFooter,
      showBeeSoldBranding: selectedBrokerage.branding.showBeeSoldBranding,
    });
  }, [selectedBrokerage]);

  useEffect(() => {
    if (!selectedSessionId) return;

    fetch(`/api/mission-control/intakes/${selectedSessionId}/timeline`)
      .then((response) => response.json())
      .then((payload: { ok: boolean; data: { events: TimelineEvent[] } }) => {
        if (payload.ok) {
          setTimeline(payload.data.events);
        }
      });
  }, [selectedSessionId, items]);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedSessionId),
    [items, selectedSessionId],
  );

  async function createClient() {
    const response = await fetch("/api/onboarding/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...createForm, triggerInvite: true }),
    });
    const payload = (await response.json()) as { ok: boolean; error?: string };

    if (!payload.ok) {
      setMessage(payload.error ?? "Unable to create client");
      return;
    }

    setMessage("Client created and invite sent.");
    setCreateForm({
      brokerageSlug: "off-market-group",
      businessName: "",
      contactName: "",
      email: "",
      phone: "",
      assignedOwner: "",
    });
    await refresh();
  }

  async function saveBranding() {
    if (!selectedBrokerageId) return;

    const response = await fetch(`/api/mission-control/brokerages/${selectedBrokerageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: brandingForm.name,
        shortName: brandingForm.shortName,
        senderName: brandingForm.senderName,
        senderEmail: brandingForm.senderEmail,
        portalBaseUrl: brandingForm.portalBaseUrl,
        branding: {
          portalTone: brandingForm.portalTone,
          logoUrl: brandingForm.logoUrl,
          primaryColor: brandingForm.primaryColor,
          secondaryColor: brandingForm.secondaryColor,
          legalFooter: brandingForm.legalFooter,
          showBeeSoldBranding: brandingForm.showBeeSoldBranding,
        },
      }),
    });

    const payload = (await response.json()) as { ok: boolean; error?: string };
    if (!payload.ok) {
      setMessage(payload.error ?? "Unable to save branding settings");
      return;
    }

    setMessage("Brokerage branding settings updated.");
    await refresh();
  }

  async function handleLogoUpload(file: File | undefined) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setBrandingForm((prev) => ({ ...prev, logoUrl: result }));
      setMessage("Logo loaded. Click Save Branding to apply.");
    };
    reader.readAsDataURL(file);
  }

  async function invokeAction(action: "resend-invite" | "magic-link") {
    if (!selectedSessionId) return;
    await fetch(`/api/mission-control/intakes/${selectedSessionId}/${action}`, { method: "POST" });
    setMessage(action === "resend-invite" ? "Invite resent." : "New magic link sent.");
    await refresh();
  }

  async function submitMissingItems() {
    if (!selectedSessionId) return;
    const missingItems = missingItemsDraft
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    await fetch(`/api/mission-control/intakes/${selectedSessionId}/missing-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ missingItems, requestedBy: "Mission Control Operator" }),
    });

    setMessage("Missing items request sent to client.");
    setMissingItemsDraft("");
    await refresh();
  }

  return (
    <AppShell
      active="mission"
      title="Mission Control"
      subtitle="Client onboarding, intake progress, revision loops, and audit trail"
    >
      <section className="card">
        <h2>Brokerage Branding Settings</h2>
        <p className="small">Configure smart fields, portal tone, and logo source.</p>

        <label className="field">
          <span>Brokerage</span>
          <select value={selectedBrokerageId} onChange={(event) => setSelectedBrokerageId(event.target.value)}>
            {brokerages.map((brokerage) => (
              <option key={brokerage.id} value={brokerage.id}>{brokerage.name} ({brokerage.slug})</option>
            ))}
          </select>
        </label>

        <div className="grid two">
          <label className="field">
            <span>Brand name</span>
            <input value={brandingForm.name} onChange={(event) => setBrandingForm((prev) => ({ ...prev, name: event.target.value }))} />
          </label>
          <label className="field">
            <span>Short name (smart field)</span>
            <input value={brandingForm.shortName} onChange={(event) => setBrandingForm((prev) => ({ ...prev, shortName: event.target.value }))} placeholder="e.g. Apex" />
          </label>
          <label className="field">
            <span>Sender name</span>
            <input value={brandingForm.senderName} onChange={(event) => setBrandingForm((prev) => ({ ...prev, senderName: event.target.value }))} />
          </label>
          <label className="field">
            <span>Sender email</span>
            <input value={brandingForm.senderEmail} onChange={(event) => setBrandingForm((prev) => ({ ...prev, senderEmail: event.target.value }))} />
          </label>
          <label className="field">
            <span>Portal base URL</span>
            <input value={brandingForm.portalBaseUrl} onChange={(event) => setBrandingForm((prev) => ({ ...prev, portalBaseUrl: event.target.value }))} />
          </label>
          <label className="field">
            <span>Portal tone</span>
            <select value={brandingForm.portalTone} onChange={(event) => setBrandingForm((prev) => ({ ...prev, portalTone: event.target.value as "corporate" | "premium_advisory" }))}>
              <option value="premium_advisory">Premium Advisory</option>
              <option value="corporate">Corporate</option>
            </select>
          </label>
          <label className="field">
            <span>Primary color</span>
            <input value={brandingForm.primaryColor} onChange={(event) => setBrandingForm((prev) => ({ ...prev, primaryColor: event.target.value }))} />
          </label>
          <label className="field">
            <span>Secondary color</span>
            <input value={brandingForm.secondaryColor} onChange={(event) => setBrandingForm((prev) => ({ ...prev, secondaryColor: event.target.value }))} />
          </label>
          <label className="field">
            <span>Logo URL</span>
            <input value={brandingForm.logoUrl} onChange={(event) => setBrandingForm((prev) => ({ ...prev, logoUrl: event.target.value }))} placeholder="https://..." />
          </label>
          <label className="field">
            <span>Or upload logo file</span>
            <input type="file" accept="image/*" onChange={(event) => handleLogoUpload(event.target.files?.[0])} />
          </label>
          <label className="field" style={{ gridColumn: "1 / -1" }}>
            <span>Legal footer</span>
            <textarea rows={3} value={brandingForm.legalFooter} onChange={(event) => setBrandingForm((prev) => ({ ...prev, legalFooter: event.target.value }))} />
          </label>
          <label className="row" style={{ gridColumn: "1 / -1" }}>
            <input type="checkbox" checked={brandingForm.showBeeSoldBranding} onChange={(event) => setBrandingForm((prev) => ({ ...prev, showBeeSoldBranding: event.target.checked }))} />
            <span>Show “Powered by BeeSold” on client-facing pages</span>
          </label>
        </div>

        <p className="small">Smart field preview: <code>{"{{brokerage.shortName}}"}</code> = {brandingForm.shortName || "(empty)"}</p>
        <button className="primary" onClick={saveBranding} disabled={!selectedBrokerageId}>Save Branding</button>
      </section>

      <section className="card">
        <h2>Dev Invite Links</h2>
        <p className="small">Local testing helper (non-production only).</p>
        {devInvites.length === 0 ? (
          <p className="small">No invites generated yet.</p>
        ) : (
          <div className="grid" style={{ gap: "0.55rem" }}>
            {devInvites.map((invite) => (
              <div key={invite.id} className="queue-item">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <strong>{invite.businessName}</strong>
                  <span className="small">{new Date(invite.createdAt).toLocaleString()}</span>
                </div>
                <p className="small">{invite.clientName} · {invite.to}</p>
                <p className="small">{invite.brokerageName}</p>
                <div className="row">
                  <button
                    className="secondary"
                    onClick={async () => {
                      if (!invite.magicLinkUrl) return;
                      await navigator.clipboard.writeText(invite.magicLinkUrl);
                      setMessage("Magic link copied.");
                    }}
                    disabled={!invite.magicLinkUrl}
                  >
                    Copy Magic Link
                  </button>
                  <button
                    className="primary"
                    onClick={() => {
                      if (!invite.magicLinkUrl) return;
                      window.open(invite.magicLinkUrl, "_blank", "noopener,noreferrer");
                    }}
                    disabled={!invite.magicLinkUrl}
                  >
                    Open Link
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2>Create Client</h2>
        <div className="grid two">
          <label className="field">
            <span>Brokerage slug</span>
            <input
              value={createForm.brokerageSlug}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, brokerageSlug: event.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>Business name</span>
            <input
              value={createForm.businessName}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, businessName: event.target.value }))}
            />
          </label>
          <label className="field">
            <span>Contact name</span>
            <input
              value={createForm.contactName}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, contactName: event.target.value }))}
            />
          </label>
          <label className="field">
            <span>Email</span>
            <input
              value={createForm.email}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))}
            />
          </label>
          <label className="field">
            <span>Phone (optional)</span>
            <input
              value={createForm.phone}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, phone: event.target.value }))}
            />
          </label>
          <label className="field">
            <span>Assigned owner (optional)</span>
            <input
              value={createForm.assignedOwner}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, assignedOwner: event.target.value }))
              }
            />
          </label>
        </div>
        <button
          className="primary"
          onClick={createClient}
          disabled={!createForm.businessName || !createForm.contactName || !createForm.email}
        >
          Create + Send Invite
        </button>
      </section>

      <section className="mission-grid">
        <article className="card">
          <div className="panel-head">
            <h2>Clients</h2>
            <span className="badge">{items.length}</span>
          </div>
          <div className="grid" style={{ gap: "0.65rem" }}>
            {items.map((item) => (
              <button
                key={item.id}
                className={`queue-item ${selectedSessionId === item.id ? "active" : ""}`}
                onClick={() => setSelectedSessionId(item.id)}
              >
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <strong>{item.client.businessName}</strong>
                  <span className="badge">{item.status}</span>
                </div>
                <div className="small">{item.client.contactName}</div>
                <div className="small">{item.client.email}</div>
                <div className="small">
                  {item.completionPct}% · Step {item.currentStep}/{item.totalSteps}
                </div>
                <div className="small">Last activity: {new Date(item.lastActivityAt).toLocaleString()}</div>
              </button>
            ))}
          </div>
        </article>

        <article className="card">
          {!selected ? (
            <p className="small">Select a client.</p>
          ) : (
            <div className="grid" style={{ gap: "0.8rem" }}>
              <div className="panel-head">
                <h2>{selected.client.businessName}</h2>
                <span className="badge">{selected.brokerage.name}</span>
              </div>

              <div className="grid two">
                <div className="card" style={{ background: "#f8f9ff" }}>
                  <p className="small">Status: {selected.status}</p>
                  <p className="small">Invited: {selected.invitedAt ? new Date(selected.invitedAt).toLocaleString() : "No"}</p>
                  <p className="small">Partial submit: {selected.partialSubmittedAt ? "Yes" : "No"}</p>
                  <p className="small">Final submit: {selected.finalSubmittedAt ? "Yes" : "No"}</p>
                  <p className="small">Owner: {selected.client.assignedOwner || "Unassigned"}</p>
                  <p className="small">
                    Drive: {selected.driveFolderUrl ? <a href={selected.driveFolderUrl}>Open folder</a> : "Not created"}
                  </p>
                </div>

                <div className="card" style={{ background: "#f7fbf7" }}>
                  <strong>Actions</strong>
                  <div className="row" style={{ marginTop: "0.55rem" }}>
                    <button className="secondary" onClick={() => invokeAction("resend-invite")}>
                      Resend Invite
                    </button>
                    <button className="secondary" onClick={() => invokeAction("magic-link")}>
                      Send New Magic Link
                    </button>
                  </div>
                  <label className="field" style={{ marginTop: "0.75rem" }}>
                    <span>Request Missing Items (one per line)</span>
                    <textarea
                      rows={4}
                      value={missingItemsDraft}
                      onChange={(event) => setMissingItemsDraft(event.target.value)}
                    />
                  </label>
                  <button className="warn" onClick={submitMissingItems} disabled={!missingItemsDraft.trim()}>
                    Request Missing Items
                  </button>
                </div>
              </div>

              <div className="card">
                <strong>Audit Trail</strong>
                <div className="grid" style={{ gap: "0.45rem", marginTop: "0.6rem" }}>
                  {timeline.map((event) => (
                    <div key={event.id} className="queue-item">
                      <div className="row" style={{ justifyContent: "space-between" }}>
                        <strong>{event.action}</strong>
                        <span className="small">{new Date(event.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="small">Actor: {event.actor}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </article>
      </section>

      {message ? <p className="small">{message}</p> : null}
    </AppShell>
  );
}
