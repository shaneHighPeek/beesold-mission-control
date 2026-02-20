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
  validation?: {
    sumGroup?: string;
    min?: number;
    max?: number;
  };
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

type SectionCelebration = {
  completedTitle: string;
  nextTitle: string;
  nextSubtitle: string;
  overallProgress: number;
};

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
  const consumed = new Set<string>();

  function flushBucket() {
    if (bucket.length > 0) {
      groups.push(bucket);
      bucket = [];
    }
  }

  fields.forEach((field) => {
    if (consumed.has(field.name)) {
      return;
    }

    if (field.type === "upload") {
      const groupedUploads = fields.filter((item) => item.type === "upload" && !consumed.has(item.name));
      if (groupedUploads.length > 0) {
        flushBucket();
        groupedUploads.forEach((item) => consumed.add(item.name));
        groups.push(groupedUploads);
      }
      return;
    }

    if (/^q7_(1[4-9]|20)_/.test(field.name)) {
      const declarationGroup = fields.filter((item) => /^q7_(1[4-9]|20)_/.test(item.name) && !consumed.has(item.name));
      if (declarationGroup.length > 0) {
        flushBucket();
        declarationGroup.forEach((item) => consumed.add(item.name));
        groups.push(declarationGroup);
      }
      return;
    }

    const sumGroup = field.validation?.sumGroup;
    if (sumGroup) {
      const grouped = fields.filter((item) => item.validation?.sumGroup === sumGroup && !consumed.has(item.name));
      if (grouped.length > 0) {
        flushBucket();
        grouped.forEach((item) => consumed.add(item.name));
        groups.push(grouped);
      }
      return;
    }

    const isLong = field.type === "textarea" || field.type === "multi_select";
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

    consumed.add(field.name);
    bucket.push(field);
  });

  flushBucket();

  return groups.length ? groups : [[]];
}

function parseNumberish(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    return Number(cleaned);
  }
  return Number(value);
}

function hasProgressValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return value;
  return value !== null && value !== undefined;
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
  const [message, setMessage] = useState("");
  const [celebration, setCelebration] = useState<SectionCelebration | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isSubmittingFinal, setIsSubmittingFinal] = useState(false);
  const [finalSubmitted, setFinalSubmitted] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<Record<string, File[]>>({});
  const [uploadingFields, setUploadingFields] = useState<Record<string, boolean>>({});

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

      // Percentage sum groups should feel instantly usable; default blanks to 0.
      if (field.validation?.sumGroup && (nextState[field.name] === undefined || nextState[field.name] === "")) {
        nextState[field.name] = "0";
      }
    });

    setFormState(nextState);
    setErrors({});
    setActiveChunk(0);
    setPendingUploads({});
  }, [data, currentStep]);

  const visibleFields = useMemo(() => {
    if (!currentStep) return [];
    return currentStep.fields.filter((field) => isFieldVisible(field, formState));
  }, [currentStep, formState]);

  const chunks = useMemo(() => chunkFields(visibleFields), [visibleFields]);
  const activeChunkFields = useMemo(() => chunks[activeChunk] ?? [], [chunks, activeChunk]);
  const activeSumGroup = useMemo(
    () => activeChunkFields.map((field) => field.validation?.sumGroup).find((item): item is string => Boolean(item)),
    [activeChunkFields],
  );
  const activeSumGroupFields = useMemo(() => {
    if (!activeSumGroup) return [];
    return visibleFields.filter((field) => field.validation?.sumGroup === activeSumGroup);
  }, [activeSumGroup, visibleFields]);
  const activeSumGroupTotal = useMemo(() => {
    if (!activeSumGroup) return 0;
    return activeSumGroupFields.reduce((sum, field) => {
      const n = parseNumberish(formState[field.name]);
      return Number.isFinite(n) ? sum + n : sum;
    }, 0);
  }, [activeSumGroup, activeSumGroupFields, formState]);
  const activeSumGroupRemaining = Math.round((100 - activeSumGroupTotal) * 100) / 100;
  const activeSumGroupAllEntered = useMemo(() => {
    if (!activeSumGroup) return false;
    return activeSumGroupFields.every((field) => String(formState[field.name] ?? "").trim().length > 0);
  }, [activeSumGroup, activeSumGroupFields, formState]);

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

  useEffect(() => {
    if (!celebration) return;
    const timer = setTimeout(() => setCelebration(null), 2200);
    return () => clearTimeout(timer);
  }, [celebration]);

  const sectionProgress = useMemo(() => {
    if (visibleFields.length === 0) return 0;
    const complete = visibleFields.filter((field) => hasProgressValue(formState[field.name])).length;
    return Math.round((complete / visibleFields.length) * 100);
  }, [visibleFields, formState]);

  if (!data || !currentStep) {
    return (
      <div className="card">
        <p>Preparing your guided intake...</p>
      </div>
    );
  }

  const session = data.session;
  const isPostSubmitState = ["FINAL_SUBMITTED", "KLOR_SYNTHESIS", "COUNCIL_RUNNING", "REPORT_READY", "APPROVED"].includes(
    session.status,
  );
  const step = currentStep;
  const tone = data.brokerage?.branding?.portalTone ?? "premium_advisory";
  const chunk = activeChunkFields;
  const isLastChunk = activeChunk === chunks.length - 1;
  const onFinalStep = activeStep === session.totalSteps;
  const nudge = getSegmentNudge(step.key, activeChunk, chunks.length, onFinalStep, tone);
  const overallProgress = Math.round((((activeStep - 1) + sectionProgress / 100) / Math.max(session.totalSteps, 1)) * 100);

  function setField(name: string, value: unknown) {
    setFormState((prev) => ({ ...prev, [name]: value }));
  }

  function getUploadAccept(field: IntakeField): string {
    if (field.name === "q7_1_upload_photos") return ".jpg,.jpeg,.png,.heic";
    if (field.name === "q7_2_upload_video") return ".mp4,.mov";
    if (field.name === "q7_3_upload_im") return ".pdf,.docx";
    return ".pdf,.jpg,.jpeg,.png,.heic,.mp4,.mov,.xls,.xlsx,.csv,.docx";
  }

  function getUploadLimits(field: IntakeField): { min?: number; max?: number } {
    if (field.name === "q7_1_upload_photos") return { min: 3, max: 10 };
    return {};
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

      if (field.type === "upload") {
        const linked = Array.isArray(value) ? (value as string[]) : [];
        const limits = getUploadLimits(field);
        if (limits.min !== undefined && linked.length < limits.min) {
          nextErrors[field.name] = `Add at least ${limits.min} file(s)`;
        }
        if (limits.max !== undefined && linked.length > limits.max) {
          nextErrors[field.name] = `Maximum ${limits.max} files allowed`;
        }
      }
    });

    const chunkSumGroups = Array.from(
      new Set(fields.map((field) => field.validation?.sumGroup).filter((item): item is string => Boolean(item))),
    );
    chunkSumGroups.forEach((group) => {
      const groupFields = visibleFields.filter((field) => field.validation?.sumGroup === group);
      const ready = groupFields.every((field) => String(formState[field.name] ?? "").trim().length > 0);
      if (!ready) return;
      const total = groupFields.reduce((sum, field) => {
        const n = parseNumberish(formState[field.name]);
        return Number.isFinite(n) ? sum + n : sum;
      }, 0);
      if (Math.round(total) !== 100) {
        nextErrors[`${group}__sum`] = "All revenue percentages must add up to 100%.";
      }
    });

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function saveAndAdvanceSection() {
    if (isTransitioning) return;
    setIsTransitioning(true);

    const nextStepNumber = Math.min(activeStep + 1, session.totalSteps);
    const nextStepDef = data?.definitions[nextStepNumber - 1];
    const projectedOverall = Math.round((nextStepNumber / Math.max(session.totalSteps, 1)) * 100);

    // Optimistic UX: celebrate and move immediately while save completes in the background.
    setCelebration({
      completedTitle: step.title,
      nextTitle: nextStepDef?.title ?? "Next section",
      nextSubtitle: nextStepDef?.subtitle ?? "Continue with the next guided segment.",
      overallProgress: projectedOverall,
    });

    setActiveStep(nextStepNumber);
    setActiveChunk(0);
    setErrors({});
    setMessage("Excellent. Your next segment is ready.");

    try {
      await fetch(`/api/portal/${brokerageSlug}/save-step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stepKey: step.key,
          data: formState,
          currentStep: nextStepNumber,
          markComplete: true,
        }),
      });
      await refresh();
    } catch {
      setMessage("We could not save that step. Please retry.");
    } finally {
      setIsTransitioning(false);
    }
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

  async function addAssets(field: IntakeField) {
    const files = pendingUploads[field.name] ?? [];
    if (files.length === 0) return;
    const existing = Array.isArray(formState[field.name]) ? (formState[field.name] as string[]) : [];
    const limits = getUploadLimits(field);
    const max = limits.max ?? Number.POSITIVE_INFINITY;
    const remaining = Math.max(0, max - existing.length);
    const selected = files.slice(0, remaining);
    const skipped = files.length - selected.length;

    setUploadingFields((prev) => ({ ...prev, [field.name]: true }));
    setMessage(`Uploading ${selected.length} file(s)...`);

    try {
      const results = await Promise.allSettled(
        selected.map(async (file) => {
          const form = new FormData();
          form.set("category", field.uploadCategory ?? "OTHER");
          form.set("file", file);

          const response = await fetch(`/api/portal/${brokerageSlug}/assets`, {
            method: "POST",
            body: form,
          });
          const payload = (await response.json()) as { ok?: boolean; error?: string };
          if (!response.ok || payload.ok === false) {
            throw new Error(payload.error ?? `Could not upload ${file.name}.`);
          }
          return file.name;
        }),
      );

      const added: string[] = [];
      let failed = 0;
      results.forEach((result) => {
        if (result.status === "fulfilled") {
          added.push(result.value);
          return;
        }
        failed += 1;
      });

      setField(field.name, [...existing, ...added]);
      setPendingUploads((prev) => ({ ...prev, [field.name]: [] }));
      await refresh();
      const messages: string[] = [];
      messages.push(`Added ${added.length} file(s).`);
      if (failed > 0) {
        messages.push(`${failed} failed. Please retry those files.`);
      }
      if (skipped > 0) {
        messages.push(`${skipped} skipped due to upload limit.`);
      }
      setMessage(messages.join(" "));
    } catch {
      setMessage("Upload failed. Please retry.");
    } finally {
      setUploadingFields((prev) => ({ ...prev, [field.name]: false }));
    }
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
    if (isSubmittingFinal) return;
    if (!validateChunk(chunk)) return;

    setIsSubmittingFinal(true);
    try {
      const response = await fetch(`/api/portal/${brokerageSlug}/submit-final`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || payload.ok === false) {
        setMessage(payload.error ?? "Final submission is not ready yet. Please check required fields and uploads.");
        return;
      }
      setFinalSubmitted(true);
      setMessage(tone === "corporate" ? "Submission complete and received." : "Complete. Your submission has been received.");
      await refresh();
    } finally {
      setIsSubmittingFinal(false);
    }
  }

  function removeLinkedUpload(field: IntakeField, fileName: string) {
    const linked = Array.isArray(formState[field.name]) ? (formState[field.name] as string[]) : [];
    setField(
      field.name,
      linked.filter((item) => item !== fileName),
    );
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
      const queued = pendingUploads[field.name] ?? [];
      const isUploading = uploadingFields[field.name] === true;
      const limits = getUploadLimits(field);
      return (
        <div className="field" key={field.name}>
          <span>{label}{isFieldRequired(field, formState) ? " *" : ""}</span>
          <input
            type="file"
            multiple
            accept={getUploadAccept(field)}
            onChange={(event) => {
              const picked = Array.from(event.target.files ?? []);
              setPendingUploads((prev) => ({ ...prev, [field.name]: picked }));
            }}
          />
          {queued.length > 0 ? (
            <div className="row">
              <span className="small">{queued.length} file(s) selected</span>
              <button
                className="primary"
                type="button"
                onClick={() => addAssets(field)}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <span className="spinner" /> Uploading...
                  </>
                ) : "Upload"}
              </button>
            </div>
          ) : null}
          {field.name === "q7_1_upload_photos" ? (
            <span className="small">Minimum 3 photos required. Maximum 10 photos.</span>
          ) : null}
          <span className="small">
            {linked.length} file(s) linked
            {limits.min !== undefined ? ` · min ${limits.min}` : ""}
            {limits.max !== undefined ? ` · max ${limits.max}` : ""}
          </span>
          {linked.length > 0 ? (
            <div className="grid" style={{ gap: "0.35rem" }}>
              {linked.map((name) => (
                <div key={name} className="row" style={{ justifyContent: "space-between" }}>
                  <span className="small">{name}</span>
                  <button className="secondary" type="button" onClick={() => removeLinkedUpload(field, name)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : null}
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
      {finalSubmitted || isPostSubmitState ? (
        <section className="card section-celebration" aria-live="polite">
          <p className="celebration-kicker">Form Complete</p>
          <h3>Your intake form is complete and submitted.</h3>
          <p className="small">
            Your advisor has everything needed to begin the next internal review steps. It is safe to close this page now.
          </p>
          <div className="row" style={{ marginTop: "0.6rem" }}>
            <span className="badge">{session.status}</span>
            <button className="secondary" type="button" onClick={() => window.location.reload()}>
              Refresh Status
            </button>
          </div>
        </section>
      ) : null}

      {!(finalSubmitted || isPostSubmitState) ? (
        <>
      {celebration ? (
        <section className="card section-celebration" aria-live="polite">
          <p className="celebration-kicker">Section Complete</p>
          <h3>{celebration.completedTitle} finished</h3>
          <p className="small">Great work. You&apos;re moving well through onboarding.</p>
          <div className="progress" aria-label="overall completion after section">
            <span style={{ width: `${celebration.overallProgress}%` }} />
          </div>
          <p className="small">Overall completion: {celebration.overallProgress}%</p>
          <div className="next-intro">
            <strong>Next: {celebration.nextTitle}</strong>
            <p className="small">{celebration.nextSubtitle}</p>
          </div>
        </section>
      ) : null}

      <header className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>{currentStep.title}</h2>
          <span className="badge">{session.status}</span>
        </div>
        <p>{step.subtitle}</p>
        <p className="small">{microCopy(activeChunk, tone)} Estimated focus time: {step.estimatedMinutes} minutes.</p>
        <p className="small">{nudge.body}</p>
        <div className="progress" aria-label="current section progress">
          <span style={{ width: `${sectionProgress}%` }} />
        </div>
        <p className="small">Section progress: {sectionProgress}% · Overall progress: {overallProgress}%</p>
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
        <p className="small">Tip: complete what you can now, then use Save & Exit anytime.</p>

        <div className="grid" style={{ gap: "0.75rem", marginTop: "0.75rem" }}>
          {activeSumGroup ? (
            <div className="card" style={{ background: "#f8f9ff" }}>
              <strong>Revenue Mix Check</strong>
              <p className="small">All revenue percentage fields in this section must total exactly 100%.</p>
              <p className="small">
                Total entered: {Math.round(activeSumGroupTotal * 100) / 100}% · Remaining: {activeSumGroupRemaining}%
              </p>
              {activeSumGroupAllEntered && Math.round(activeSumGroupTotal) === 100 ? (
                <p className="small">Perfect. Your revenue mix totals 100%.</p>
              ) : null}
              {errors[`${activeSumGroup}__sum`] ? <span className="error">{errors[`${activeSumGroup}__sum`]}</span> : null}
            </div>
          ) : null}
          {chunk.some((field) => field.type === "upload") ? (
            <div className="card" style={{ background: "#f8f9ff" }}>
              <strong>Upload Files From Your Computer</strong>
              <p className="small">
                Choose files directly from your device. Each upload is saved securely and routed to your deal folder.
              </p>
            </div>
          ) : null}
          {chunk.map((field) => renderField(field))}
        </div>

        <div className="row" style={{ marginTop: "1rem" }}>
          <button
            className="secondary"
            onClick={() => {
              if (isTransitioning) return;
              if (activeChunk > 0) {
                setActiveChunk((value) => value - 1);
                return;
              }
              setActiveStep((value) => Math.max(1, value - 1));
            }}
            disabled={isTransitioning || (activeStep === 1 && activeChunk === 0)}
          >
            Back
          </button>

          {!onFinalStep && (
            <button className="primary" onClick={continueChunk} disabled={isTransitioning}>
              {isLastChunk ? "Finish This Part" : nudge.cta}
            </button>
          )}

          {onFinalStep && (
            <>
              <button className="secondary" onClick={partialSubmit} disabled={isSubmittingFinal}>
                Submit What I Have
              </button>
              <button className="primary" onClick={finalSubmit} disabled={isSubmittingFinal}>
                {isSubmittingFinal ? (
                  <>
                    <span className="spinner" /> Submitting...
                  </>
                ) : "Finish and Submit"}
              </button>
            </>
          )}

          <button className="secondary" onClick={saveExit} disabled={isTransitioning || isSubmittingFinal}>Save & Exit</button>
        </div>

        {isTransitioning ? <p className="small">Saving section...</p> : null}
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
        </>
      ) : null}
    </section>
  );
}
