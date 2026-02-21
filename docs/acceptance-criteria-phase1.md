# Acceptance Criteria — Phase 1

Status: ✅ Completed (baseline shipped and running on production domain)

## Phase 2 Handoff Status (2026-02-20)

- [x] Supabase schema and brokerage seed completed.
- [x] Local environment secrets configured.
- [x] Driver toggle and Supabase-backed brokerage persistence implemented.
- [x] Onboarding/auth/intake + mission-control core paths now run in Postgres mode behind driver toggle.
- [x] Pipeline/report persistence paths migrated and validated in Postgres mode.
- [x] Dashboard/archive UX refinements shipped (Listings-first terminology).
- [x] Operator auth roles (`ADMIN`, `EDITOR`) enforced on protected Dashboard routes.
- [x] Machine auth role (`KLOR_SYSTEM`) enforced on pipeline routes.
- [x] Klor signal API endpoint available (`GET /pipeline/session-data/{sessionId}`).

## Listing Intake System

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
  `DRAFT → IN_PROGRESS → FINAL_SUBMITTED → KLOR_SYNTHESIS → COUNCIL_RUNNING → REPORT_READY → APPROVED`
- [x] Transition validation rejects invalid state movement.
- [x] Jobs and outputs are tracked (`jobs`, `job_status`, `job_outputs`).
- [x] Audit entries are recorded for state and decision events.

## APIs

- [x] `POST /intake/submit`
- [x] `POST /pipeline/klor-run` (stub)
- [x] `POST /pipeline/council-run` (stub)
- [x] `GET /report`
- [x] `POST /approval`

## Dashboard UI

- [x] Intake list shows lifecycle state.
- [x] Pipeline state/jobs are visible.
- [x] Report is viewable when available.
- [x] Approve/reject controls enforce human gate.
- [x] Archive/restore hides stale records without deleting data.
- [x] Search/filter supports brokerage/status/archive visibility.

## Overall Success Path

- [x] A client completes intake.
- [x] Pipeline runs deterministically.
- [x] Report is generated.
- [x] Operator approval transitions to `APPROVED`.
