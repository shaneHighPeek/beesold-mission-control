"use client";

import { isFieldRequired, isFieldVisible } from "@/lib/domain/intakeConfig";
import { useCallback, useEffect, useMemo, useState } from "react";

type LifecycleState =
  | "INVITED"
  | "IN_PROGRESS"
  | "PARTIAL_SUBMITTED"
  | "MISSING_ITEMS_REQUESTED"
  | "FINAL_SUBMITTED"
  | "KLOR_SYNTHESIS"
  | "COUNCIL_RUNNING"
  | "REPORT_READY"
  | "APPROVED";

type IntakeField = {
  name: string;
  label: string;
  type:
    | "text"
    | "textarea"
    | "email"
    | "phone"
    | "number"
    | "currency"
    | "date"
    | "single_select"
    | "multi_select"
    | "boolean"
    | "upload"
    | "signature";
  required?: boolean;
  placeholder?: string;
  options?: string[];
  helperText?: string;
  uploadCategory?: "FINANCIALS" | "LEGAL" | "PROPERTY" | "OTHER";
};

type IntakeStepDefinition = {
  key: string;
  title: string;
  subtitle: string;
  estimatedMinutes: number;
  description: string;
  fields: IntakeField[];
};

type IntakeStep = {
  stepKey: string;
  data: Record<string, unknown>;
  isComplete: boolean;
  order: number;
};

type IntakeAsset = {
  id: string;
  category: "FINANCIALS" | "LEGAL" | "PROPERTY" | "OTHER";
  fileName: string;
  revision: number;
};

type IntakeSessionResponse = {
  session: {
    id: string;
    status: LifecycleState;
    currentStep: number;
    totalSteps: number;
    completionPct: number;
    missingItems: string[];
  };
  steps: IntakeStep[];
  assets: IntakeAsset[];
  definitions: IntakeStepDefinition[];
  brokerage: {
    branding: {
      portalTone: "corporate" | "premium_advisory";
    };
  };
};

function guessMimeType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".heic")) return "image/heic";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".mov")) return "video/quicktime";
  return "application/octet-stream";
}

function toCurrencyInput(value: unknown): string {
  if (typeof value === "number") return String(value);
  if (typeof value !== "string") return "";
  return value.replace(/[^0-9.]/g, "");
}

function formatCurrencyDisplay(raw: string): string {
  if (!raw) return "";
  const n = Number(raw.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return raw;
  return `$${n.toLocaleString()}`;
}

function cleanLabel(label: string): string {
  return label.replace(/^Q\d+\.\d+\s*/i, "").trim();
}

function chunkFields(fields: IntakeField[]): IntakeField[][] {
  const groups: IntakeField[][] = [];
  let bucket: IntakeField[] = [];

  fields.forEach((field) => {
    const isLong = field.type === "textarea" || field.type === "upload" || field.type === "multi_select";
    const limit = isLong ? 2 : 4;

    if (bucket.length >= limit) {
      groups.push(bucket);
      bucket = [];
    }

    if (isLong && bucket.length > 0) {
      groups.push(bucket);
      bucket = [field];
      return;
    }

    bucket.push(field);
  });

  if (bucket.length) {
    groups.push(bucket);
  }

  return groups.length ? groups : [[]];
}

function microCopy(index: number, tone: "corporate" | "premium_advisory"): string {
  const corporate = [
    "Strong start. This segment is brief.",
    "Progress is on track. Continue to the next prompt set.",
    "Good momentum. A short set remains in this segment.",
    "Nearly complete for this segment.",
  ];
  const advisory = [
    "Great start. This part is quick.",
    "Nice pace. Keep moving, you are doing great.",
    "Excellent. A few short prompts left in this part.",
    "Strong progress. Final touches here.",
  ];
  const messages = tone === "corporate" ? corporate : advisory;
  return messages[index % messages.length];
}

function getSegmentNudge(
  stepKey: string,
  chunkIndex: number,
  chunkCount: number,
  isFinalStep: boolean,
  tone: "corporate" | "premium_advisory",
): {
  title: string;
  body: string;
  cta: string;
} {
  const nearEnd = chunkIndex >= Math.max(0, chunkCount - 2);

  if (isFinalStep) {
    const body =
      tone === "corporate"
        ? "These final items support accurate packaging, compliance readiness, and execution quality."
        : "These last prompts help your advisor package your opportunity clearly and accurately.";
    return {
      title: nearEnd ? "Final details" : "Quick close-out",
      body,
      cta: nearEnd ? "Review Final Details" : "Continue",
    };
  }

  const map: Record<string, { title: string; body: string; cta: string }> = tone === "corporate"
    ? {
        asset_snapshot: {
          title: "Core profile data",
          body: "These fields establish legal and operating identity for downstream processing.",
          cta: "Continue",
        },
        financial_overview: {
          title: "Financial data set",
          body: "Provide highest-confidence figures first. Supporting items can be refined progressively.",
          cta: "Continue",
        },
        revenue_operations: {
          title: "Operating model",
          body: "This informs sustainability, scalability, and buyer fit assessment.",
          cta: "Continue",
        },
        property_assets: {
          title: "Asset scope",
          body: "Clear asset and tenure data minimizes rework and accelerates validation.",
          cta: "Continue",
        },
        performance_growth: {
          title: "Growth context",
          body: "Use this section to frame strategic upside and transferability.",
          cta: "Continue",
        },
        market_compliance: {
          title: "Risk and market position",
          body: "Accurate disclosure here reduces legal friction and buyer uncertainty.",
          cta: "Continue",
        },
        media_pricing_final: {
          title: "Submission packaging",
          body: "Media quality and terms clarity directly impact buyer response quality.",
          cta: "Continue",
        },
      }
    : {
      asset_snapshot: {
        title: "Foundation details",
        body: "Short setup items first. This helps pre-fill and streamline the remaining prompts.",
        cta: "Looks Good, Continue",
      },
    financial_overview: {
      title: "Financial clarity",
      body: "Share the highest-confidence figures first. You can refine supporting detail as you go.",
      cta: "Save and Continue",
    },
    revenue_operations: {
      title: "How the business runs",
      body: "This helps position stability and operating strength to the right buyer profiles.",
      cta: "Continue",
    },
    property_assets: {
      title: "Asset and property scope",
      body: "Clear asset detail reduces back-and-forth later and improves buyer confidence early.",
      cta: "Continue",
    },
    performance_growth: {
      title: "Growth narrative",
      body: "Your context here is high-impact. It often drives stronger engagement than numbers alone.",
      cta: "Continue",
    },
    market_compliance: {
      title: "Market and risk context",
      body: "Clear disclosure upfront protects momentum and avoids late-stage friction.",
      cta: "Continue",
    },
      media_pricing_final: {
        title: "Final package quality",
        body: "High-quality media and clear terms materially increase buyer response quality.",
        cta: "Continue",
      },
    };

  const base = map[stepKey] ?? {
    title: "Next segment",
    body: "A short set of prompts keeps everything moving smoothly.",
    cta: "Continue",
  };

  if (nearEnd) {
    return {
      title: `${base.title} · Almost there`,
      body: "Great progress. A couple more items in this part and you will move straight on.",
      cta: "Finish This Part",
    };
  }

  return base;
}

export function IntakeClient({ brokerageSlug }: { brokerageSlug: string }) {
  const [data, setData] = useState<IntakeSessionResponse | null>(null);
  const [activeStep, setActiveStep] = useState(1);
  const [activeChunk, setActiveChunk] = useState(0);
  const [formState, setFormState] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadDrafts, setUploadDrafts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/portal/${brokerageSlug}/session`, { cache: "no-store" });
    const payload = (await response.json()) as { ok: boolean; data: IntakeSessionResponse; error?: string };

    if (!payload.ok) {
      setMessage(payload.error ?? "Session unavailable. Please sign in again.");
      return;
    }

    setData(payload.data);
    setActiveStep(payload.data.session.currentStep);
  }, [brokerageSlug]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const currentStep = useMemo(() => {
    if (!data) return null;
    return data.definitions[activeStep - 1] ?? null;
  }, [data, activeStep]);

  useEffect(() => {
    if (!data || !currentStep) return;

    const existing = data.steps.find((step) => step.stepKey === currentStep.key);
    const nextState = { ...(existing?.data ?? {}) };

    currentStep.fields.forEach((field) => {
      if (field.type === "date" && !nextState[field.name]) {
        nextState[field.name] = new Date().toISOString().slice(0, 10);
      }
    });

    setFormState(nextState);
    setErrors({});
    setActiveChunk(0);
  }, [data, currentStep]);

  const visibleFields = useMemo(() => {
    if (!currentStep) return [];
    return currentStep.fields.filter((field) => isFieldVisible(field, formState));
  }, [currentStep, formState]);

  const chunks = useMemo(() => chunkFields(visibleFields), [visibleFields]);

  useEffect(() => {
    if (activeChunk > chunks.length - 1) {
      setActiveChunk(Math.max(0, chunks.length - 1));
    }
  }, [activeChunk, chunks.length]);

  useEffect(() => {
    if (!currentStep || !data) return;

    const timer = setTimeout(async () => {
      await fetch(`/api/portal/${brokerageSlug}/save-step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stepKey: currentStep.key,
          data: formState,
          currentStep: activeStep,
          markComplete: false,
        }),
      });
    }, 450);

    return () => clearTimeout(timer);
  }, [brokerageSlug, currentStep, data, formState, activeStep]);

  if (!data || !currentStep) {
    return (
      <div className="card">
        <p>Preparing your guided intake...</p>
      </div>
    );
  }

  const session = data.session;
  const step = currentStep;
  const tone = data.brokerage?.branding?.portalTone ?? "premium_advisory";
  const chunk = chunks[activeChunk] ?? [];
  const isLastChunk = activeChunk === chunks.length - 1;
  const onFinalStep = activeStep === session.totalSteps;
  const nudge = getSegmentNudge(step.key, activeChunk, chunks.length, onFinalStep, tone);
  const momentumProgress =
    session.status === "FINAL_SUBMITTED" || session.status === "APPROVED"
      ? 100
      : Math.min(97, Math.max(70, Math.round(70 + session.completionPct * 0.27 + activeChunk * 3)));

  function setField(name: string, value: unknown) {
    setFormState((prev) => ({ ...prev, [name]: value }));
  }

  function validateChunk(fields: IntakeField[]): boolean {
    const nextErrors: Record<string, string> = {};

    fields.forEach((field) => {
      const value = formState[field.name];
      const required = isFieldRequired(field, formState);

      if (required) {
        const missing =
          field.type === "boolean"
            ? value !== true
            : Array.isArray(value)
              ? value.length === 0
              : typeof value !== "string" || !value.trim();

        if (missing) {
          nextErrors[field.name] = `${cleanLabel(field.label)} is required`;
          return;
        }
      }

      if (field.name === "q1_6_postcode" && typeof value === "string" && value && !/^\d{4}$/.test(value)) {
        nextErrors[field.name] = "Postcode must be 4 digits";
      }

      if (field.name === "q1_8_abn" && typeof value === "string" && value && !/^\d{11}$/.test(value)) {
        nextErrors[field.name] = "ABN must be 11 digits";
      }

      if (field.name === "q1_14_brief_description" && typeof value === "string" && value.trim()) {
        const words = value.trim().split(/\s+/).filter(Boolean);
        if (words.length > 150) {
          nextErrors[field.name] = "Brief description must be 150 words or fewer";
        }
      }
    });

    if (step.key === "revenue_operations") {
      const pctFields = [
        "q3_1_bar_pct",
        "q3_1_food_pct",
        "q3_1_accommodation_pct",
        "q3_1_retail_pct",
        "q3_1_gaming_pct",
        "q3_1_functions_pct",
        "q3_1_other_pct",
      ];
      const hasAnyPctInChunk = fields.some((field) => pctFields.includes(field.name));
      if (hasAnyPctInChunk) {
        const ready = pctFields.every((name) => String(formState[name] ?? "").trim().length > 0);
        if (ready) {
          const total = pctFields.reduce((sum, name) => sum + Number(formState[name] ?? 0), 0);
          if (Math.round(total) !== 100) {
            nextErrors.q3_1_bar_pct = "Revenue percentages must total 100%";
          }
        }
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function saveAndAdvanceSection() {
    await fetch(`/api/portal/${brokerageSlug}/save-step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stepKey: step.key,
        data: formState,
        currentStep: Math.min(activeStep + 1, session.totalSteps),
        markComplete: true,
      }),
    });

    setMessage("Excellent. Your next segment is ready.");
    await refresh();
    setActiveStep((value) => Math.min(value + 1, session.totalSteps));
  }

  async function continueChunk() {
    if (!validateChunk(chunk)) return;

    if (!isLastChunk) {
      setActiveChunk((value) => value + 1);
      setMessage(tone === "corporate" ? "Segment saved. Continue when ready." : "Nice momentum. Next short segment is ready.");
      return;
    }

    if (onFinalStep) return;
    await saveAndAdvanceSection();
  }

  async function saveExit() {
    await fetch(`/api/portal/${brokerageSlug}/save-exit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentStep: activeStep }),
    });
    setMessage(
      tone === "corporate"
        ? "Saved securely. You can resume from this point at any time."
        : "Saved securely. You can return anytime from the same portal.",
    );
  }

  async function addAsset(field: IntakeField) {
    const fileName = (uploadDrafts[field.name] ?? "").trim();
    if (!fileName) return;

    await fetch(`/api/portal/${brokerageSlug}/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: field.uploadCategory ?? "OTHER",
        fileName,
        mimeType: guessMimeType(fileName),
        sizeBytes: 100000,
      }),
    });

    const existing = Array.isArray(formState[field.name]) ? (formState[field.name] as string[]) : [];
    setField(field.name, [...existing, fileName]);
    setUploadDrafts((prev) => ({ ...prev, [field.name]: "" }));
    setMessage("File added.");
    await refresh();
  }

  async function partialSubmit() {
    await fetch(`/api/portal/${brokerageSlug}/submit-partial`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: "Client submitted available data" }),
    });
    setMessage(
      tone === "corporate"
        ? "Partial submission captured. Additional details can be added later."
        : "Submission captured. You can keep adding detail when ready.",
    );
    await refresh();
  }

  async function finalSubmit() {
    if (!validateChunk(chunk)) return;

    await fetch(`/api/portal/${brokerageSlug}/submit-final`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    setMessage(tone === "corporate" ? "Submission complete and received." : "Complete. Your submission has been received.");
    await refresh();
  }

  function renderField(field: IntakeField) {
    const value = formState[field.name];
    const label = cleanLabel(field.label);

    if (field.type === "textarea") {
      return (
        <label className="field" key={field.name}>
          <span>{label}{isFieldRequired(field, formState) ? " *" : ""}</span>
          <textarea
            value={String(value ?? "")}
            placeholder={field.placeholder}
            onChange={(event) => setField(field.name, event.target.value)}
          />
          {field.helperText ? <span className="small">{field.helperText}</span> : null}
          {errors[field.name] ? <span className="error">{errors[field.name]}</span> : null}
        </label>
      );
    }

    if (field.type === "single_select") {
      return (
        <label className="field" key={field.name}>
          <span>{label}{isFieldRequired(field, formState) ? " *" : ""}</span>
          <select value={String(value ?? "")} onChange={(event) => setField(field.name, event.target.value)}>
            <option value="">Select...</option>
            {(field.options ?? []).map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          {errors[field.name] ? <span className="error">{errors[field.name]}</span> : null}
        </label>
      );
    }

    if (field.type === "multi_select") {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <fieldset className="field" key={field.name}>
          <legend>{label}{isFieldRequired(field, formState) ? " *" : ""}</legend>
          {(field.options ?? []).map((option) => (
            <label key={option} className="row">
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={(event) => {
                  const next = event.target.checked
                    ? [...selected, option]
                    : selected.filter((item) => item !== option);
                  setField(field.name, next);
                }}
              />
              <span>{option}</span>
            </label>
          ))}
          {errors[field.name] ? <span className="error">{errors[field.name]}</span> : null}
        </fieldset>
      );
    }

    if (field.type === "boolean") {
      return (
        <label key={field.name} className="row">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(event) => setField(field.name, event.target.checked)}
          />
          <span>{label}</span>
          {errors[field.name] ? <span className="error">{errors[field.name]}</span> : null}
        </label>
      );
    }

    if (field.type === "upload") {
      const linked = Array.isArray(formState[field.name]) ? (formState[field.name] as string[]) : [];
      return (
        <div className="field" key={field.name}>
          <span>{label}{isFieldRequired(field, formState) ? " *" : ""}</span>
          <div className="row">
            <input
              value={uploadDrafts[field.name] ?? ""}
              placeholder="Add a file name (e.g. lease.pdf)"
              onChange={(event) =>
                setUploadDrafts((prev) => ({ ...prev, [field.name]: event.target.value }))
              }
            />
            <button className="secondary" type="button" onClick={() => addAsset(field)}>
              Add
            </button>
          </div>
          {linked.length > 0 ? <span className="small">{linked.length} file(s) linked</span> : null}
          {errors[field.name] ? <span className="error">{errors[field.name]}</span> : null}
        </div>
      );
    }

    const inputType =
      field.type === "email"
        ? "email"
        : field.type === "date"
          ? "date"
          : field.type === "number"
            ? "number"
            : field.type === "phone"
              ? "tel"
              : "text";

    const inputValue = field.type === "currency" ? toCurrencyInput(value) : String(value ?? "");

    return (
      <label className="field" key={field.name}>
        <span>{label}{isFieldRequired(field, formState) ? " *" : ""}</span>
        <input
          type={inputType}
          value={inputValue}
          placeholder={field.placeholder}
          onChange={(event) => {
            const raw = event.target.value;
            if (field.type === "number") {
              setField(field.name, raw.replace(/[^0-9.]/g, ""));
              return;
            }
            if (field.type === "currency") {
              setField(field.name, raw.replace(/[^0-9.]/g, ""));
              return;
            }
            setField(field.name, raw);
          }}
          onBlur={() => {
            if (field.type === "currency") {
              setField(field.name, formatCurrencyDisplay(toCurrencyInput(formState[field.name])));
            }
          }}
        />
        {field.helperText ? <span className="small">{field.helperText}</span> : null}
        {errors[field.name] ? <span className="error">{errors[field.name]}</span> : null}
      </label>
    );
  }

  return (
    <section className="grid" style={{ gap: "1rem" }}>
      <header className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>{currentStep.title}</h2>
          <span className="badge">{session.status}</span>
        </div>
        <p>{step.subtitle}</p>
        <p className="small">{microCopy(activeChunk, tone)} Estimated focus time: {step.estimatedMinutes} minutes.</p>
        <p className="small">{nudge.body}</p>
        <div className="progress" aria-label="intake momentum progress">
          <span style={{ width: `${momentumProgress}%` }} />
        </div>
        <p className="small">Momentum: {momentumProgress}%</p>
        {session.missingItems.length > 0 ? (
          <div className="card" style={{ background: "#fff7ea", marginTop: "0.75rem" }}>
            <strong>Items requested by your advisor</strong>
            <ul>
              {session.missingItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </header>

      <section className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <strong>{nudge.title}</strong>
          <span className="small">{activeChunk + 1} / {chunks.length}</span>
        </div>

        <div className="grid" style={{ gap: "0.75rem", marginTop: "0.75rem" }}>
          {chunk.map((field) => renderField(field))}
        </div>

        <div className="row" style={{ marginTop: "1rem" }}>
          <button
            className="secondary"
            onClick={() => {
              if (activeChunk > 0) {
                setActiveChunk((value) => value - 1);
                return;
              }
              setActiveStep((value) => Math.max(1, value - 1));
            }}
            disabled={activeStep === 1 && activeChunk === 0}
          >
            Back
          </button>

          {!onFinalStep && (
            <button className="primary" onClick={continueChunk}>
              {isLastChunk ? "Finish This Part" : nudge.cta}
            </button>
          )}

          {onFinalStep && (
            <>
              <button className="secondary" onClick={partialSubmit}>Submit What I Have</button>
              <button className="primary" onClick={finalSubmit}>Finish and Submit</button>
            </>
          )}

          <button className="secondary" onClick={saveExit}>Save & Exit</button>
        </div>

        {message ? <p className="small">{message}</p> : null}
      </section>

      <section className="card">
        <h3>Files You&apos;ve Added</h3>
        {data.assets.length === 0 ? (
          <p className="small">No files added yet.</p>
        ) : (
          <ul>
            {data.assets.map((asset) => (
              <li key={asset.id}>
                {asset.category}: {asset.fileName} (rev {asset.revision})
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
