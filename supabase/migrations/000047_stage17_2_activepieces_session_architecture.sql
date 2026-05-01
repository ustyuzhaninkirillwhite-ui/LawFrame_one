create table if not exists app.activepieces_runtime_instances (
  id uuid primary key default public.app_uuid_v7(),
  environment text not null,
  base_url text not null,
  public_url text not null,
  api_key_secret_ref text null,
  signing_key_secret_ref text null,
  edition text not null default 'unknown',
  license_gate_status text not null default 'unresolved' check (
    license_gate_status in ('unresolved', 'approved', 'blocked', 'not_required')
  ),
  status text not null default 'unknown' check (
    status in ('unknown', 'healthy', 'degraded', 'blocked', 'error')
  ),
  last_health_check_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (environment)
);

alter table app.activepieces_project_bindings
  add column if not exists runtime_instance_id uuid null
    references app.activepieces_runtime_instances(id) on delete set null,
  add column if not exists project_id text null,
  add column if not exists ap_project_id text null,
  add column if not exists last_read_back_at timestamptz null,
  add column if not exists last_session_trace_id text null;

alter table app.activepieces_user_bindings
  add column if not exists ap_user_id text null,
  add column if not exists last_login_at timestamptz null,
  add column if not exists last_session_trace_id text null;

alter table app.activepieces_embed_sessions
  add column if not exists role text null,
  add column if not exists pieces_filter_type text null,
  add column if not exists pieces_tags text[] not null default '{}'::text[],
  add column if not exists trace_id text null,
  add column if not exists mode text null,
  add column if not exists diagnostics_ref uuid null,
  add column if not exists reason_code text null;

alter table app.activepieces_embed_sessions
  drop constraint if exists activepieces_embed_sessions_purpose_check,
  drop constraint if exists app_activepieces_embed_sessions_purpose_check,
  drop constraint if exists activepieces_embed_sessions_role_check,
  drop constraint if exists activepieces_embed_sessions_mode_check,
  drop constraint if exists activepieces_embed_sessions_pieces_filter_type_check;

alter table app.activepieces_embed_sessions
  add constraint activepieces_embed_sessions_purpose_check
  check (purpose in ('builder', 'viewer', 'automation_canvas')),
  add constraint activepieces_embed_sessions_role_check
  check (role is null or role in ('ADMIN', 'EDITOR', 'VIEWER')),
  add constraint activepieces_embed_sessions_mode_check
  check (mode is null or mode in ('iframe_embed', 'reverse_proxy')),
  add constraint activepieces_embed_sessions_pieces_filter_type_check
  check (pieces_filter_type is null or pieces_filter_type in ('ALLOWED'));

alter table app.automation_runtime_bindings
  add column if not exists activepieces_read_back_status text null,
  add column if not exists last_read_back_at timestamptz null,
  add column if not exists last_session_trace_id text null;

alter table app.automation_runtime_bindings
  drop constraint if exists automation_runtime_bindings_read_back_status_check;

alter table app.automation_runtime_bindings
  add constraint automation_runtime_bindings_read_back_status_check
  check (
    activepieces_read_back_status is null
    or activepieces_read_back_status in (
      'pending',
      'succeeded',
      'failed',
      'runtime_modified',
      'import_requires_review'
    )
  );

create index if not exists idx_activepieces_runtime_instances_status
  on app.activepieces_runtime_instances (environment, status);

create index if not exists idx_activepieces_embed_sessions_trace
  on app.activepieces_embed_sessions (workspace_id, trace_id)
  where trace_id is not null;

create index if not exists idx_automation_runtime_bindings_read_back
  on app.automation_runtime_bindings (
    workspace_id,
    activepieces_read_back_status,
    last_read_back_at desc
  );

alter table app.activepieces_runtime_instances enable row level security;

drop policy if exists activepieces_runtime_instances_select_authenticated
  on app.activepieces_runtime_instances;

create policy activepieces_runtime_instances_select_authenticated
  on app.activepieces_runtime_instances
  for select
  to authenticated
  using (true);

grant select on app.activepieces_runtime_instances to authenticated;
