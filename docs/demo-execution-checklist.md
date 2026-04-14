# BeeSold Demo Checklist (Simple Version)

Last updated: 2026-04-14

Use this like a run sheet. Start at the top and tick boxes in order.

## 0) Send-To-Client Ready (5-Minute Preflight)

Do this before sending any live client invite:

- [ ] In Mission Control, create client under the correct brokerage.
- [ ] Confirm brokerage sender email + portal domain look correct in broker settings.
- [ ] Send invite and confirm email delivered.
- [ ] Open the magic link from the email once and confirm intake page loads.
- [ ] Confirm session card appears in broker pipeline and Mission Control.

Pass condition:

- You can send one invite and confirm the client can open the intake link successfully.

## 1) What We Are Doing Right Now

- Current target: run **manual but reliable delivery** for OMG.
- This means: invite client -> client completes intake -> download Q&A -> run report manually -> client feedback -> final approval.

## 2) Go Live Setup (Do In This Exact Order)

### Step A - Database check

- [x] In Supabase, confirm these columns exist:
- [x] `brokerages.custom_domain`
- [x] `brokerages.sender_domain`
- [x] `intake_sessions.intake_template`

Pass condition:

- All 3 exist.

### Step B - Broker custom domain (website)

- [x] In Vercel, add broker domain to this project (example: `portal.broker.com`).
- [x] In BeeSold `/broker/settings`, enter Custom Domain and click `Save Domain`.
- [x] Add CNAME in DNS using the exact target from Vercel.
- [x] Add TXT in DNS using BeeSold verification host + value.
- [x] Back in BeeSold, click `Verify DNS` until status shows `VERIFIED`.
- [x] Open `https://<broker-domain>` and confirm page loads with SSL (lock icon).

Pass condition:

- Domain status is `VERIFIED` and HTTPS works.

Scaling note (important):

- The CNAME target must come from Vercel and match BeeSold expectations.
- Set env in local + Vercel:
- `BROKER_CUSTOM_DOMAIN_CNAME_TARGET=<your-vercel-target>`
- Example: `BROKER_CUSTOM_DOMAIN_CNAME_TARGET=7a61de7cbba07e06.vercel-dns-017.com`

Cloudflare field mapping:

- CNAME:
- `Name = bsold` (or your subdomain)
- `Target = <vercel target>`
- `Proxy status = DNS only` (gray cloud)
- TXT:
- `Name = _beesold-verify.bsold`
- `Content = beesold-verify-<token>`
- `Proxy status = DNS only`

### Step C - Broker sender domain (email)

- [ ] In Postmark, authenticate broker sender domain (SPF, DKIM, DMARC).
- [ ] Add Postmark Return-Path CNAME (`pm-bounces.<domain>` -> `pm.mtasv.net`) in DNS.
- [ ] In BeeSold `/broker/settings`, click `Verify Sender DNS` until status shows `VERIFIED`.

Pass condition:

- Sender domain status is `VERIFIED`.

### Step D - Real invite proof

- [x] From broker pipeline, create a real test client (or resend invite).
- [x] Confirm email is received from broker branded sender.
- [x] Check DB table `outbound_emails`:
- [x] `provider_status = 'SENT'`
- [x] `from_email` uses broker domain

Pass condition:

- Real invite sent successfully with branded sender.

## 3) Manual Processing Flow (Current Operating Model)

When client submits final intake:

- [ ] In Mission Control, open the listing and click **Download Client Q&A**.
- [ ] Save/export the generated report from your manual report workflow (Claude/council process).
- [ ] Upload/store the report in your working folder.
- [ ] If report is available in BeeSold, click **Download Report**.
- [ ] Send report to client for review.
- [ ] If rejected, capture reason and re-run report workflow.
- [ ] If approved, move listing forward to production/assets.

Pass condition:

- You can produce deliverables from one completed intake with full traceability (Q&A file + report file + approval/rejection note).

## 4) Demo Flow Checks (After Go Live Setup)

- [x] Broker can sign in at `/broker/sign-in`.
- [x] Broker can see their pipeline kanban and timers.
- [x] Broker can add a client and invite sends.
- [x] Listing type works for both:
- [x] `OMG_V1`
- [x] `COMMERCIAL_V1`
- [x] Commercial intake shows 6 phases.
- [x] Save and resume works.
- [x] Mission Control shows the same client/session updates.
- [x] Branding changes (logo/colors/sender/footer) show in portal and emails.

Pass condition:

- You can run one clean end-to-end demo without engineering help.

## 5) Nice-To-Have After Demo

- [ ] Auth hardening evidence complete (rate limits + tenant isolation tests).
- [ ] Full QA/UAT signoff recorded.
- [ ] Go-live rollback runbook tested.

## 6) If You Stop For The Day

Before closing, do these 3 things:

- [ ] Tick what you completed.
- [ ] Add one line to log below.
- [ ] Leave one clear “Next action”.

### Session Log

- 2026-03-10: Checklist rewritten in simpler step-by-step format.
- 2026-03-10: Step A complete and Step B complete (TXT/CNAME/TLS all PASS on broker domain).
- 2026-03-10: Step C complete (sender domain verified), Step D complete (real branded invite sent), demo flow checks completed.
- 2026-04-14: Added send-to-client preflight and manual processing flow for sales-first operation.

### Next Action

- `Start at Step B: Broker custom domain setup in Vercel + /broker/settings`
