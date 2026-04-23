alter table app.installed_automations
  add column if not exists runtime_project_id text null,
  add column if not exists runtime_flow_id text null,
  add column if not exists sync_hash text null,
  add column if not exists last_synced_at timestamptz null;

alter table app.permissions drop constraint if exists permissions_scope_check;
alter table app.permissions drop constraint if exists app_permissions_scope_check;
alter table app.permissions
  add constraint permissions_scope_check
  check (
    scope in (
      'workspace',
      'profile',
      'document',
      'module',
      'automation',
      'activepieces',
      'connection',
      'recommendation',
      'billing',
      'audit'
    )
  );

create table if not exists app.activepieces_project_bindings (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  external_project_id text not null unique,
  display_name text not null,
  status text not null default 'active' check (
    status in ('active', 'archived', 'error')
  ),
  last_synced_at timestamptz null,
  created_by_user_id uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id)
);

create table if not exists app.activepieces_user_bindings (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  auth_user_id uuid not null references app.profiles(id) on delete cascade,
  external_user_id text not null,
  role text not null check (role in ('ADMIN', 'EDITOR', 'VIEWER')),
  last_token_issued_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, auth_user_id),
  unique (workspace_id, external_user_id)
);

create table if not exists app.activepieces_embed_sessions (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  installed_automation_id uuid not null references app.installed_automations(id) on delete cascade,
  auth_user_id uuid not null references app.profiles(id) on delete cascade,
  purpose text not null check (purpose in ('builder', 'viewer')),
  token_hash text not null,
  token_expires_at timestamptz not null,
  external_project_id text not null,
  external_user_id text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (token_hash)
);

create table if not exists app.automation_runtime_bindings (
  id uuid primary key default public.app_uuid_v7(),
  installed_automation_id uuid not null references app.installed_automations(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  source_template_version_id uuid not null references app.automation_template_versions(id) on delete restrict,
  external_project_id text not null,
  external_flow_id text not null,
  sync_hash text not null,
  projection_version text not null default 'v1',
  projection jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (
    status in ('pending', 'synced', 'failed')
  ),
  last_synced_at timestamptz null,
  last_error text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (installed_automation_id),
  unique (workspace_id, external_flow_id)
);

create table if not exists app.automation_sync_jobs (
  id uuid primary key default public.app_uuid_v7(),
  installed_automation_id uuid not null references app.installed_automations(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  request_actor_user_id uuid null references app.profiles(id) on delete set null,
  status text not null check (status in ('started', 'synced', 'failed')),
  sync_hash text null,
  error_code text null,
  error_message text null,
  started_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz null
);

create table if not exists app.automation_compile_errors (
  id uuid primary key default public.app_uuid_v7(),
  installed_automation_id uuid not null references app.installed_automations(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  code text not null,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.workflow_runs (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  installed_automation_id uuid not null references app.installed_automations(id) on delete restrict,
  automation_runtime_binding_id uuid null references app.automation_runtime_bindings(id) on delete set null,
  external_run_id text null,
  mode text not null check (mode in ('dry_run', 'full_run')),
  status text not null check (
    status in ('queued', 'running', 'waiting_approval', 'completed', 'failed')
  ),
  current_step text not null,
  progress_percent integer not null default 0 check (
    progress_percent >= 0 and progress_percent <= 100
  ),
  trace_id text not null,
  step_status jsonb not null default '[]'::jsonb,
  artifact_refs jsonb not null default '[]'::jsonb,
  approval_state text not null default 'not_required' check (
    approval_state in ('not_required', 'pending', 'approved', 'rejected')
  ),
  error_code text null,
  started_at timestamptz null,
  finished_at timestamptz null,
  idempotency_key text null,
  created_by_user_id uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, idempotency_key)
);

create table if not exists app.workflow_run_steps (
  id uuid primary key default public.app_uuid_v7(),
  workflow_run_id uuid not null references app.workflow_runs(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  position integer not null,
  step_code text not null,
  module_code text not null,
  status text not null check (
    status in ('queued', 'running', 'waiting_approval', 'completed', 'failed')
  ),
  requires_approval boolean not null default false,
  outputs jsonb not null default '{}'::jsonb,
  error_code text null,
  started_at timestamptz null,
  finished_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workflow_run_id, step_code)
);

create table if not exists app.activepieces_run_bindings (
  id uuid primary key default public.app_uuid_v7(),
  workflow_run_id uuid not null references app.workflow_runs(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  external_flow_id text null,
  external_run_id text null,
  callback_token_hash text not null,
  status text not null default 'queued' check (
    status in ('queued', 'running', 'waiting_approval', 'completed', 'failed')
  ),
  last_reconciled_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workflow_run_id),
  unique (callback_token_hash)
);

create table if not exists app.runtime_connections (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  code text not null,
  provider text not null,
  display_name text not null,
  external_connection_name text null,
  scope text not null default 'workspace' check (
    scope in ('workspace', 'predefined')
  ),
  status text not null default 'connected' check (
    status in ('connected', 'missing', 'error', 'revoked')
  ),
  metadata jsonb not null default '{}'::jsonb,
  last_checked_at timestamptz null,
  created_by_user_id uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, code)
);

create table if not exists app.activepieces_callback_receipts (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  workflow_run_id uuid not null references app.workflow_runs(id) on delete cascade,
  callback_type text not null check (
    callback_type in ('step_event', 'run_event', 'artifact')
  ),
  receipt_key text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'received' check (
    status in ('received', 'processed', 'rejected')
  ),
  received_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz null,
  unique (receipt_key)
);

create index if not exists idx_app_activepieces_project_bindings_workspace
  on app.activepieces_project_bindings (workspace_id, status);

create index if not exists idx_app_activepieces_user_bindings_workspace_user
  on app.activepieces_user_bindings (workspace_id, auth_user_id);

create index if not exists idx_app_automation_runtime_bindings_workspace
  on app.automation_runtime_bindings (workspace_id, status, last_synced_at desc);

create index if not exists idx_app_automation_sync_jobs_lookup
  on app.automation_sync_jobs (installed_automation_id, started_at desc);

create index if not exists idx_app_automation_compile_errors_lookup
  on app.automation_compile_errors (installed_automation_id, created_at desc);

create index if not exists idx_app_workflow_runs_workspace
  on app.workflow_runs (workspace_id, created_at desc);

create index if not exists idx_app_workflow_runs_automation
  on app.workflow_runs (installed_automation_id, created_at desc);

create index if not exists idx_app_workflow_run_steps_lookup
  on app.workflow_run_steps (workflow_run_id, position asc);

create index if not exists idx_app_activepieces_run_bindings_external
  on app.activepieces_run_bindings (workspace_id, external_run_id);

create index if not exists idx_app_runtime_connections_workspace
  on app.runtime_connections (workspace_id, status, updated_at desc);

create index if not exists idx_app_activepieces_callback_receipts_run
  on app.activepieces_callback_receipts (workflow_run_id, received_at desc);
