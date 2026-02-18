# BeeSold Operational Roadmap

Last updated: 2026-02-18

This roadmap is the execution plan to move BeeSold Mission Control from current prototype behavior to fully operational production delivery for Off Market Group, then scale to additional brokerages.

## 0) Current Baseline (Already Implemented)

- Multi-tenant brokerage/client/session domain model is in place.
- Branded onboarding flows exist for admin and API/webhook entrypoints.
- Magic-link + password portal access exists.
- 7-step OMG intake schema is wired with conditional logic and core validations.
- Mission Control dashboard exists with timeline, status, missing-items loop, and Drive link placeholders.
- Google Drive integration points are stubbed and audited.

## 1) North Star Outcome

BeeSold is operational when all of the following are true in production:

1. A client created by admin or webhook is onboarded idempotently under the correct brokerage tenant.
2. Invite emails are sent from brokerage-branded sender identities via a real email provider.
3. Client can authenticate via magic link or password securely with tenant isolation enforced.
4. Client can complete the full 83-field intake over multiple sessions with save/resume.
5. Documents are uploaded and routed into the correct Google Drive folder.
6. Mission Control accurately reflects progress, status, missing items, and audit timeline.
7. Security, observability, backup, and rollback runbooks are in place.

## 2) Phase Plan

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

- Drive folders/files are created and accessible from Mission Control links.
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

## Phase D — Mission Control Operational Maturity

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
7. Mission Control reviews, requests missing items if needed.
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
- Mission Control:
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
- Frontend lead: form UX, Mission Control UX, validation presentation
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
