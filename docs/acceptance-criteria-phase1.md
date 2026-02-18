# Acceptance Criteria — Phase 1

Status: ✅ Completed (current implementation baseline)

## Intake System

- [x] Client access requires tokenized session URL.
- [x] Intake flow is multi-step with progressive disclosure.
- [x] Progress is visible (step count + progress indicator).
- [x] Step data autosaves.
- [x] Session can be resumed later with saved state.
- [x] Required inputs are validated inline.
- [x] Contextual help text exists per step.
- [x] Structured document sections capture categorized asset metadata.
- [x] Client can review intake data before final submit.
- [x] Intake submission writes lifecycle status transition.

## Workflow Engine

- [x] State machine supports:
  `DRAFT → IN_PROGRESS → SUBMITTED → KLOR_SYNTHESIS → COUNCIL_RUNNING → REPORT_READY → APPROVED`
- [x] Transition validation rejects invalid state movement.
- [x] Jobs and outputs are tracked (`jobs`, `job_status`, `job_outputs`).
- [x] Audit entries are recorded for state and decision events.

## APIs

- [x] `POST /intake/submit`
- [x] `POST /pipeline/klor-run` (stub)
- [x] `POST /pipeline/council-run` (stub)
- [x] `GET /report`
- [x] `POST /approval`

## Mission Control UI

- [x] Intake list shows lifecycle state.
- [x] Pipeline state/jobs are visible.
- [x] Report is viewable when available.
- [x] Approve/reject controls enforce human gate.

## Overall Success Path

- [x] A client completes intake.
- [x] Pipeline runs deterministically.
- [x] Report is generated.
- [x] Operator approval transitions to `APPROVED`.
