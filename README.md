# BeeSold Mission Control — Phase 1 Foundation

BeeSold Mission Control is a **workflow-driven intelligence pipeline** that transforms messy client input into structured, reviewable strategy.

This Phase 1 scaffold implements the backbone:

**Client completes intake → pipeline runs → report is generated → operator approves it.**

---

## System Intent

This is not CRUD dashboard software.

Mission Control models every listing as a stateful workflow with explicit transitions:

`DRAFT → IN_PROGRESS → SUBMITTED → KLOR_SYNTHESIS → COUNCIL_RUNNING → REPORT_READY → APPROVED`

The UI is a controlled operator/client interface over that state machine.

---

## What Phase 1 Includes

### 1) Secure, Resumable Client Intake

- Token-based intake access (`/intake/[token]`)
- Progressive multi-step intake flow
- Completion progress indicator
- Autosave for step data
- Resume-later behavior from persisted mock session state
- Inline validation for required fields
- Contextual help placeholders per step
- Structured document upload metadata section
- Review-before-submit screen
- Submission lifecycle tracking

### 2) Deterministic Pipeline Engine

State machine and deterministic pipeline flow:

- Submit intake (`POST /intake/submit`)
- Klor synthesis run (stub, deterministic)
- Council run (stub, deterministic)
- Report creation
- Manual operator approval only (`POST /approval`)

### 3) Mission Control Operator Cockpit

- Intake list with lifecycle status
- Pipeline job indicators
- Report viewer
- Approve/reject controls

### 4) Mock Persistence + SQL Planning

- In-memory persistence abstraction in `lib/persistence/mockDb.ts`
- Supabase/Postgres schema draft in `docs/schema.sql`

---

## API Endpoints (Phase 1)

### Intake
- `GET /intake/session/[token]`
- `POST /intake/save-step`
- `POST /intake/assets`
- `POST /intake/submit`

### Pipeline
- `POST /pipeline/klor-run`
- `POST /pipeline/council-run`

### Reporting & Approval
- `GET /report?sessionId=...`
- `POST /approval`

### Operator data
- `GET /api/mission-control/intakes`

---

## Project Structure

- `app/` — Next.js routes, API route handlers, pages
- `components/intake/` — intake UI client component
- `lib/domain/` — state machine, intake config, domain types
- `lib/services/` — intake/pipeline/operator domain services
- `lib/persistence/` — mock DB abstraction
- `docs/` — architecture docs, lifecycle artifacts, schema, roadmap

---

## Run Locally

```bash
npm install
npm run dev
```

Then open:

- `http://localhost:3000/` (landing)
- `http://localhost:3000/intake/client-demo-001` (demo intake)
- `http://localhost:3000/mission-control` (operator cockpit)

---

## Phase 1 Acceptance Snapshot

Success is achieved when:

1. Client completes intake
2. Intake submission triggers deterministic pipeline
3. Report is produced in `REPORT_READY`
4. Operator explicitly approves report to transition to `APPROVED`

Detailed criteria: `docs/acceptance-criteria-phase1.md`

---

## Documentation Index

- `docs/intake-ux-principles.md`
- `docs/workflow-lifecycle-diagram.md`
- `docs/client-intake-journey-map.md`
- `docs/acceptance-criteria-phase1.md`
- `docs/phase2-roadmap.md`
- `docs/schema.sql`
