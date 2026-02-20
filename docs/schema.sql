-- BeeSold Mission Control database schema (Postgres / Supabase)
-- Updated: 2026-02-19

create extension if not exists pgcrypto;

-- Enums
create type intake_lifecycle_state as enum (
  'INVITED',
  'IN_PROGRESS',
  'PARTIAL_SUBMITTED',
  'MISSING_ITEMS_REQUESTED',
  'FINAL_SUBMITTED',
  'KLOR_SYNTHESIS',
  'COUNCIL_RUNNING',
  'REPORT_READY',
  'APPROVED'
);

create type job_state as enum ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');
create type job_kind as enum ('KLOR_RUN', 'COUNCIL_RUN');
create type actor_kind as enum ('SYSTEM', 'OPERATOR', 'CLIENT');
create type asset_category as enum ('FINANCIALS', 'LEGAL', 'PROPERTY', 'OTHER');
create type portal_tone as enum ('corporate', 'premium_advisory');

-- Brokerage-level white-label configuration
create table brokerages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  short_name text,
  sender_name text not null,
  sender_email text not null,
  portal_base_url text not null,
  drive_parent_folder_id text,
  logo_url text,
  primary_color text not null,
  secondary_color text not null,
  legal_footer text not null,
  show_beesold_branding boolean not null default false,
  is_archived boolean not null default false,
  archived_at timestamptz,
  portal_tone portal_tone not null default 'premium_advisory',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Client profile per brokerage (tenant scoped)
create table client_identities (
  id uuid primary key default gen_random_uuid(),
  brokerage_id uuid not null references brokerages(id) on delete cascade,
  business_name text not null,
  contact_name text not null,
  email text not null,
  phone text,
  assigned_owner text,
  password_salt text,
  password_hash text,
  is_archived boolean not null default false,
  archived_at timestamptz,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brokerage_id, email)
);

-- Intake workflow container
create table intake_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references client_identities(id) on delete cascade,
  brokerage_id uuid not null references brokerages(id) on delete cascade,
  status intake_lifecycle_state not null default 'INVITED',
  current_step int not null default 1,
  total_steps int not null,
  completion_pct int not null default 0,
  partial_submitted_at timestamptz,
  final_submitted_at timestamptz,
  invite_sent_at timestamptz,
  last_portal_access_at timestamptz,
  drive_folder_id text,
  drive_folder_url text,
  missing_items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Step data (83-field schema can evolve in JSON)
create table intake_steps (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references intake_sessions(id) on delete cascade,
  step_key text not null,
  title text not null,
  step_order int not null,
  data jsonb not null default '{}'::jsonb,
  is_complete boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (session_id, step_key)
);

-- Uploaded documents/media
create table intake_assets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references intake_sessions(id) on delete cascade,
  brokerage_id uuid not null references brokerages(id) on delete cascade,
  client_id uuid not null references client_identities(id) on delete cascade,
  category asset_category not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  revision int not null default 1,
  drive_file_id text,
  drive_file_url text,
  uploaded_at timestamptz not null default now()
);

-- Lifecycle history
create table intake_status (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references intake_sessions(id) on delete cascade,
  status intake_lifecycle_state not null,
  note text not null,
  created_at timestamptz not null default now()
);

-- Magic link tokens (stored hashed)
create table magic_links (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  session_id uuid not null references intake_sessions(id) on delete cascade,
  client_id uuid not null references client_identities(id) on delete cascade,
  brokerage_id uuid not null references brokerages(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- Authenticated portal sessions
create table portal_auth_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references intake_sessions(id) on delete cascade,
  client_id uuid not null references client_identities(id) on delete cascade,
  brokerage_id uuid not null references brokerages(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Outbound message log (email provider events can join later)
create table outbound_emails (
  id uuid primary key default gen_random_uuid(),
  brokerage_id uuid not null references brokerages(id) on delete cascade,
  session_id uuid not null references intake_sessions(id) on delete cascade,
  recipient text not null,
  from_name text not null,
  from_email text not null,
  subject text not null,
  html_body text not null,
  provider_message_id text,
  provider_status text,
  created_at timestamptz not null default now()
);

-- Webhook idempotency guard
create table webhook_idempotency (
  id text not null,
  brokerage_id uuid not null references brokerages(id) on delete cascade,
  client_id uuid not null references client_identities(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (id, brokerage_id)
);

-- Pipeline + outputs
create table jobs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references intake_sessions(id) on delete cascade,
  kind job_kind not null,
  status job_state not null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create table job_status (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  status job_state not null,
  created_at timestamptz not null default now()
);

create table job_outputs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  output_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid unique not null references intake_sessions(id) on delete cascade,
  title text not null,
  summary text not null,
  findings jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Audit timeline
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references intake_sessions(id) on delete cascade,
  brokerage_id uuid not null references brokerages(id) on delete cascade,
  client_id uuid not null references client_identities(id) on delete cascade,
  actor actor_kind not null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Indexes
create index idx_brokerages_slug on brokerages(slug);
create index idx_clients_brokerage_email on client_identities(brokerage_id, email);
create index idx_sessions_brokerage_status on intake_sessions(brokerage_id, status);
create index idx_sessions_client on intake_sessions(client_id);
create index idx_steps_session on intake_steps(session_id);
create index idx_assets_session on intake_assets(session_id);
create index idx_status_session on intake_status(session_id);
create index idx_magic_links_expiry on magic_links(expires_at);
create index idx_portal_auth_expiry on portal_auth_sessions(expires_at);
create index idx_outbound_session on outbound_emails(session_id);
create index idx_jobs_session on jobs(session_id);
create index idx_audit_session on audit_log(session_id);
create index idx_audit_brokerage on audit_log(brokerage_id);

-- Optional RLS skeleton (enable once auth model is finalized)
-- alter table brokerages enable row level security;
-- alter table client_identities enable row level security;
-- alter table intake_sessions enable row level security;
-- create policy tenancy_sessions_select on intake_sessions
--   for select using (brokerage_id::text = current_setting('app.brokerage_id', true));
