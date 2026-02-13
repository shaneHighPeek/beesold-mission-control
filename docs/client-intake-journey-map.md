# Client Intake Journey Map (Phase 1)

## Stage 1: Secure Entry

- Client receives private tokenized link.
- Session resolves to existing intake record.
- Entry context: clear purpose and expected completion flow.

## Stage 2: Guided Data Collection

- Step 1: business profile
- Step 2: goals and constraints
- Step 3: structured document metadata capture
- Every step includes contextual help + inline required validation.

## Stage 3: Save & Resume

- Autosave captures step-level data.
- Session persists progress state (`currentStep`, step data, completion flags).
- Client can leave and return to continue.

## Stage 4: Review Before Submit

- Full response review presented in one place.
- Client confirms readiness and submits.

## Stage 5: Handoff to Internal Pipeline

- Intake transitions to `SUBMITTED`.
- System runs deterministic pipeline:
  - `KLOR_SYNTHESIS`
  - `COUNCIL_RUNNING`
  - `REPORT_READY`

## Stage 6: Operator Decision

- Operator reviews report in Mission Control.
- Operator approves (or rejects for rework).
- Approval transitions state to `APPROVED`.
