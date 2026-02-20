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
- Google Drive folder creation and file routing (service-account integration with safe fallback)
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
- `GET /operator/sign-in` operator dashboard sign-in
- `GET /api/operator-auth/me`
- `POST /api/operator-auth/sign-in`
- `POST /api/operator-auth/sign-out`
- `GET /pipeline/session-data/[sessionId]` (admin or Klor API key; optional `updatedSince` query param)
- `GET /api/mission-control/intakes`
- `GET /api/mission-control/intakes/[sessionId]/timeline`
- `POST /api/mission-control/intakes/[sessionId]/resend-invite`
- `POST /api/mission-control/intakes/[sessionId]/magic-link`
- `POST /api/mission-control/intakes/[sessionId]/missing-items`
- `POST /api/mission-control/intakes/[sessionId]/archive`

## Env vars

- `MAGIC_LINK_SECRET`
- `PORTAL_SESSION_SECRET`
- `MAGIC_LINK_TTL_MINUTES` (default `30`)
- `PORTAL_SESSION_TTL_HOURS` (default `24`)
- `DEFAULT_PORTAL_BASE_URL` (default `http://localhost:3000`)
- `GOOGLE_DRIVE_ENABLED` (`true` to use Google Drive API)
- `GOOGLE_DRIVE_STRICT` (`true` to fail fast on Drive errors instead of stub fallback)
- `GOOGLE_SERVICE_ACCOUNT_JSON` (full JSON key content for service account)
- `OMG_DRIVE_PARENT_FOLDER_ID` (optional default parent folder)
- `GOOGLE_DRIVE_ROOT_FOLDER_ID` (optional global fallback parent folder)
- `DRIVE_PARENT_FOLDER_ID_<BROKERAGE_SLUG_UPPER>` (optional per-brokerage env override, e.g. `DRIVE_PARENT_FOLDER_ID_OFF_MARKET_GROUP`)
- `EMAIL_PROVIDER` (`stub` | `postmark` | `sendgrid`; default `stub`)
- `POSTMARK_SERVER_TOKEN` (required when `EMAIL_PROVIDER=postmark`)
- `SENDGRID_API_KEY` (required when `EMAIL_PROVIDER=sendgrid`)
- `OPERATOR_SESSION_SECRET` (HMAC secret for operator dashboard sessions)
- `OPERATOR_SESSION_TTL_HOURS` (default `12`)
- `OPERATOR_ADMIN_EMAILS` (optional CSV; defaults to `shane@highpeekpro.com,lori@highpeekpro.com`)
- `OPERATOR_ADMIN_PASSWORD` (required for admin sign-in)
- `OPERATOR_EDITOR_EMAILS` (optional CSV for non-admin dashboard users)
- `OPERATOR_EDITOR_PASSWORD` (required if editor emails are configured)
- `KLOR_SYSTEM_API_KEYS` (optional CSV; keys accepted via `x-klor-api-key` for system pipeline routes)
- `WEBHOOK_SHARED_SECRET` (optional in local; required in production for `/api/webhooks/client-intake` via `x-beesold-webhook-secret`)

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

1. Open operator sign-in: `http://localhost:3000/operator/sign-in`.
2. Sign in with a configured admin account.
3. Open Dashboard: `http://localhost:3000/mission-control`.
4. Create client with brokerage slug `off-market-group`.
5. Copy the magic link from `db.outbound_emails` (mock store) if testing locally without real mailer.
6. Open magic link, set password, continue to branded intake portal.
7. Save steps, click Save & Exit, reload and verify resume step/progress.
8. Upload a document and confirm Drive folder URL appears in Dashboard.
9. Submit partial, then in Dashboard request missing items, then resume intake.
10. Submit final and verify pipeline/report status progression + timeline events.

## Email provider test (MVP-02)

1. Set in `.env.local`:
   - `EMAIL_PROVIDER=postmark` and `POSTMARK_SERVER_TOKEN=...`
   - or `EMAIL_PROVIDER=sendgrid` and `SENDGRID_API_KEY=...`
2. Restart server: `npm run dev`
3. Create or resend an invite from Mission Control.
4. Verify:
   - `outbound_emails.provider_status = 'SENT'`
   - `outbound_emails.provider_message_id` is populated (provider-dependent)
   - audit includes `WELCOME_EMAIL_SENT` with provider metadata.
