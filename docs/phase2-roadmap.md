# Phase 2 Roadmap

## 1) Kanban Orchestration Layer

- Add Kanban board projections from lifecycle state.
- Introduce swimlanes for pipeline stages and risk class.
- Add SLA timers and stage aging indicators.

## 2) AI Council Integration

- Replace stubs with AI-driven synthesis and council deliberation agents.
- Add model routing and prompt/version control.
- Persist prompt/response traces for auditability.

## 3) Reporting Pipelines

- Introduce report templates by client/listing type.
- Add structured scoring and recommendation confidence.
- Enable export channels (PDF, JSON package, operator handoff payload).

## 4) Team Roles and Governance

- Introduce role-based access controls (Operator, Reviewer, Analyst, Admin).
- Add approval delegation policies and escalation rules.
- Add immutable audit evidence exports.

## 5) Media & Asset Workflows

- Integrate object storage adapter (Supabase Storage/S3).
- Add OCR/extraction jobs for uploaded docs.
- Add asset quality checks and required document policy engine.

## 6) Reliability & Production Hardening

- Move from in-memory persistence to Postgres.
- Add job queue (e.g., BullMQ/Temporal) for long-running workflows.
- Add observability stack (structured logs, traces, metrics, alerts).
