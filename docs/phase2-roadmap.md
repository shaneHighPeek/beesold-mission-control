# BeeSold Operational Roadmap

Last updated: 2026-02-20

This roadmap is the execution plan to move BeeSold Dashboard from current prototype behavior to fully operational production delivery for Off Market Group, then scale to additional brokerages.

## Progress Snapshot (2026-02-20)

- [x] Supabase project provisioned.
- [x] `docs/schema.sql` applied in Supabase SQL editor.
- [x] `off-market-group` brokerage row seeded and verified.
- [x] Local `.env.local` created with DB/auth values.
- [x] Persistence driver toggle added (`PERSISTENCE_DRIVER=mock|postgres`).
- [x] Brokerage settings/read path wired to Supabase when Postgres driver is enabled.
- [x] Onboarding, auth, intake save/submit, and Dashboard reads are driver-aware in Postgres mode.
- [x] Google Drive credentials connected and folder adapter enabled.
- [x] Production domain connected (`https://app.beesold.hpp-cloud.com`).
- [x] Operator auth added (`ADMIN`, `EDITOR`) with protected Dashboard APIs.
- [x] Machine auth added (`KLOR_SYSTEM`) via `x-klor-api-key`.
- [x] Klor session signal endpoint added (`GET /pipeline/session-data/{sessionId}` + `updatedSince`).
- [ ] Branded email provider fully verified in production (Postmark live path under final verification).

## MVP Punchlist (Execution Board)

Use this as the active checklist. MVP is ready only when all items below are complete.

| ID | Status | Workstream | Owner | Effort | Depends On | Done Criteria |
| --- | --- | --- | --- | --- | --- | --- |
| MVP-01 | DONE | Pipeline/report persistence parity in Postgres | Backend | M | Supabase live | All report/pipeline reads+writes run with `PERSISTENCE_DRIVER=postgres`; no runtime-critical mock fallback in normal flow. |
| MVP-02 | IN_PROGRESS | Branded email provider live (SES/Postmark/SendGrid) | Backend + DevOps | M | Domain access | Invites are sent from brokerage sender identity; resend + new magic link work; delivery status logged and verified in production (`provider_status = SENT`). |
| MVP-03 | DONE | Google Drive production mode hardening | Backend | M | Service account + folder perms | Folder creation + file upload + revision replacement works for new sessions; Dashboard Drive links open valid resources. |
| MVP-04 | DONE | Intake validation hardening (revenue %, required docs, photos) | Frontend + Backend | M | None | Revenue fields enforce sum logic with clear remaining indicator; required docs block final submit correctly; photos enforce min/max with clear errors. |
| MVP-05 | DONE | Dashboard operations polish | Frontend | S | None | Brokerage selector supports multiple brokerages; logo save persists and reflects in portal branding; client list supports search by name/brokerage; timeline defaults compact with expand; archive/restore hides stale clients/brokerages by default without deleting records. |
| MVP-06 | IN_PROGRESS | Auth + tenant security controls | Backend | M | MVP-01 | Operator RBAC with Admin/Editor/Klor-System enforced on Dashboard + protected APIs; webhook shared secret enforced; complete auth rate-limit coverage + explicit negative isolation test evidence still required. |
| MVP-07 | TODO | End-to-end QA + UAT pass | QA + Ops + Engineering | M | MVP-01..06 | Full scenario passes: create -> invite -> auth -> save/resume -> partial -> missing items -> final -> report -> approve; UAT signoff recorded. |
| MVP-08 | TODO | Go-live runbook + rollback | DevOps + Ops | S | MVP-07 | Production checklist documented, backup + rollback steps tested, on-call/incident contacts defined. |

### Owner Legend

- Backend: API, persistence, auth, integrations
- Frontend: intake UI and Dashboard UX
- DevOps: secrets, deploys, monitoring, rollback
- Ops: day-to-day usage and UAT workflow checks
- QA: test execution and pass/fail evidence

### Effort Legend

- `S`: up to 0.5 day
- `M`: 1-2 days
- `L`: 3+ days

### Status Legend

- `TODO`: not started
- `IN_PROGRESS`: actively being worked
- `BLOCKED`: waiting on dependency/decision/access
- `DONE`: completed and verified against done criteria

### Suggested Execution Order (Critical Path)

1. MVP-01
2. MVP-02
3. MVP-03
4. MVP-04
5. MVP-05
6. MVP-06
7. MVP-07
8. MVP-08

### Definition of MVP Complete

MVP is complete when:

- `MVP-01` through `MVP-08` are all marked done.
- No P0/P1 defects remain open for onboarding, auth, intake completion, Drive routing, or approval flow.
- At least one brokerage can run the full flow in production-like conditions without engineering intervention.

## Recent Deliveries (2026-02-20)

- Dashboard polish pass shipped:
  - Listings-first wording
  - operations menu spacing/button consistency
  - account info moved to sidebar footer
  - improved visual hierarchy and KPI cards
- Portal branding reliability fixes shipped:
  - forced dynamic brokerage portal pages
  - static asset path normalization (`public/`)
  - explicit favicon metadata and App Router favicon
- Security controls shipped:
  - operator sign-in/sign-out/me endpoints
  - role-based access checks on Dashboard/operator/pipeline routes
  - webhook secret guard on `/api/webhooks/client-intake`
- Klor integration matured:
  - production contract updated
  - session-data API endpoint with incremental sync (`updatedSince`)

## MVP-01 Verification Evidence (Postgres Parity)

Date: 2026-02-19

- `pipelineService` in Postgres mode uses Supabase paths for:
  - job create/status/output (`jobs`, `job_status`, `job_outputs`)
  - report upsert/read (`reports`)
  - lifecycle transitions + audit logging
- `operatorService` in Postgres mode uses Supabase paths for:
  - mission control intake/report reads
  - operator approval/reject transitions
  - report `approved_at` write on approval
- Type safety check passed: `npm run typecheck`.

Quick re-check:

1. `curl -s http://localhost:3000/api/dev/persistence` -> expect `active: "postgres"`.
2. Final-submit a test session.
3. Verify in Supabase SQL editor:
   - `select count(*) from jobs where session_id = 'YOUR_SESSION_ID';`
   - `select count(*) from job_outputs where job_id in (select id from jobs where session_id = 'YOUR_SESSION_ID');`
   - `select status from intake_sessions where id = 'YOUR_SESSION_ID';`
   - `select approved_at from reports where session_id = 'YOUR_SESSION_ID';`

## 0) Current Baseline (Already Implemented)

- Multi-tenant brokerage/client/session domain model is in place.
- Branded onboarding flows exist for admin and API/webhook entrypoints.
- Magic-link + password portal access exists.
- 7-step OMG intake schema is wired with conditional logic and core validations.
- Dashboard exists with timeline, status, missing-items loop, and Drive link placeholders.
- Google Drive integration points are stubbed and audited.

## 1) North Star Outcome

BeeSold is operational when all of the following are true in production:

1. A client created by admin or webhook is onboarded idempotently under the correct brokerage tenant.
2. Invite emails are sent from brokerage-branded sender identities via a real email provider.
3. Client can authenticate via magic link or password securely with tenant isolation enforced.
4. Client can complete the full 83-field intake over multiple sessions with save/resume.
5. Documents are uploaded and routed into the correct Google Drive folder.
6. Dashboard accurately reflects progress, status, missing items, and audit timeline.
7. Security, observability, backup, and rollback runbooks are in place.

## 2) Phase Plan

## Immediate 60-Minute Target (Completed)

Completed on 2026-02-18:

1. Provision Supabase project.
2. Apply `docs/schema.sql`.
3. Seed `off-market-group` brokerage row.
4. Set local env vars (`DATABASE_URL`, Supabase keys, auth secrets).
5. Validate brokerage row exists in SQL editor.

Reference runbook: `docs/database-setup.md`.

## Next 60-Minute Target (Now)

1. Run full end-to-end verification in Postgres mode (onboarding -> invite -> auth -> save step -> partial/final).
2. Confirm Supabase table writes for `client_identities`, `intake_sessions`, `intake_steps`, `audit_log`, `magic_links`, `portal_auth_sessions`.
3. Connect real Google Drive credentials and replace stub folder/file creation.
4. Connect real email provider transport and delivery webhooks.
5. Add auth endpoint rate limits and failed-attempt logging.

## Phase A — Production Foundation (Platform + Security)

Goal: replace mock/runtime assumptions with production-safe infrastructure.

Work items:

- Move persistence from in-memory to Postgres (Supabase or managed Postgres).
- Create migrations for:
  - brokerages
  - clients
  - intake_sessions
  - intake_steps
  - assets
  - auth_sessions
  - magic_link_tokens
  - audit_events
  - idempotency_keys
  - outbound_messages
- Implement row-level tenancy enforcement strategy (app-layer guards + DB constraints).
- Add rate-limiting to auth endpoints:
  - magic link consume
  - password sign-in
  - request magic link
- Hash all tokens/passwords with production secrets and rotation policy.
- Add secure cookie flags and session expiration cleanup jobs.
- Add secret management policy for all env vars.

Exit criteria:

- No mock DB dependencies in runtime paths.
- Tenant data cannot be read across brokerage boundaries.
- Auth endpoints are rate limited and audited.

## Phase B — Google Drive + Email Provider Integration

Goal: complete the external integrations that make onboarding operational.

Work items:

- Google Drive:
  - create Google Cloud project and service account
  - enable Drive API
  - grant brokerage parent folder permissions to service account
  - implement real `ensureDriveFolder` + upload adapter
  - define deterministic folder naming convention:
    - `{brokerageSlug}/{clientBusinessName}-{sessionId}`
  - define revision naming format:
    - `{fieldOrCategory}__{originalName}__rev{n}`
- Email provider (SES/Postmark/SendGrid):
  - verify brokerage sending domain
  - configure SPF, DKIM, DMARC
  - map sender identities per brokerage
  - implement production mail transport + retry/backoff
  - capture delivery status events in audit trail

Exit criteria:

- Drive folders/files are created and accessible from Dashboard links.
- Invite email delivery works from real branded sender addresses.
- Failed sends/uploads are retriable and visible in logs.

## Phase C — Intake Completeness + Document Rules

Goal: enforce form/document policy exactly as OMG expects.

Work items:

- Enforce upload validation by field/category (extension + MIME + size caps).
- Enforce required upload gates:
  - Q2 P&L required
  - Q4 Lease document required if leasehold
  - Q7 minimum 10 images required before final submit
- Add stronger client-side guidance for each upload prompt.
- Add “final submit readiness” service that returns missing blockers.
- Add confirmation email on submission with submitted summary.
- Add internal OMG team notification on each partial and final submit.

Exit criteria:

- Final submit fails with actionable errors when required docs/fields are missing.
- Confirmation and internal notification flows are live.

## Phase D — Dashboard Operational Maturity

Goal: turn dashboard into daily operations tool.

Work items:

- Add queue filters:
  - invited
  - in-progress
  - partial submitted
  - missing items requested
  - final submitted
- Add SLA aging indicators:
  - days since invite
  - days since last client activity
  - days in current status
- Add assignment workflows:
  - owner assignment
  - ownership change audit log
- Add quick actions:
  - resend invite
  - send new magic link
  - request missing items templates
- Add timeline event metadata detail drawer.

Exit criteria:

- Ops team can run daily pipeline from one dashboard without engineering help.

## Phase E — QA, UAT, and Go-Live

Goal: verify reliability and launch with controlled risk.

Work items:

- Automated tests:
  - unit tests for condition/validation engine
  - integration tests for auth/session isolation
  - API tests for onboarding idempotency
  - upload routing tests for Drive paths
- E2E tests (Playwright/Cypress):
  - create client -> invite -> magic link -> password set -> multi-session intake -> partial -> missing items -> final submit
- Security test pass:
  - cross-tenant access attempts
  - expired/used token behavior
  - brute-force and link-reuse checks
- UAT with OMG team using real sample assets.
- Define launch checklist and rollback:
  - DB backup snapshot
  - feature flag fallback
  - integration disable switches

Exit criteria:

- UAT signoff complete.
- Production deploy checklist complete.
- Rollback and incident response playbook ready.

## 3) Operational Workflow (Day-to-Day)

1. Admin or webhook creates/updates client under brokerage tenant.
2. System creates intake session and (if configured) Drive folder.
3. System sends branded invite email with magic link.
4. Client signs in (magic link or password) and progresses through intake.
5. Autosave and Save & Exit preserve state at step + field level.
6. Client submits partial or final.
7. Dashboard reviews, requests missing items if needed.
8. Client resubmits final once complete.
9. Internal processing and operator actions continue with full audit timeline.

## 4) Integration Checklist

## Google Drive Checklist

- `GOOGLE_DRIVE_ENABLED=true`
- `GOOGLE_SERVICE_ACCOUNT_JSON` (or equivalent secret reference)
- `OMG_DRIVE_PARENT_FOLDER_ID`
- Drive API enabled in GCP
- Parent folder shared to service account email
- Upload quota and error alerting configured

## Email Checklist

- SMTP/API credentials configured
- Brokerage sender domains verified
- SPF, DKIM, DMARC validated
- Bounce/complaint webhook processing configured

## Security Checklist

- `MAGIC_LINK_SECRET` rotated and stored in secret manager
- `PORTAL_SESSION_SECRET` rotated and stored in secret manager
- HTTPS enforced in production
- HttpOnly/Secure/SameSite cookies verified
- Rate limiting enabled

## 5) Test Matrix (Minimum)

- Auth:
  - magic link valid, expired, reused, wrong tenant
  - password sign-in success/fail/locked-rate-limit
- Intake:
  - save/resume across sessions
  - conditional visibility correctness for all trigger rules
  - required validations + word count + % totals + ABN/postcode
- Uploads:
  - valid file types accepted
  - invalid type blocked
  - revision upload increments correctly
  - Drive path correctness
- Dashboard:
  - accurate status and progress
  - resend invite/new magic link/missing items actions
  - audit timeline completeness
- Webhook:
  - idempotency key replay behavior
  - update vs create behavior

## 6) Ownership and Sequencing

Suggested implementation order:

1. Phase A (foundation/security)
2. Phase B (Google + email)
3. Phase C (form/doc policy hardening)
4. Phase D (ops UX maturity)
5. Phase E (test + UAT + launch)

Suggested owners:

- Backend lead: tenancy, auth, integrations, migrations
- Frontend lead: form UX, Dashboard UX, validation presentation
- DevOps: secrets, deploys, monitoring, incident playbooks
- Ops/UAT lead: acceptance scripts and brokerage rollout readiness

## 7) Definition of Operational Ready

BeeSold is operationally ready when:

- Production DB + migrations are live.
- Google Drive and email integrations are live and monitored.
- Full intake flow passes automated + UAT suites.
- Tenant isolation and security tests pass.
- Ops runbook is documented and rehearsed.
- At least one real brokerage (OMG) is live end-to-end.

## 8) Active QA Issues (From Live Testing)

- [ ] Photo upload UX/validation review (min count behavior, error clarity, retry handling).
- [ ] Revenue percentage validation review (sum-to-100 behavior and inline guidance).
- [ ] Required document upload gating review (forced upload rules, blocking logic, error copy).
- [ ] Dashboard brokerage management: support multiple brokerages with clear selectable dropdown after creation (target UX optimized for <=20 brokerages).
- [ ] Brokerage logo persistence bug: uploaded logo URL/file does not consistently save or propagate to client intake portal branding.
