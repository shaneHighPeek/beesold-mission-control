# BeeSold Demo Execution Checklist

Last updated: 2026-03-09
Primary source roadmap: `docs/phase2-roadmap.md`

Purpose: simple day-by-day execution tracker so work can pause/resume without losing context.

## How to use

1. Move items from `TODO` -> `IN_PROGRESS` -> `DONE`.
2. Keep only one `IN_PROGRESS` item at a time per phase.
3. Update `Next Up` and `Blockers` at the end of each work session.
4. Add one short note in `Daily Log` each day.

## Current Focus

- Active phase: `Phase 3 - Broker Branding Settings`
- Next up: `DEMO-03.5 QA branding persistence after refresh/re-login`
- Blockers: `None`

## Phase 1 - Broker Portal Core (Kanban + Timers)

- [x] DEMO-01.1 Tenant-scoped broker sign-in and session guard
- [x] DEMO-01.2 Broker-only pipeline API (tenant filtered)
- [x] DEMO-01.3 Kanban board columns by lifecycle status
- [x] DEMO-01.4 Card timers: time in system + time in current stage
- [x] DEMO-01.5 Broker quick actions visible on cards (resend invite, magic link)
- [ ] DEMO-01.6 Demo QA pass for one brokerage tenant

Definition of done:

- Broker can log in and only see their own brokerage data.
- Kanban updates and timers are correct enough for live demo (minute-level).

## Phase 2 - Client Entry and Invite Trigger

- [x] DEMO-02.1 Broker “Add Client” form in broker portal
- [x] DEMO-02.2 Create client + intake session under broker tenant
- [x] DEMO-02.3 Trigger branded invite email automatically
- [x] DEMO-02.4 Record audit events for create + invite
- [ ] DEMO-02.5 Validate new client appears in both broker portal and Mission Control

Definition of done:

- Either side (broker portal or Mission Control) creates records in one shared system of record.

## Phase 3 - Broker Branding Settings (Mirror Update Brokerage)

- [x] DEMO-03.1 Broker settings page (logo, colors, sender, footer)
- [x] DEMO-03.2 Save/update brokerage branding fields
- [x] DEMO-03.3 Propagate branding into portal UI
- [x] DEMO-03.4 Propagate branding into invite emails
- [ ] DEMO-03.5 QA branding persistence after refresh/re-login

Definition of done:

- Broker changes are visible in client portal and outbound invites.

## Phase 4 - Custom Domain and DNS

- [ ] DEMO-04.1 Add brokerage domain fields (`custom_domain`, verification status/token)
- [ ] DEMO-04.2 Broker UI for DNS setup instructions (TXT + CNAME)
- [ ] DEMO-04.3 Verification check endpoint + status update
- [ ] DEMO-04.4 Host-header tenant resolution for verified custom domains
- [ ] DEMO-04.5 TLS/certificate provisioning validation

Definition of done:

- At least one brokerage custom domain resolves correctly to their branded portal.

## Phase 5 - Branded Email Domain

- [ ] DEMO-05.1 Provider domain auth process documented per brokerage
- [ ] DEMO-05.2 SPF/DKIM/DMARC records generated and verified
- [ ] DEMO-05.3 Per-brokerage sender identity wiring in app
- [ ] DEMO-05.4 Delivery status/event logging confirmed in `outbound_emails`
- [ ] DEMO-05.5 Send real invite from branded sender in production-like test

Definition of done:

- Brokerage invite email sends from verified brokerage domain with auditable delivery status.

## Phase 6 - Commercial Intake Variant

- [ ] DEMO-06.1 Add intake template key support (`COMMERCIAL_V1`)
- [ ] DEMO-06.2 Implement 6-phase commercial questionnaire schema
- [ ] DEMO-06.3 Broker selects listing type/template at client creation
- [ ] DEMO-06.4 Persist template on session and render correct form
- [ ] DEMO-06.5 Commercial validation + upload rules wired
- [ ] DEMO-06.6 End-to-end run: invite -> complete commercial intake -> final submit

Definition of done:

- Commercial sessions run separate question flow without breaking existing OMG intake.

## Phase 7 - Demo Readiness and Handover

- [ ] DEMO-07.1 Demo script written (5-10 minute walkthrough)
- [ ] DEMO-07.2 Seed/demo data prepared for one broker and multiple clients
- [ ] DEMO-07.3 Final smoke test across Mission Control + broker portal
- [ ] DEMO-07.4 Known limitations list prepared (if any)

Definition of done:

- You can run a clean live demo without engineering intervention during walkthrough.

## Next Up (Single Queue)

1. DEMO-01.6 Demo QA pass for one brokerage tenant
2. DEMO-02.5 Validate new client appears in both broker portal and Mission Control
3. DEMO-03.5 QA branding persistence after refresh/re-login

## Blockers / Decisions

- None currently.

## QA Runbooks

- `DEMO-03.5`: `docs/demo-03-5-branding-qa.md`

## Daily Log

- 2026-03-09: Checklist created. Priority sequence set to broker portal -> client entry -> branding -> domain/email -> commercial intake -> demo readiness.
- 2026-03-09: Implemented broker sign-in (`/broker/sign-in`), broker session auth (`/api/broker-auth/*`), tenant-scoped broker pipeline API (`/api/broker/pipeline`), and broker kanban page with live timers (`/broker/pipeline`).
- 2026-03-09: Added broker card quick actions with tenant guard: resend invite + issue new magic link (`/api/broker/intakes/[sessionId]/resend-invite`, `/api/broker/intakes/[sessionId]/magic-link`).
- 2026-03-09: Added broker client entry flow (`POST /api/broker/clients`) and broker portal create form; create now reuses onboarding service, creates tenant-scoped session, and triggers branded invite.
- 2026-03-09: Added broker branding settings page (`/broker/settings`) and tenant-scoped brokerage settings read endpoint (`GET /api/broker/brokerage`) as Phase 3.1 foundation.
- 2026-03-09: Added broker branding save flow (`PATCH /api/broker/brokerage`) with editable settings UI (name, short name, sender, portal URL, logo URL, colors, legal footer).
- 2026-03-09: Added portal branding propagation support in broker settings with live portal preview and direct open link to `/portal/{brokerageSlug}` for post-save verification.
- 2026-03-09: Updated invite email template to apply broker branding package (logo, primary/secondary colors, legal footer, sender identity, optional BeeSold branding flag).
- 2026-03-09: Hardened broker branding read consistency by resolving brokerage metadata from current storage on broker auth/pipeline reads (avoids stale name in long-lived broker sessions).
- 2026-03-09: Added `DEMO-03.5` QA runbook with exact refresh/re-login persistence checks and expected outcomes (`docs/demo-03-5-branding-qa.md`).
