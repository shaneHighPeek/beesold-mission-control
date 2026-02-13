"use client";

import { useEffect, useMemo, useState } from "react";

type LifecycleState =
  | "DRAFT"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "KLOR_SYNTHESIS"
  | "COUNCIL_RUNNING"
  | "REPORT_READY"
  | "APPROVED";

type IntakeStepDefinition = {
  key: string;
  title: string;
  description: string;
  helpText: string;
  fields: Array<{ name: string; label: string; required?: boolean }>;
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
  mimeType: string;
  sizeBytes: number;
};

type IntakeSessionResponse = {
  session: {
    id: string;
    status: LifecycleState;
    currentStep: number;
    totalSteps: number;
  };
  steps: IntakeStep[];
  assets: IntakeAsset[];
  definitions: IntakeStepDefinition[];
};

export function IntakeClient({ token }: { token: string }) {
  const [data, setData] = useState<IntakeSessionResponse | null>(null);
  const [activeStep, setActiveStep] = useState(1);
  const [formState, setFormState] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [assetDraft, setAssetDraft] = useState({
    category: "FINANCIALS" as IntakeAsset["category"],
    fileName: "",
    mimeType: "application/pdf",
    sizeBytes: 100000,
  });
  const [message, setMessage] = useState("");

  async function refresh() {
    const response = await fetch(`/intake/session/${token}`, { cache: "no-store" });
    const payload = (await response.json()) as { ok: boolean; data: IntakeSessionResponse };
    if (payload.ok) {
      setData(payload.data);
      setActiveStep(payload.data.session.currentStep);
    }
  }

  useEffect(() => {
    refresh();
  }, [token]);

  const currentStep = useMemo(() => {
    if (!data) return null;
    return data.definitions[activeStep - 1] ?? null;
  }, [data, activeStep]);

  useEffect(() => {
    if (!data || !currentStep) return;
    const existing = data.steps.find((step) => step.stepKey === currentStep.key);
    setFormState(existing?.data ?? {});
    setErrors({});
  }, [data, currentStep?.key]);

  useEffect(() => {
    if (!data || !currentStep || currentStep.key === "documents" || currentStep.key === "review") {
      return;
    }

    const handle = setTimeout(async () => {
      await fetch("/intake/save-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          stepKey: currentStep.key,
          data: formState,
          currentStep: activeStep,
          markComplete: false,
        }),
      });
    }, 450);

    return () => clearTimeout(handle);
  }, [formState, activeStep, currentStep?.key, data, token]);

  if (!data || !currentStep) {
    return (
      <main>
        <p>Loading intake session...</p>
      </main>
    );
  }

  const completion = Math.round((activeStep / data.session.totalSteps) * 100);

  const validateCurrent = () => {
    const nextErrors: Record<string, string> = {};
    currentStep.fields.forEach((field) => {
      if (!field.required) return;
      const value = formState[field.name];
      if (typeof value !== "string" || !value.trim()) {
        nextErrors[field.name] = `${field.label} is required`;
      }
    });
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  async function saveAndAdvance() {
    if (currentStep.key !== "documents" && currentStep.key !== "review" && !validateCurrent()) {
      return;
    }

    await fetch("/intake/save-step", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        stepKey: currentStep.key,
        data: formState,
        currentStep: Math.min(activeStep + 1, data.session.totalSteps),
        markComplete: true,
      }),
    });

    setMessage("Progress saved.");
    await refresh();
    setActiveStep((value) => Math.min(value + 1, data.session.totalSteps));
  }

  async function addAsset() {
    await fetch("/intake/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, ...assetDraft }),
    });
    setAssetDraft({ ...assetDraft, fileName: "" });
    setMessage("Document captured and linked to intake.");
    await refresh();
  }

  async function submitIntake() {
    await fetch("/intake/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    setMessage("Intake submitted. Pipeline executed through report generation.");
    await refresh();
  }

  return (
    <main className="grid" style={{ gap: "1rem" }}>
      <header className="card">
        <h1>Secure Client Intake</h1>
        <p>
          Status: <span className="badge">{data.session.status}</span>
        </p>
        <div className="progress" aria-label="intake completion progress">
          <span style={{ width: `${completion}%` }} />
        </div>
        <p className="small">
          Step {activeStep} of {data.session.totalSteps}. Autosave active.
        </p>
      </header>

      <section className="card">
        <h2>{currentStep.title}</h2>
        <p>{currentStep.description}</p>
        <p className="small">Help: {currentStep.helpText}</p>

        {currentStep.key !== "documents" && currentStep.key !== "review" && (
          <div>
            {currentStep.fields.map((field) => (
              <label className="field" key={field.name}>
                <span>
                  {field.label}
                  {field.required ? " *" : ""}
                </span>
                <input
                  value={String(formState[field.name] ?? "")}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, [field.name]: event.target.value }))
                  }
                />
                {errors[field.name] ? <span className="error">{errors[field.name]}</span> : null}
              </label>
            ))}
          </div>
        )}

        {currentStep.key === "documents" && (
          <div className="grid two">
            <div>
              <h3>Upload Placeholder</h3>
              <p className="small">
                Phase 1 uses structured metadata capture. Supabase storage adapter can replace this.
              </p>
              <label className="field">
                <span>Category</span>
                <select
                  value={assetDraft.category}
                  onChange={(event) =>
                    setAssetDraft((prev) => ({
                      ...prev,
                      category: event.target.value as IntakeAsset["category"],
                    }))
                  }
                >
                  <option value="FINANCIALS">Financials</option>
                  <option value="LEGAL">Legal</option>
                  <option value="PROPERTY">Property</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>
              <label className="field">
                <span>File Name</span>
                <input
                  value={assetDraft.fileName}
                  placeholder="Q4-financials.pdf"
                  onChange={(event) =>
                    setAssetDraft((prev) => ({ ...prev, fileName: event.target.value }))
                  }
                />
              </label>
              <button className="secondary" onClick={addAsset} disabled={!assetDraft.fileName.trim()}>
                Add Document
              </button>
            </div>

            <div>
              <h3>Linked Documents</h3>
              {data.assets.length === 0 ? (
                <p className="small">No assets yet.</p>
              ) : (
                <ul>
                  {data.assets.map((asset) => (
                    <li key={asset.id}>
                      {asset.category}: {asset.fileName}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {currentStep.key === "review" && (
          <div className="grid" style={{ gap: "0.6rem" }}>
            <h3>Review Before Submission</h3>
            {data.steps.map((step) => (
              <div key={step.stepKey} className="card">
                <strong>{step.stepKey}</strong>
                <pre className="small">{JSON.stringify(step.data, null, 2)}</pre>
              </div>
            ))}
            <button className="primary" onClick={submitIntake}>
              Submit Intake and Run Pipeline
            </button>
          </div>
        )}

        <div className="row" style={{ marginTop: "0.75rem" }}>
          <button
            className="secondary"
            onClick={() => setActiveStep((value) => Math.max(1, value - 1))}
            disabled={activeStep === 1}
          >
            Back
          </button>
          {activeStep < data.session.totalSteps && (
            <button className="primary" onClick={saveAndAdvance}>
              Save and Continue
            </button>
          )}
        </div>
        {message ? <p className="small">{message}</p> : null}
      </section>
    </main>
  );
}
