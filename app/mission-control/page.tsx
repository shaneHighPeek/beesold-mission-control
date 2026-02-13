"use client";

import { useEffect, useMemo, useState } from "react";

type IntakeStatus =
  | "DRAFT"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "KLOR_SYNTHESIS"
  | "COUNCIL_RUNNING"
  | "REPORT_READY"
  | "APPROVED";

type IntakeItem = {
  id: string;
  clientName: string;
  clientEmail: string;
  status: IntakeStatus;
  jobs: Array<{ id: string; kind: string; status: string }>;
  report?: { id: string; title: string; summary: string };
};

type ReportPayload = {
  report?: {
    id: string;
    title: string;
    summary: string;
    findings: string[];
    recommendations: string[];
    approvedAt?: string;
  };
  session?: { id: string; status: IntakeStatus };
};

export default function MissionControlPage() {
  const [items, setItems] = useState<IntakeItem[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [reportData, setReportData] = useState<ReportPayload | null>(null);
  const [decisionNote, setDecisionNote] = useState("");

  async function refresh() {
    const response = await fetch("/api/mission-control/intakes", { cache: "no-store" });
    const payload = (await response.json()) as { ok: boolean; data: { items: IntakeItem[] } };
    if (payload.ok) {
      setItems(payload.data.items);
      if (!selectedSessionId && payload.data.items.length > 0) {
        setSelectedSessionId(payload.data.items[0].id);
      }
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!selectedSessionId) return;

    fetch(`/report?sessionId=${selectedSessionId}`)
      .then((response) => response.json())
      .then((payload: { ok: boolean; data: ReportPayload }) => {
        if (payload.ok) setReportData(payload.data);
      });
  }, [selectedSessionId, items]);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedSessionId),
    [items, selectedSessionId],
  );

  async function decide(decision: "APPROVE" | "REJECT") {
    if (!selectedSessionId) return;

    await fetch("/approval", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: selectedSessionId,
        decision,
        operatorName: "Phase1 Operator",
        note: decisionNote,
      }),
    });

    await refresh();
  }

  return (
    <main className="grid" style={{ gap: "1rem" }}>
      <header className="card">
        <h1>Mission Control Operator Cockpit</h1>
        <p>Monitor intake lifecycle, deterministic pipeline progress, and approval gates.</p>
      </header>

      <section className="grid two">
        <article className="card">
          <h2>Intake Pipeline Queue</h2>
          <div className="grid" style={{ gap: "0.55rem" }}>
            {items.map((item) => (
              <button
                key={item.id}
                className="secondary"
                style={{ textAlign: "left" }}
                onClick={() => setSelectedSessionId(item.id)}
              >
                <strong>{item.clientName}</strong>
                <div className="small">{item.clientEmail}</div>
                <div className="row">
                  <span className="badge">{item.status}</span>
                  {item.jobs.map((job) => (
                    <span className="badge" key={job.id}>
                      {job.kind}: {job.status}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </article>

        <article className="card">
          <h2>Report Viewer</h2>
          {!selectedItem ? (
            <p className="small">No intake sessions available.</p>
          ) : !reportData?.report ? (
            <p className="small">Report not ready for this intake.</p>
          ) : (
            <div className="grid" style={{ gap: "0.65rem" }}>
              <h3>{reportData.report.title}</h3>
              <p>{reportData.report.summary}</p>

              <div>
                <strong>Findings</strong>
                <ul>
                  {reportData.report.findings.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <div>
                <strong>Recommendations</strong>
                <ul>
                  {reportData.report.recommendations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <label className="field">
                <span>Decision note</span>
                <textarea
                  value={decisionNote}
                  onChange={(event) => setDecisionNote(event.target.value)}
                  rows={4}
                />
              </label>

              <div className="row">
                <button
                  className="primary"
                  onClick={() => decide("APPROVE")}
                  disabled={selectedItem.status !== "REPORT_READY"}
                >
                  Approve
                </button>
                <button
                  className="warn"
                  onClick={() => decide("REJECT")}
                  disabled={selectedItem.status !== "REPORT_READY"}
                >
                  Reject for Rework
                </button>
              </div>
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
