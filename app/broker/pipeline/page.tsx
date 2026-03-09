"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

type PipelineItem = {
  id: string;
  client: {
    businessName: string;
    contactName: string;
    email: string;
  };
  status: IntakeStatus;
  completionPct: number;
  lastActivityAt: string;
  createdAt: string;
  statusEnteredAt: string;
};

const COLUMNS: Array<{ status: IntakeStatus; label: string }> = [
  { status: "INVITED", label: "Invited" },
  { status: "IN_PROGRESS", label: "In Progress" },
  { status: "PARTIAL_SUBMITTED", label: "Partial Submitted" },
  { status: "MISSING_ITEMS_REQUESTED", label: "Missing Items" },
  { status: "FINAL_SUBMITTED", label: "Final Submitted" },
  { status: "KLOR_SYNTHESIS", label: "Klor" },
  { status: "COUNCIL_RUNNING", label: "Council" },
  { status: "REPORT_READY", label: "Report Ready" },
  { status: "APPROVED", label: "Approved" },
];

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export default function BrokerPipelinePage() {
  const [items, setItems] = useState<PipelineItem[]>([]);
  const [brokerName, setBrokerName] = useState("");
  const [brokerEmail, setBrokerEmail] = useState("");
  const [message, setMessage] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [busyActionKey, setBusyActionKey] = useState("");
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [createForm, setCreateForm] = useState({
    businessName: "",
    contactName: "",
    email: "",
    phone: "",
    assignedOwner: "",
  });
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000 * 30);
    return () => clearInterval(interval);
  }, []);

  async function refreshPipeline() {
    const response = await fetch("/api/broker/pipeline", { cache: "no-store" });
    if (response.status === 401) {
      window.location.href = "/broker/sign-in";
      return;
    }
    const payload = (await response.json()) as {
      ok: boolean;
      data?: { items: PipelineItem[] };
      error?: string;
    };
    if (!payload?.ok || !payload.data) {
      setMessage(payload?.error ?? "Unable to load pipeline.");
      return;
    }
    setItems(payload.data.items);
  }

  useEffect(() => {
    fetch("/api/broker-auth/me", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          window.location.href = "/broker/sign-in";
          return null;
        }
        return (await response.json()) as {
          ok: boolean;
          data?: { email: string; brokerage: { name: string } };
        };
      })
      .then((payload) => {
        if (!payload?.ok || !payload.data) return;
        setBrokerName(payload.data.brokerage.name);
        setBrokerEmail(payload.data.email);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshPipeline().catch(() => setMessage("Unable to load pipeline."));
  }, []);

  async function signOut() {
    await fetch("/api/broker-auth/sign-out", { method: "POST" });
    window.location.href = "/broker/sign-in";
  }

  async function resendInvite(sessionId: string) {
    setBusyActionKey(`resend:${sessionId}`);
    setActionMessage("");
    try {
      const response = await fetch(`/api/broker/intakes/${sessionId}/resend-invite`, {
        method: "POST",
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!payload.ok) {
        setActionMessage(payload.error ?? "Unable to resend invite.");
        return;
      }
      setActionMessage("Invite resent successfully.");
    } finally {
      setBusyActionKey("");
    }
  }

  async function issueMagicLink(sessionId: string) {
    setBusyActionKey(`magic:${sessionId}`);
    setActionMessage("");
    try {
      const response = await fetch(`/api/broker/intakes/${sessionId}/magic-link`, {
        method: "POST",
      });
      const payload = (await response.json()) as {
        ok: boolean;
        data?: { magicLinkUrl?: string };
        error?: string;
      };
      if (!payload.ok) {
        setActionMessage(payload.error ?? "Unable to issue magic link.");
        return;
      }
      const magicLinkUrl = payload.data?.magicLinkUrl ?? "";
      if (!magicLinkUrl) {
        setActionMessage("Magic link generated, but URL was not returned.");
        return;
      }
      try {
        await navigator.clipboard.writeText(magicLinkUrl);
        setActionMessage("New magic link copied to clipboard.");
      } catch {
        setActionMessage(`New magic link: ${magicLinkUrl}`);
      }
    } finally {
      setBusyActionKey("");
    }
  }

  async function createClient() {
    setIsCreatingClient(true);
    setActionMessage("");
    try {
      const response = await fetch("/api/broker/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: createForm.businessName,
          contactName: createForm.contactName,
          email: createForm.email,
          phone: createForm.phone,
          assignedOwner: createForm.assignedOwner,
          triggerInvite: true,
        }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        data?: { sessionId?: string; inviteSent?: boolean };
        error?: string;
      };
      if (!payload.ok) {
        setActionMessage(payload.error ?? "Unable to create client.");
        return;
      }
      setCreateForm({
        businessName: "",
        contactName: "",
        email: "",
        phone: "",
        assignedOwner: "",
      });
      setActionMessage(
        payload.data?.inviteSent ? "Client created and invite sent." : "Client created. Invite was not sent.",
      );
      await refreshPipeline();
    } finally {
      setIsCreatingClient(false);
    }
  }

  const grouped = useMemo(() => {
    return COLUMNS.map((column) => ({
      ...column,
      cards: items.filter((item) => item.status === column.status),
    }));
  }, [items]);

  return (
    <main style={{ minHeight: "100vh", padding: "1rem" }}>
      <section className="card" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
          <div>
            <h1>{brokerName || "Broker"} Pipeline</h1>
            <p className="small">Signed in as {brokerEmail || "..."}</p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Link className="secondary" href="/broker/settings">
              Settings
            </Link>
            <button className="secondary" type="button" onClick={signOut}>
              Sign Out
            </button>
          </div>
        </div>
        {message ? <p className="error">{message}</p> : null}
        {actionMessage ? <p className="small">{actionMessage}</p> : null}
      </section>

      <section className="card" style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginBottom: "0.5rem" }}>Add Client</h3>
        <p className="small" style={{ marginBottom: "0.65rem" }}>
          Creates a client in this brokerage and sends the branded invite automatically.
        </p>
        <div style={{ display: "grid", gap: "0.5rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <label className="field">
            <span>Business Name</span>
            <input
              value={createForm.businessName}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, businessName: event.target.value }))}
            />
          </label>
          <label className="field">
            <span>Contact Name</span>
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
            <span>Phone</span>
            <input
              value={createForm.phone}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, phone: event.target.value }))}
            />
          </label>
          <label className="field">
            <span>Assigned Owner (optional)</span>
            <input
              value={createForm.assignedOwner}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, assignedOwner: event.target.value }))}
            />
          </label>
        </div>
        <div style={{ marginTop: "0.65rem" }}>
          <button
            className="primary"
            type="button"
            onClick={createClient}
            disabled={
              isCreatingClient ||
              !createForm.businessName.trim() ||
              !createForm.contactName.trim() ||
              !createForm.email.trim()
            }
          >
            {isCreatingClient ? "Creating..." : "Create Client + Send Invite"}
          </button>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(9, minmax(260px, 1fr))",
          gap: "0.75rem",
          alignItems: "start",
          overflowX: "auto",
          paddingBottom: "0.5rem",
        }}
      >
        {grouped.map((column) => (
          <article key={column.status} className="card" style={{ minHeight: 220 }}>
            <h3 style={{ marginBottom: "0.5rem" }}>
              {column.label} ({column.cards.length})
            </h3>
            <div style={{ display: "grid", gap: "0.5rem" }}>
              {column.cards.map((item) => (
                <div
                  key={item.id}
                  style={{
                    border: "1px solid #d9e1ff",
                    borderRadius: 12,
                    padding: "0.6rem",
                    background: "#f9fbff",
                    display: "grid",
                    gap: "0.25rem",
                  }}
                >
                  <strong>{item.client.businessName}</strong>
                  <p className="small">{item.client.contactName}</p>
                  <p className="small">{item.client.email}</p>
                  <p className="small">Completion: {item.completionPct}%</p>
                  <p className="small">Time in system: {formatDuration(now - new Date(item.createdAt).getTime())}</p>
                  <p className="small">
                    Time in stage: {formatDuration(now - new Date(item.statusEnteredAt).getTime())}
                  </p>
                  <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.25rem" }}>
                    <button
                      className="secondary"
                      type="button"
                      onClick={() => resendInvite(item.id)}
                      disabled={busyActionKey.length > 0}
                    >
                      {busyActionKey === `resend:${item.id}` ? "Sending..." : "Resend Invite"}
                    </button>
                    <button
                      className="secondary"
                      type="button"
                      onClick={() => issueMagicLink(item.id)}
                      disabled={busyActionKey.length > 0}
                    >
                      {busyActionKey === `magic:${item.id}` ? "Creating..." : "New Magic Link"}
                    </button>
                  </div>
                </div>
              ))}
              {column.cards.length === 0 ? <p className="small">No clients</p> : null}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
