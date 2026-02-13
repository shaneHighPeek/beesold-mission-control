# Acceptance Criteria — Phase 1

## Intake System

- [ ] Client access requires tokenized session URL.
- [ ] Intake flow is multi-step with progressive disclosure.
- [ ] Progress is visible (step count + progress indicator).
- [ ] Step data autosaves.
- [ ] Session can be resumed later with saved state.
- [ ] Required inputs are validated inline.
- [ ] Contextual help text exists per step.
- [ ] Structured document sections capture categorized asset metadata.
- [ ] Client can review intake data before final submit.
- [ ] Intake submission writes lifecycle status transition.

## Workflow Engine

- [ ] State machine supports:
  `DRAFT → IN_PROGRESS → SUBMITTED → KLOR_SYNTHESIS → COUNCIL_RUNNING → REPORT_READY → APPROVED`
- [ ] Transition validation rejects invalid state movement.
- [ ] Jobs and outputs are tracked (`jobs`, `job_status`, `job_outputs`).
- [ ] Audit entries are recorded for state and decision events.

## APIs

- [ ] `POST /intake/submit`
- [ ] `POST /pipeline/klor-run` (stub)
- [ ] `POST /pipeline/council-run` (stub)
- [ ] `GET /report`
- [ ] `POST /approval`

## Mission Control UI

- [ ] Intake list shows lifecycle state.
- [ ] Pipeline state/jobs are visible.
- [ ] Report is viewable when available.
- [ ] Approve/reject controls enforce human gate.

## Overall Success Path

- [ ] A client completes intake.
- [ ] Pipeline runs deterministically.
- [ ] Report is generated.
- [ ] Operator approval transitions to `APPROVED`.
