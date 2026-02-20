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
  brokerage: { id: string; slug: string; name: string; isArchived?: boolean };
  client: {
    id: string;
    businessName: string;
    contactName: string;
    email: string;
    phone?: string;
    assignedOwner?: string;
    isArchived?: boolean;
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
  driveParentFolderId?: string;
  isArchived?: boolean;
  archivedAt?: string;
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
  type OperatorRole = "ADMIN" | "EDITOR";
  const statusOptions: Array<{ value: "all" | IntakeStatus; label: string }> = [
    { value: "all", label: "All statuses" },
    { value: "INVITED", label: "Invited" },
    { value: "IN_PROGRESS", label: "In Progress" },
    { value: "PARTIAL_SUBMITTED", label: "Partial Submitted" },
    { value: "MISSING_ITEMS_REQUESTED", label: "Missing Items Requested" },
    { value: "FINAL_SUBMITTED", label: "Final Submitted" },
    { value: "KLOR_SYNTHESIS", label: "Klor Synthesis" },
    { value: "COUNCIL_RUNNING", label: "Council Running" },
    { value: "REPORT_READY", label: "Report Ready" },
    { value: "APPROVED", label: "Approved" },
  ];

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
    driveParentFolderId: "",
    portalTone: "premium_advisory" as "corporate" | "premium_advisory",
    logoUrl: "",
    primaryColor: "#113968",
    secondaryColor: "#d4932e",
    legalFooter: "",
    showBeeSoldBranding: false,
  });
  const [newBrokerageForm, setNewBrokerageForm] = useState({
    slug: "",
    name: "",
    shortName: "",
    senderName: "",
    senderEmail: "",
    portalBaseUrl: "http://localhost:3000",
    driveParentFolderId: "",
  });
  const [brokerageSearch, setBrokerageSearch] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [clientBrokerageFilter, setClientBrokerageFilter] = useState("all");
  const [clientStatusFilter, setClientStatusFilter] = useState<"all" | IntakeStatus>("all");
  const [clientArchiveFilter, setClientArchiveFilter] = useState<"active" | "archived" | "all">("active");
  const [includeArchivedBrokerages, setIncludeArchivedBrokerages] = useState(false);
  const [showFullTimeline, setShowFullTimeline] = useState(false);
  const [expandedTimelineIds, setExpandedTimelineIds] = useState<string[]>([]);
  const [activeOpsPanel, setActiveOpsPanel] = useState<"add-brokerage" | "update-brokerage" | "create-client" | "dev-links">("create-client");
  const [operatorRole, setOperatorRole] = useState<OperatorRole | null>(null);
  const [operatorEmail, setOperatorEmail] = useState("");
  const [authChecked, setAuthChecked] = useState(false);
  const canAdmin = operatorRole === "ADMIN";

  async function readJsonSafe<T>(response: Response): Promise<T | null> {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  }

  const refresh = useCallback(async () => {
    const response = await fetch(
      `/api/mission-control/intakes?includeArchived=${encodeURIComponent(clientArchiveFilter !== "active" ? "true" : "false")}`,
      { cache: "no-store" },
    );
    if (response.status === 401) {
      window.location.href = "/operator/sign-in";
      return;
    }
    const payload = await readJsonSafe<{ ok: boolean; data: { items: IntakeItem[] } }>(response);
    if (payload?.ok) {
      setItems(payload.data.items);
      if (!selectedSessionId && payload.data.items.length > 0) {
        setSelectedSessionId(payload.data.items[0].id);
      }
    } else {
      setMessage("Unable to load intake list right now. Please refresh.");
    }

    const brokeragesResponse = await fetch(
      `/api/mission-control/brokerages?includeArchived=${encodeURIComponent(includeArchivedBrokerages ? "true" : "false")}`,
      { cache: "no-store" },
    );
    if (brokeragesResponse.status === 401) {
      window.location.href = "/operator/sign-in";
      return;
    }
    const brokeragesPayload = await readJsonSafe<{
      ok: boolean;
      data?: { items: BrokerageItem[] };
    }>(brokeragesResponse);
    if (brokeragesPayload?.ok && brokeragesPayload.data) {
      setBrokerages(brokeragesPayload.data.items);
      if (!selectedBrokerageId && brokeragesPayload.data.items.length > 0) {
        setSelectedBrokerageId(brokeragesPayload.data.items[0].id);
      }
      setCreateForm((prev) => {
        const activeItems = brokeragesPayload.data?.items.filter((item) => !item.isArchived) ?? [];
        const hasCurrent = activeItems.some((item) => item.slug === prev.brokerageSlug);
        if (hasCurrent) return prev;
        return {
          ...prev,
          brokerageSlug: activeItems[0]?.slug ?? prev.brokerageSlug,
        };
      });
    } else {
      setMessage("Unable to load brokerage list right now. Please refresh.");
    }

    if (canAdmin) {
      const inviteResponse = await fetch("/api/dev/invites", { cache: "no-store" });
      const invitePayload = await readJsonSafe<{
        ok: boolean;
        data?: { items: DevInvite[] };
      }>(inviteResponse);
      if (invitePayload?.ok && invitePayload.data) {
        setDevInvites(invitePayload.data.items.slice(0, 8));
      }
    }
  }, [selectedSessionId, selectedBrokerageId, clientArchiveFilter, includeArchivedBrokerages, canAdmin]);

  useEffect(() => {
    if (!authChecked || !operatorRole) return;
    refresh();
  }, [refresh, authChecked, operatorRole]);

  useEffect(() => {
    fetch("/api/operator-auth/me", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          window.location.href = "/operator/sign-in";
          return null;
        }
        return readJsonSafe<{ ok: boolean; data?: { role: OperatorRole; email: string } }>(response);
      })
      .then((payload) => {
        if (payload?.ok && payload.data) {
          setOperatorRole(payload.data.role);
          setOperatorEmail(payload.data.email);
          setAuthChecked(true);
          return;
        }
        window.location.href = "/operator/sign-in";
      });
  }, []);

  const selectedBrokerage = useMemo(
    () => brokerages.find((item) => item.id === selectedBrokerageId),
    [brokerages, selectedBrokerageId],
  );
  const filteredBrokerages = useMemo(() => {
    const q = brokerageSearch.trim().toLowerCase();
    if (!q) return brokerages;
    return brokerages.filter(
      (brokerage) =>
        brokerage.name.toLowerCase().includes(q) ||
        brokerage.slug.toLowerCase().includes(q) ||
        (brokerage.shortName ?? "").toLowerCase().includes(q),
    );
  }, [brokerages, brokerageSearch]);
  const activeBrokerages = useMemo(
    () => brokerages.filter((brokerage) => !brokerage.isArchived),
    [brokerages],
  );
  const brokerageFilterOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: Array<{ slug: string; name: string }> = [];
    items.forEach((item) => {
      if (seen.has(item.brokerage.slug)) return;
      seen.add(item.brokerage.slug);
      options.push({ slug: item.brokerage.slug, name: item.brokerage.name });
    });
    return options.sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  useEffect(() => {
    if (!selectedBrokerage) return;

    setBrandingForm({
      name: selectedBrokerage.name,
      shortName: selectedBrokerage.shortName ?? "",
      senderName: selectedBrokerage.senderName,
      senderEmail: selectedBrokerage.senderEmail,
      portalBaseUrl: selectedBrokerage.portalBaseUrl,
      driveParentFolderId: selectedBrokerage.driveParentFolderId ?? "",
      portalTone: selectedBrokerage.branding.portalTone,
      logoUrl: selectedBrokerage.branding.logoUrl ?? "",
      primaryColor: selectedBrokerage.branding.primaryColor,
      secondaryColor: selectedBrokerage.branding.secondaryColor,
      legalFooter: selectedBrokerage.branding.legalFooter,
      showBeeSoldBranding: selectedBrokerage.branding.showBeeSoldBranding,
    });
  }, [selectedBrokerage]);

  useEffect(() => {
    if (!selectedBrokerageId) return;
    if (!brokerages.some((item) => item.id === selectedBrokerageId)) {
      setSelectedBrokerageId(brokerages[0]?.id ?? "");
    }
  }, [brokerages, selectedBrokerageId]);

  useEffect(() => {
    if (!selectedSessionId) return;

    fetch(`/api/mission-control/intakes/${selectedSessionId}/timeline`)
      .then(async (response) => {
        const payload = await readJsonSafe<{ ok: boolean; data: { events: TimelineEvent[] } }>(response);
        if (payload?.ok) setTimeline(payload.data.events);
      });
  }, [selectedSessionId, items]);

  const filteredItems = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    return items.filter((item) => {
      const archiveMatch =
        clientArchiveFilter === "all"
          ? true
          : clientArchiveFilter === "archived"
            ? Boolean(item.client.isArchived)
            : !item.client.isArchived;
      if (!archiveMatch) return false;
      const brokerageMatch =
        clientBrokerageFilter === "all" ? true : item.brokerage.slug === clientBrokerageFilter;
      if (!brokerageMatch) return false;
      const statusMatch = clientStatusFilter === "all" ? true : item.status === clientStatusFilter;
      if (!statusMatch) return false;
      if (!q) return true;
      return (
        item.client.businessName.toLowerCase().includes(q) ||
        item.client.contactName.toLowerCase().includes(q) ||
        item.client.email.toLowerCase().includes(q) ||
        item.brokerage.name.toLowerCase().includes(q) ||
        item.brokerage.slug.toLowerCase().includes(q)
      );
    });
  }, [items, clientSearch, clientBrokerageFilter, clientStatusFilter, clientArchiveFilter]);

  function statusBadgeClass(status: IntakeStatus): string {
    if (status === "INVITED") return "badge status-invited";
    if (status === "IN_PROGRESS" || status === "PARTIAL_SUBMITTED" || status === "MISSING_ITEMS_REQUESTED") {
      return "badge status-inprogress";
    }
    if (status === "FINAL_SUBMITTED" || status === "KLOR_SYNTHESIS" || status === "COUNCIL_RUNNING") {
      return "badge status-processing";
    }
    if (status === "REPORT_READY") return "badge status-review";
    if (status === "APPROVED") return "badge status-approved";
    return "badge";
  }
  const selected = useMemo(
    () => filteredItems.find((item) => item.id === selectedSessionId),
    [filteredItems, selectedSessionId],
  );
  const timelineEvents = useMemo(() => {
    const ordered = [...timeline].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return showFullTimeline ? ordered : ordered.slice(0, 10);
  }, [timeline, showFullTimeline]);

  useEffect(() => {
    if (filteredItems.length === 0) return;
    if (!filteredItems.some((item) => item.id === selectedSessionId)) {
      setSelectedSessionId(filteredItems[0].id);
    }
  }, [filteredItems, selectedSessionId]);

  async function createClient() {
    if (!canAdmin) {
      setMessage("Only admins can create clients.");
      return;
    }
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
      brokerageSlug: createForm.brokerageSlug,
      businessName: "",
      contactName: "",
      email: "",
      phone: "",
      assignedOwner: "",
    });
    await refresh();
  }

  async function createBrokerage() {
    if (!canAdmin) {
      setMessage("Only admins can add brokerages.");
      return;
    }
    const response = await fetch("/api/mission-control/brokerages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: newBrokerageForm.slug,
        name: newBrokerageForm.name,
        shortName: newBrokerageForm.shortName || undefined,
        senderName: newBrokerageForm.senderName,
        senderEmail: newBrokerageForm.senderEmail,
        portalBaseUrl: newBrokerageForm.portalBaseUrl,
        driveParentFolderId: newBrokerageForm.driveParentFolderId || undefined,
      }),
    });

    const payload = (await response.json()) as {
      ok: boolean;
      error?: string;
      data?: { brokerage: BrokerageItem };
    };

    if (!payload.ok || !payload.data) {
      setMessage(payload.error ?? "Unable to create brokerage");
      return;
    }

    setMessage("Brokerage created.");
    setNewBrokerageForm({
      slug: "",
      name: "",
      shortName: "",
      senderName: "",
      senderEmail: "",
      portalBaseUrl: "http://localhost:3000",
      driveParentFolderId: "",
    });
    await refresh();
    setSelectedBrokerageId(payload.data.brokerage.id);
    setCreateForm((prev) => ({ ...prev, brokerageSlug: payload.data?.brokerage.slug ?? prev.brokerageSlug }));
  }

  async function saveBranding() {
    if (!selectedBrokerageId) return;
    if (!canAdmin) {
      setMessage("Only admins can update brokerage settings.");
      return;
    }

    const response = await fetch(`/api/mission-control/brokerages/${selectedBrokerageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: brandingForm.name,
        shortName: brandingForm.shortName,
        senderName: brandingForm.senderName,
        senderEmail: brandingForm.senderEmail,
        portalBaseUrl: brandingForm.portalBaseUrl,
        driveParentFolderId: brandingForm.driveParentFolderId || undefined,
        branding: {
          portalTone: brandingForm.portalTone,
          logoUrl: brandingForm.logoUrl || undefined,
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

  async function clearLogo() {
    if (!selectedBrokerageId) return;
    if (!canAdmin) {
      setMessage("Only admins can update brokerage settings.");
      return;
    }

    const response = await fetch(`/api/mission-control/brokerages/${selectedBrokerageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        branding: {
          logoUrl: "",
        },
      }),
    });

    const payload = (await response.json()) as { ok: boolean; error?: string };
    if (!payload.ok) {
      setMessage(payload.error ?? "Unable to clear logo");
      return;
    }

    setBrandingForm((prev) => ({ ...prev, logoUrl: "" }));
    setMessage("Logo cleared.");
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
    if (!canAdmin) {
      setMessage("Only admins can send invite actions.");
      return;
    }
    await fetch(`/api/mission-control/intakes/${selectedSessionId}/${action}`, { method: "POST" });
    setMessage(action === "resend-invite" ? "Invite resent." : "New magic link sent.");
    await refresh();
  }

  async function submitMissingItems() {
    if (!selectedSessionId) return;
    if (!canAdmin) {
      setMessage("Only admins can request missing items.");
      return;
    }
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

  async function submitReportDecision(decision: "APPROVE" | "REJECT") {
    if (!selectedSessionId) return;
    if (!canAdmin) {
      setMessage("Only admins can approve or reject reports.");
      return;
    }

    const response = await fetch("/approval", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: selectedSessionId,
        decision,
        operatorName: "Mission Control Operator",
        note: decision === "REJECT" ? "Needs revisions" : undefined,
      }),
    });

    const payload = (await response.json()) as { ok: boolean; error?: string };
    if (!payload.ok) {
      setMessage(payload.error ?? "Unable to process report decision.");
      return;
    }

    setMessage(decision === "APPROVE" ? "Report approved." : "Report sent back for revisions.");
    await refresh();
  }

  async function toggleSelectedClientArchive(nextArchivedState: boolean) {
    if (!selectedSessionId) return;
    if (!canAdmin) {
      setMessage("Only admins can archive clients.");
      return;
    }
    const response = await fetch(`/api/mission-control/intakes/${selectedSessionId}/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isArchived: nextArchivedState,
        actorName: "Mission Control Operator",
      }),
    });
    const payload = (await response.json()) as { ok: boolean; error?: string };
    if (!payload.ok) {
      setMessage(payload.error ?? "Unable to update client archive state.");
      return;
    }
    setMessage(nextArchivedState ? "Client archived." : "Client restored.");
    await refresh();
  }

  async function toggleSelectedBrokerageArchive(nextArchivedState: boolean) {
    if (!selectedBrokerageId) return;
    if (!canAdmin) {
      setMessage("Only admins can archive brokerages.");
      return;
    }
    const response = await fetch(`/api/mission-control/brokerages/${selectedBrokerageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isArchived: nextArchivedState }),
    });
    const payload = (await response.json()) as { ok: boolean; error?: string };
    if (!payload.ok) {
      setMessage(payload.error ?? "Unable to update brokerage archive state.");
      return;
    }
    setMessage(nextArchivedState ? "Brokerage archived." : "Brokerage restored.");
    await refresh();
  }

  if (!authChecked) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "1rem" }}>
        <p className="small">Checking access...</p>
      </main>
    );
  }

  return (
    <AppShell
      active="dashboard"
      title="Dashboard"
      subtitle="Listing onboarding, intake progress, revision loops, and audit trail"
    >
      <section className="card" style={{ order: 0 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <p className="small">Signed in as {operatorEmail || "operator"} ({operatorRole ?? "unknown"})</p>
          <button
            className="secondary"
            type="button"
            onClick={async () => {
              await fetch("/api/operator-auth/sign-out", { method: "POST" });
              window.location.href = "/operator/sign-in";
            }}
          >
            Sign Out
          </button>
        </div>
      </section>
      <section className="card" style={{ order: 1 }}>
        <h2>Operations Menu</h2>
        <p className="small">Select the admin tool you need. Listing operations remain the primary working view below.</p>
        {!canAdmin ? <p className="small">Editor access is view-only for operations.</p> : null}
        <div className="row">
          <button
            className={activeOpsPanel === "add-brokerage" ? "primary" : "secondary"}
            type="button"
            onClick={() => setActiveOpsPanel("add-brokerage")}
            disabled={!canAdmin}
          >
            1. Add Brokerage
          </button>
          <button
            className={activeOpsPanel === "update-brokerage" ? "primary" : "secondary"}
            type="button"
            onClick={() => setActiveOpsPanel("update-brokerage")}
            disabled={!canAdmin}
          >
            2. Update Brokerage
          </button>
          <button
            className={activeOpsPanel === "create-client" ? "primary" : "secondary"}
            type="button"
            onClick={() => setActiveOpsPanel("create-client")}
            disabled={!canAdmin}
          >
            3. Create Listing
          </button>
          <button
            className={activeOpsPanel === "dev-links" ? "primary" : "secondary"}
            type="button"
            onClick={() => setActiveOpsPanel("dev-links")}
            disabled={!canAdmin}
          >
            4. Dev Links
          </button>
        </div>
      </section>

      <section className="mission-grid" style={{ order: 2 }}>
        <article className="card">
          <div className="panel-head">
            <h2>Listings</h2>
            <span className="badge">{filteredItems.length}</span>
          </div>
          <label className="field">
            <span>Search listings</span>
            <input
              value={clientSearch}
              onChange={(event) => setClientSearch(event.target.value)}
              placeholder="Business, contact, email, brokerage"
            />
          </label>
          <label className="field">
            <span>Filter by brokerage</span>
            <select
              value={clientBrokerageFilter}
              onChange={(event) => setClientBrokerageFilter(event.target.value)}
            >
              <option value="all">All brokerages</option>
              {brokerageFilterOptions.map((brokerage) => (
                <option key={brokerage.slug} value={brokerage.slug}>
                  {brokerage.name} ({brokerage.slug})
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Filter by status</span>
            <select
              value={clientStatusFilter}
              onChange={(event) => setClientStatusFilter(event.target.value as "all" | IntakeStatus)}
            >
              {statusOptions.map((statusOption) => (
                <option key={statusOption.value} value={statusOption.value}>
                  {statusOption.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Archived visibility</span>
            <select
              value={clientArchiveFilter}
              onChange={(event) =>
                setClientArchiveFilter(event.target.value as "active" | "archived" | "all")
              }
            >
              <option value="active">Active only</option>
              <option value="archived">Archived only</option>
              <option value="all">All listings</option>
            </select>
          </label>
          <div className="grid" style={{ gap: "0.65rem" }}>
            {filteredItems.map((item) => (
              <button
                key={item.id}
                className={`queue-item ${selectedSessionId === item.id ? "active" : ""}`}
                onClick={() => setSelectedSessionId(item.id)}
              >
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <strong>{item.client.businessName}</strong>
                  <span className={statusBadgeClass(item.status)}>{item.status}</span>
                </div>
                <div className="small">{item.client.contactName}</div>
                <div className="small">{item.client.email}</div>
                {item.client.isArchived ? <div className="small">Archived</div> : null}
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
              <div className="card" style={{ background: "#f8fafe" }}>
                <strong>Workflow Horizon</strong>
                <p className="small">
                  You are currently operating Phase 1 intake and upload collection. Downstream stages (research,
                  council synthesis, creative production, and adaptive feedback) are planned next, so this board is
                  structured for a longer multi-phase lifecycle.
                </p>
              </div>
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
                    <button className="secondary" onClick={() => invokeAction("resend-invite")} disabled={!canAdmin}>
                      Resend Invite
                    </button>
                    <button className="secondary" onClick={() => invokeAction("magic-link")} disabled={!canAdmin}>
                      Send New Magic Link
                    </button>
                    <button
                      className={selected.client.isArchived ? "primary" : "warn"}
                      onClick={() => toggleSelectedClientArchive(!selected.client.isArchived)}
                      disabled={!canAdmin}
                    >
                      {selected.client.isArchived ? "Restore Client" : "Archive Client"}
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
                  <button className="warn" onClick={submitMissingItems} disabled={!canAdmin || !missingItemsDraft.trim()}>
                    Request Missing Items
                  </button>
                  {selected.status === "REPORT_READY" ? (
                    <div className="row" style={{ marginTop: "0.75rem" }}>
                      <button className="primary" onClick={() => submitReportDecision("APPROVE")} disabled={!canAdmin}>
                        Approve Report
                      </button>
                      <button className="warn" onClick={() => submitReportDecision("REJECT")} disabled={!canAdmin}>
                        Reject Report
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="card">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <strong>Audit Trail</strong>
                  <button className="secondary" onClick={() => setShowFullTimeline((prev) => !prev)}>
                    {showFullTimeline ? "Show Recent 10" : `Show Full (${timeline.length})`}
                  </button>
                </div>
                <div className="grid" style={{ gap: "0.45rem", marginTop: "0.6rem" }}>
                  {timelineEvents.map((event) => (
                    <div key={event.id} className="queue-item">
                      <div className="row" style={{ justifyContent: "space-between" }}>
                        <strong>{event.action}</strong>
                        <span className="small">{new Date(event.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="small">Actor: {event.actor}</p>
                      <button
                        className="secondary"
                        type="button"
                        onClick={() =>
                          setExpandedTimelineIds((prev) =>
                            prev.includes(event.id) ? prev.filter((id) => id !== event.id) : [...prev, event.id],
                          )
                        }
                      >
                        {expandedTimelineIds.includes(event.id) ? "Hide Details" : "Show Details"}
                      </button>
                      {expandedTimelineIds.includes(event.id) ? (
                        <pre className="small" style={{ whiteSpace: "pre-wrap", marginTop: "0.5rem" }}>
                          {JSON.stringify(event.details ?? {}, null, 2)}
                        </pre>
                      ) : null}
                    </div>
                  ))}
                </div>
                {!showFullTimeline && timeline.length > 10 ? (
                  <p className="small">Showing latest 10 events to keep this view fast.</p>
                ) : null}
              </div>
            </div>
          )}
        </article>
      </section>

      {canAdmin && activeOpsPanel === "add-brokerage" ? (
      <section className="card" style={{ order: 3 }}>
        <h2>Add Brokerage</h2>
        <p className="small">Create a brokerage once, then select it from dropdowns.</p>
        <div className="grid two">
          <label className="field">
            <span>Slug</span>
            <input
              value={newBrokerageForm.slug}
              onChange={(event) => setNewBrokerageForm((prev) => ({ ...prev, slug: event.target.value }))}
              placeholder="e.g. apex-brokers"
            />
          </label>
          <label className="field">
            <span>Name</span>
            <input
              value={newBrokerageForm.name}
              onChange={(event) => setNewBrokerageForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="e.g. Apex Brokers"
            />
          </label>
          <label className="field">
            <span>Short Name</span>
            <input
              value={newBrokerageForm.shortName}
              onChange={(event) => setNewBrokerageForm((prev) => ({ ...prev, shortName: event.target.value }))}
              placeholder="e.g. Apex"
            />
          </label>
          <label className="field">
            <span>Sender Name</span>
            <input
              value={newBrokerageForm.senderName}
              onChange={(event) => setNewBrokerageForm((prev) => ({ ...prev, senderName: event.target.value }))}
            />
          </label>
          <label className="field">
            <span>Sender Email</span>
            <input
              value={newBrokerageForm.senderEmail}
              onChange={(event) => setNewBrokerageForm((prev) => ({ ...prev, senderEmail: event.target.value }))}
            />
          </label>
          <label className="field">
            <span>Portal Base URL</span>
            <input
              value={newBrokerageForm.portalBaseUrl}
              onChange={(event) => setNewBrokerageForm((prev) => ({ ...prev, portalBaseUrl: event.target.value }))}
            />
          </label>
          <label className="field">
            <span>Drive Parent Folder ID (optional)</span>
            <input
              value={newBrokerageForm.driveParentFolderId}
              onChange={(event) =>
                setNewBrokerageForm((prev) => ({ ...prev, driveParentFolderId: event.target.value }))
              }
              placeholder="Google Drive folder ID"
            />
          </label>
        </div>
        <button
          className="primary"
          onClick={createBrokerage}
          disabled={
            !newBrokerageForm.slug ||
            !newBrokerageForm.name ||
            !newBrokerageForm.senderName ||
            !newBrokerageForm.senderEmail ||
            !newBrokerageForm.portalBaseUrl
          }
        >
          Create Brokerage
        </button>
      </section>
      ) : null}

      {canAdmin && activeOpsPanel === "update-brokerage" ? (
      <section className="card" style={{ order: 3 }}>
        <h2>Brokerage Branding Settings</h2>
        <p className="small">Configure smart fields, portal tone, and logo source.</p>

        <label className="field">
          <span>Search brokerages</span>
          <input
            value={brokerageSearch}
            onChange={(event) => setBrokerageSearch(event.target.value)}
            placeholder="Search by name, short name, or slug"
          />
        </label>

        <label className="field">
          <span>Brokerage</span>
          <select value={selectedBrokerageId} onChange={(event) => setSelectedBrokerageId(event.target.value)}>
            {filteredBrokerages.map((brokerage) => (
              <option key={brokerage.id} value={brokerage.id}>{brokerage.name} ({brokerage.slug})</option>
            ))}
          </select>
        </label>
        <label className="row" style={{ marginBottom: "0.8rem" }}>
          <input
            type="checkbox"
            checked={includeArchivedBrokerages}
            onChange={(event) => setIncludeArchivedBrokerages(event.target.checked)}
          />
          <span>Include archived brokerages in this list</span>
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
            <span>Drive parent folder ID</span>
            <input
              value={brandingForm.driveParentFolderId}
              onChange={(event) => setBrandingForm((prev) => ({ ...prev, driveParentFolderId: event.target.value }))}
              placeholder="Google Drive folder ID"
            />
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
          <div className="row" style={{ gridColumn: "1 / -1" }}>
            <button className="secondary" type="button" onClick={clearLogo} disabled={!selectedBrokerageId || !canAdmin}>
              Clear Logo
            </button>
            <span className="small">Use this to remove an existing logo from client-facing pages.</span>
          </div>
          <label className="field" style={{ gridColumn: "1 / -1" }}>
            <span>Legal footer</span>
            <textarea rows={3} value={brandingForm.legalFooter} onChange={(event) => setBrandingForm((prev) => ({ ...prev, legalFooter: event.target.value }))} />
          </label>
          <label className="row" style={{ gridColumn: "1 / -1" }}>
            <input type="checkbox" checked={brandingForm.showBeeSoldBranding} onChange={(event) => setBrandingForm((prev) => ({ ...prev, showBeeSoldBranding: event.target.checked }))} />
            <span>Show “Powered by BeeSold” on client-facing pages</span>
          </label>
        </div>

        <div className="grid" style={{ gap: "0.7rem", marginTop: "0.35rem" }}>
          <p className="small">Smart field preview: <code>{"{{brokerage.shortName}}"}</code> = {brandingForm.shortName || "(empty)"}</p>
          <div className="row" style={{ gap: "0.75rem" }}>
            <button
              className={selectedBrokerage?.isArchived ? "primary" : "warn"}
              type="button"
              onClick={() => toggleSelectedBrokerageArchive(!selectedBrokerage?.isArchived)}
              disabled={!selectedBrokerageId || !canAdmin}
            >
              {selectedBrokerage?.isArchived ? "Restore Brokerage" : "Archive Brokerage"}
            </button>
            <button className="primary" onClick={saveBranding} disabled={!selectedBrokerageId || !canAdmin}>Save Branding</button>
          </div>
          <span className="small">
            {selectedBrokerage?.isArchived
              ? "Archived brokerages are hidden by default."
              : "Archive hides this brokerage from normal dropdowns and client list defaults."}
          </span>
        </div>
      </section>
      ) : null}

      {canAdmin && activeOpsPanel === "dev-links" ? (
      <section className="card" style={{ order: 3 }}>
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
      ) : null}

      {canAdmin && activeOpsPanel === "create-client" ? (
      <section className="card" style={{ order: 3 }}>
        <h2>Create Listing</h2>
        <div className="grid two">
          <label className="field">
            <span>Brokerage</span>
            <select
              value={createForm.brokerageSlug}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, brokerageSlug: event.target.value }))
              }
            >
              {activeBrokerages.map((brokerage) => (
                <option key={brokerage.id} value={brokerage.slug}>
                  {brokerage.name} ({brokerage.slug})
                </option>
              ))}
            </select>
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
          disabled={
            !createForm.businessName ||
            !createForm.contactName ||
            !createForm.email ||
            activeBrokerages.length === 0
          }
        >
          Create + Send Invite
        </button>
        {activeBrokerages.length === 0 ? (
          <p className="small">No active brokerages available. Restore or create a brokerage first.</p>
        ) : null}
      </section>
      ) : null}

      {message ? <p className="small">{message}</p> : null}
    </AppShell>
  );
}
