# BeeSold Demo Checklist (Simple Version)

Last updated: 2026-03-10

Use this like a run sheet. Start at the top and tick boxes in order.

## 1) What We Are Doing Right Now

- Current target: get **one broker fully live** (branded domain + branded email + real invite sent).
- When this is done, move to section 3 (demo flow checks).

## 2) Go Live Setup (Do In This Exact Order)

### Step A - Database check

- [ ] In Supabase, confirm these columns exist:
- [ ] `brokerages.custom_domain`
- [ ] `brokerages.sender_domain`
- [ ] `intake_sessions.intake_template`

Pass condition:

- All 3 exist.

### Step B - Broker custom domain (website)

- [ ] In Vercel, add broker domain to this project (example: `portal.broker.com`).
- [ ] In BeeSold `/broker/settings`, enter Custom Domain and click `Save Domain`.
- [ ] Copy the TXT + CNAME records shown in BeeSold.
- [ ] Add those records in the broker DNS provider.
- [ ] Back in BeeSold, click `Verify DNS` until status shows `VERIFIED`.
- [ ] Open `https://<broker-domain>` and confirm page loads with SSL (lock icon).

Pass condition:

- Domain status is `VERIFIED` and HTTPS works.

### Step C - Broker sender domain (email)

- [ ] In Postmark, authenticate broker sender domain (SPF, DKIM, DMARC).
- [ ] In BeeSold `/broker/settings`, click `Verify Sender DNS` until status shows `VERIFIED`.

Pass condition:

- Sender domain status is `VERIFIED`.

### Step D - Real invite proof

- [ ] From broker pipeline, create a real test client (or resend invite).
- [ ] Confirm email is received from broker branded sender.
- [ ] Check DB table `outbound_emails`:
- [ ] `provider_status = 'SENT'`
- [ ] `from_email` uses broker domain

Pass condition:

- Real invite sent successfully with branded sender.

## 3) Demo Flow Checks (After Go Live Setup)

- [ ] Broker can sign in at `/broker/sign-in`.
- [ ] Broker can see their pipeline kanban and timers.
- [ ] Broker can add a client and invite sends.
- [ ] Listing type works for both:
- [ ] `OMG_V1`
- [ ] `COMMERCIAL_V1`
- [ ] Commercial intake shows 6 phases.
- [ ] Save and resume works.
- [ ] Mission Control shows the same client/session updates.
- [ ] Branding changes (logo/colors/sender/footer) show in portal and emails.

Pass condition:

- You can run one clean end-to-end demo without engineering help.

## 4) Nice-To-Have After Demo

- [ ] Auth hardening evidence complete (rate limits + tenant isolation tests).
- [ ] Full QA/UAT signoff recorded.
- [ ] Go-live rollback runbook tested.

## 5) If You Stop For The Day

Before closing, do these 3 things:

- [ ] Tick what you completed.
- [ ] Add one line to log below.
- [ ] Leave one clear “Next action”.

### Session Log

- 2026-03-10: Checklist rewritten in simpler step-by-step format.

### Next Action

- `Start at Step B: Broker custom domain setup in Vercel + /broker/settings`
