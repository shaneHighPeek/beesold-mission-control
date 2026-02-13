-- BeeSold Mission Control Phase 1 schema draft
-- Target: Supabase/Postgres

create type intake_lifecycle_state as enum (
  'DRAFT',
  'IN_PROGRESS',
  'SUBMITTED',
  'KLOR_SYNTHESIS',
  'COUNCIL_RUNNING',
  'REPORT_READY',
  'APPROVED'
);

create type job_state as enum ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');
create type job_kind as enum ('KLOR_RUN', 'COUNCIL_RUN');
create type actor_kind as enum ('SYSTEM', 'OPERATOR', 'CLIENT');
create type asset_category as enum ('FINANCIALS', 'LEGAL', 'PROPERTY', 'OTHER');

create table intake_sessions (
  id uuid primary key,
  token text unique not null,
  client_name text not null,
  client_email text not null,
  status intake_lifecycle_state not null default 'DRAFT',
  current_step int not null default 1,
  total_steps int not null,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table intake_steps (
  id uuid primary key,
  session_id uuid not null references intake_sessions(id) on delete cascade,
  step_key text not null,
  title text not null,
  step_order int not null,
  data jsonb not null default '{}'::jsonb,
  is_complete boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (session_id, step_key)
);

create table intake_assets (
  id uuid primary key,
  session_id uuid not null references intake_sessions(id) on delete cascade,
  category asset_category not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  storage_path text,
  uploaded_at timestamptz not null default now()
);

create table intake_status (
  id uuid primary key,
  session_id uuid not null references intake_sessions(id) on delete cascade,
  status intake_lifecycle_state not null,
  note text not null,
  created_at timestamptz not null default now()
);

create table jobs (
  id uuid primary key,
  session_id uuid not null references intake_sessions(id) on delete cascade,
  kind job_kind not null,
  status job_state not null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create table job_status (
  id uuid primary key,
  job_id uuid not null references jobs(id) on delete cascade,
  status job_state not null,
  created_at timestamptz not null default now()
);

create table job_outputs (
  id uuid primary key,
  job_id uuid not null references jobs(id) on delete cascade,
  output_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table reports (
  id uuid primary key,
  session_id uuid unique not null references intake_sessions(id) on delete cascade,
  title text not null,
  summary text not null,
  findings jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table audit_log (
  id uuid primary key,
  session_id uuid not null references intake_sessions(id) on delete cascade,
  actor actor_kind not null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_intake_sessions_status on intake_sessions(status);
create index idx_jobs_session on jobs(session_id);
create index idx_audit_session on audit_log(session_id);
