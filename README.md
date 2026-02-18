# Mission Control

Secure multi-tenant onboarding + intake workflow for BeeSold white-label brokerages.

## What is implemented

- Admin onboarding entrypoint: `POST /api/onboarding/clients`
- API/webhook onboarding entrypoint (idempotent): `POST /api/webhooks/client-intake`
- White-label brokerage configuration (seeded with `off-market-group`)
- Branded invite email generation with brokerage sender identity
- Magic-link authentication (tokenized, one-time, expiring)
- Password authentication (set on first access + sign-in later)
- Tenant-scoped portal session cookie with signature verification
- Multi-session intake flow with autosave, Save & Exit, resume-at-last-step
- Partial submit + missing-items request loop + final submit
- Audit timeline for key actions (invites, magic link use, password set, saves, uploads, submissions, status changes)
- Google Drive folder creation/upload routing hooks (stubbed + link surfaced in Mission Control)
- Mission Control dashboard with invite status, completion, last activity, partial/final state, owner, missing items, drive link, and timeline

## Core routes

- `GET /portal/[brokerageSlug]` client sign-in page
- `GET /portal/auth/magic?token=...` magic-link consume + portal session
- `GET /portal/[brokerageSlug]/set-password`
- `GET /portal/[brokerageSlug]/intake`
- `GET /api/portal/[brokerageSlug]/session`
- `POST /api/portal/[brokerageSlug]/save-step`
- `POST /api/portal/[brokerageSlug]/save-exit`
- `POST /api/portal/[brokerageSlug]/assets`
- `POST /api/portal/[brokerageSlug]/submit-partial`
- `POST /api/portal/[brokerageSlug]/submit-final`
- `GET /api/mission-control/intakes`
- `GET /api/mission-control/intakes/[sessionId]/timeline`
- `POST /api/mission-control/intakes/[sessionId]/resend-invite`
- `POST /api/mission-control/intakes/[sessionId]/magic-link`
- `POST /api/mission-control/intakes/[sessionId]/missing-items`

## Env vars

- `MAGIC_LINK_SECRET`
- `PORTAL_SESSION_SECRET`
- `MAGIC_LINK_TTL_MINUTES` (default `30`)
- `PORTAL_SESSION_TTL_HOURS` (default `24`)
- `DEFAULT_PORTAL_BASE_URL` (default `http://localhost:3000`)
- `GOOGLE_DRIVE_ENABLED` (`true` to use real adapter when implemented)
- `OMG_DRIVE_PARENT_FOLDER_ID` (optional seed parent folder)

## Add a new brokerage brand

1. Add a brokerage record in `lib/persistence/mockDb.ts` (`brokerages` array).
2. Set `slug`, sender fields, `portalBaseUrl`, Drive parent folder, and `branding` values.
3. Use that `slug` in onboarding requests (`brokerageSlug`).

## Intake schema plug-in

- The form engine consumes `INTAKE_STEP_DEFINITIONS` in `lib/domain/intakeConfig.ts`.
- Replace this constant with your complete 83-field/7-section spec without changing route/UI contracts.

## Run

```bash
npm install
npm run dev
npm run typecheck
```

## Full-flow test checklist

1. Open Mission Control: `http://localhost:3000/mission-control`.
2. Create client with brokerage slug `off-market-group`.
3. Copy the magic link from `db.outbound_emails` (mock store) if testing locally without real mailer.
4. Open magic link, set password, continue to branded intake portal.
5. Save steps, click Save & Exit, reload and verify resume step/progress.
6. Upload a document and confirm Drive folder URL appears in Mission Control.
7. Submit partial, then in Mission Control request missing items, then resume intake.
8. Submit final and verify pipeline/report status progression + timeline events.
