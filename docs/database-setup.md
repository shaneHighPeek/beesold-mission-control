# Database Setup (60-Minute Sprint)

Last updated: 2026-02-18

This gets BeeSold to a production-ready Postgres foundation quickly.

## Current Status (2026-02-18)

- [x] Supabase project created.
- [x] `docs/schema.sql` applied successfully.
- [x] `off-market-group` brokerage seeded.
- [x] Local `.env.local` populated.
- [x] Driver toggle added (`PERSISTENCE_DRIVER=mock|postgres`).
- [x] Brokerage read/update paths now support Postgres (Supabase REST) when enabled.
- [x] Onboarding/auth/intake runtime writes now support Postgres mode.
- [x] Pipeline/report storage supports Postgres mode (`jobs`, `job_status`, `job_outputs`, `reports`).

## Goal For This Session

In one focused hour, complete:

1. Provision Supabase/Postgres.
2. Apply `docs/schema.sql`.
3. Seed one brokerage + test client data.
4. Store credentials in env vars.
5. Confirm local app can switch from mock safely in next step.

## Prerequisites

- Supabase account (or managed Postgres instance)
- Project owner permissions
- Access to this repo

## Step 1: Create Database (10 min)

1. Create a new Supabase project.
2. Save these values:
   - Project URL
   - Publishable key (`sb_publishable_...`)
   - Secret key (`sb_secret_...`)
   - Postgres connection string (`DATABASE_URL`)

## Step 2: Apply Schema (10 min)

1. Open Supabase SQL editor.
2. Paste `docs/schema.sql`.
3. Run all.
4. Verify tables exist:
   - `brokerages`
   - `client_identities`
   - `intake_sessions`
   - `intake_steps`
   - `intake_assets`
   - `magic_links`
   - `portal_auth_sessions`
   - `outbound_emails`
   - `webhook_idempotency`
   - `audit_log`

If your project was created before archive support, run this migration:

```sql
alter table brokerages
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz;

alter table client_identities
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz;
```

## Step 3: Seed Brokerage (10 min)

Run this SQL in Supabase SQL editor:

```sql
insert into brokerages (
  slug,
  name,
  short_name,
  sender_name,
  sender_email,
  portal_base_url,
  drive_parent_folder_id,
  logo_url,
  primary_color,
  secondary_color,
  legal_footer,
  show_beesold_branding,
  portal_tone
)
values (
  'off-market-group',
  'Off Market Group',
  'OffMarket',
  'Off Market Group',
  'clientservices@offmarketgroup.example',
  'http://localhost:3000',
  null,
  null,
  '#113968',
  '#d4932e',
  'Confidential and intended only for authorized clients.',
  false,
  'premium_advisory'
)
on conflict (slug) do update set
  name = excluded.name,
  short_name = excluded.short_name,
  sender_name = excluded.sender_name,
  sender_email = excluded.sender_email,
  portal_base_url = excluded.portal_base_url,
  primary_color = excluded.primary_color,
  secondary_color = excluded.secondary_color,
  legal_footer = excluded.legal_footer,
  portal_tone = excluded.portal_tone,
  updated_at = now();
```

## Step 4: Environment Variables (10 min)

Add to local `.env.local` (do not commit):

```bash
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...

# Backward-compat aliases (keep while code still expects legacy names)
SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...

MAGIC_LINK_SECRET=replace-me
PORTAL_SESSION_SECRET=replace-me
MAGIC_LINK_TTL_MINUTES=30
PORTAL_SESSION_TTL_HOURS=24
DEFAULT_PORTAL_BASE_URL=http://localhost:3000
PERSISTENCE_DRIVER=postgres

GOOGLE_DRIVE_ENABLED=true
GOOGLE_DRIVE_STRICT=true
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","token_uri":"https://oauth2.googleapis.com/token"}'
# Fallback parent folder (optional)
OMG_DRIVE_PARENT_FOLDER_ID=...
# Optional global fallback for all brokerages
GOOGLE_DRIVE_ROOT_FOLDER_ID=...
# Optional per-brokerage folder override (slug -> uppercase + underscores)
DRIVE_PARENT_FOLDER_ID_OFF_MARKET_GROUP=...

# Email transport
EMAIL_PROVIDER=stub
# If using Postmark
POSTMARK_SERVER_TOKEN=...
# If using SendGrid
SENDGRID_API_KEY=...

# Operator dashboard access control
OPERATOR_SESSION_SECRET=replace-me
OPERATOR_SESSION_TTL_HOURS=12
OPERATOR_ADMIN_EMAILS=shane@highpeekpro.com,lori@highpeekpro.com
OPERATOR_ADMIN_PASSWORD=replace-with-strong-password
OPERATOR_EDITOR_EMAILS=
OPERATOR_EDITOR_PASSWORD=
KLOR_SYSTEM_API_KEYS=replace-with-long-random-api-key
WEBHOOK_SHARED_SECRET=replace-with-long-random-shared-secret
```

## Step 4.1: Quick Driver Verification (2 min)

After saving `.env.local` and restarting `npm run dev`, run:

```bash
curl -s http://localhost:3000/api/dev/persistence
```

Expected result:

- `active: "postgres"` when driver is enabled and Supabase keys are valid.
- `supabase.brokerageCount` should be `>= 1` after brokerage seed.

## Step 5: Validation Queries (10 min)

Run in SQL editor:

```sql
select slug, name, short_name, portal_tone from brokerages;
select count(*) from intake_sessions;
select count(*) from audit_log;
```

Expected:

- `brokerages` contains `off-market-group`
- other tables are empty initially (unless seeded)

## Step 6: Next Immediate Engineering Task (10 min)

After schema is live, implement this next:

1. Add persistence adapter layer (`Mock` + `Postgres`).
2. Put Postgres behind feature flag:
   - `PERSISTENCE_DRIVER=mock|postgres`
3. Route onboarding + intake reads/writes through adapter.
4. Keep mock adapter available for local demos.

## Google Drive Credentials Setup (15 min)

1. In Google Cloud, create/select a project.
2. Enable `Google Drive API`.
3. Create a `Service Account`.
4. Create and download a JSON key.
5. Share your target parent Drive folder with the service account email (Editor access).
6. Put the full JSON into `GOOGLE_SERVICE_ACCOUNT_JSON` in `.env.local`.
7. Set `GOOGLE_DRIVE_ENABLED=true`.
8. For production-like behavior set `GOOGLE_DRIVE_STRICT=true` (Drive errors fail request instead of stub fallback).
8. Set parent folder:
   - per brokerage in Mission Control: `Drive parent folder ID`, or
   - per-brokerage env override: `DRIVE_PARENT_FOLDER_ID_<BROKERAGE_SLUG_UPPER>`, or
   - env fallback: `OMG_DRIVE_PARENT_FOLDER_ID`.
9. Restart `npm run dev`.
10. Create/invite a client and upload a file in portal; verify:
   - `intake_sessions.drive_folder_url` populated
   - `intake_assets.drive_file_url` populated
   - folder/file exists in Drive.

## Email Provider Setup (10 min)

1. Choose provider:
   - `EMAIL_PROVIDER=postmark`, or
   - `EMAIL_PROVIDER=sendgrid`.
2. Add credential:
   - `POSTMARK_SERVER_TOKEN=...` for Postmark, or
   - `SENDGRID_API_KEY=...` for SendGrid.
3. Restart `npm run dev`.
4. Trigger invite (new client or resend).
5. Verify in SQL:
   - `select provider_status, provider_message_id from outbound_emails order by created_at desc limit 10;`
6. Verify audit:
   - `WELCOME_EMAIL_SENT` for successful delivery, or
   - `WELCOME_EMAIL_FAILED` with error details.

## Acceptance Criteria For "DB Foundation Complete"

- Schema applied successfully with no errors.
- Brokerage seed row exists and is editable.
- Credentials stored securely in local env.
- Team has clear next step to swap runtime persistence.

## Notes

- Runtime supports `PERSISTENCE_DRIVER=postgres` and should be used for production-like testing.
- This setup removes database uncertainty so we can complete the adapter migration quickly.
- Keep RLS disabled until application auth claims are fully wired; RLS skeleton is in `docs/schema.sql`.
