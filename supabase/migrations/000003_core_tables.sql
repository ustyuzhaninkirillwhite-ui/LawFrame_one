create table if not exists workspaces (
  id uuid primary key default public.app_uuid_v7(),
  slug text not null unique,
  name text not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists workspace_members (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  auth_user_id uuid not null,
  role workspace_role not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, auth_user_id)
);

create table if not exists permissions (
  code text primary key,
  description text not null
);

create table if not exists profile_rules (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  code text not null,
  title text not null,
  trigger_kind text not null,
  condition_field text not null,
  expected_value text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, code)
);

create table if not exists profiles (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null,
  owner_auth_user_id uuid not null,
  rule_id uuid null references profile_rules(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists automation_templates (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid null references workspaces(id) on delete set null,
  code text not null unique,
  title text not null,
  category text not null,
  status automation_status not null default 'draft',
  workflow_contract jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists installed_automations (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  template_id uuid not null references automation_templates(id) on delete restrict,
  title text not null,
  workflow_state workflow_state not null default 'draft',
  builder_state builder_state not null default 'unavailable',
  created_at timestamptz not null default now()
);

create table if not exists installed_automation_versions (
  id uuid primary key default public.app_uuid_v7(),
  installed_automation_id uuid not null references installed_automations(id) on delete cascade,
  version text not null,
  workflow_contract jsonb not null,
  created_at timestamptz not null default now(),
  unique (installed_automation_id, version)
);

create table if not exists activepieces_projects (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  external_project_id text not null,
  status text not null default 'draft',
  unique (workspace_id)
);

create table if not exists activepieces_flow_mappings (
  id uuid primary key default public.app_uuid_v7(),
  installed_automation_version_id uuid not null references installed_automation_versions(id) on delete cascade,
  activepieces_project_id text not null,
  activepieces_flow_id text not null,
  sync_hash text not null,
  last_sync_at timestamptz null
);

create table if not exists documents (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null,
  kind text not null,
  classification data_classification not null,
  storage_state text not null,
  created_at timestamptz not null default now()
);

create table if not exists document_artifacts (
  id uuid primary key default public.app_uuid_v7(),
  document_id uuid not null references documents(id) on delete cascade,
  storage_path text not null,
  signed_url_required boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists workflow_runs (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  installed_automation_version_id uuid not null references installed_automation_versions(id) on delete restrict,
  status run_status not null default 'queued',
  trace_id text not null,
  activepieces_run_id text null,
  created_at timestamptz not null default now()
);

create table if not exists run_steps (
  id uuid primary key default public.app_uuid_v7(),
  workflow_run_id uuid not null references workflow_runs(id) on delete cascade,
  step_code text not null,
  status run_status not null default 'queued',
  requires_approval boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists publication_requests (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  installed_automation_id uuid not null references installed_automations(id) on delete restrict,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists recommendations (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null,
  rationale text not null,
  status text not null default 'candidate',
  created_at timestamptz not null default now()
);

create table if not exists audit_events (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid null references workspaces(id) on delete set null,
  actor_auth_user_id uuid null,
  event_code text not null,
  trace_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_workspace_members_workspace_user on workspace_members (workspace_id, auth_user_id);
create index if not exists idx_installed_automations_workspace on installed_automations (workspace_id);
create index if not exists idx_workflow_runs_workspace_status on workflow_runs (workspace_id, status);
create index if not exists idx_documents_workspace_classification on documents (workspace_id, classification);
create index if not exists idx_audit_events_workspace_created on audit_events (workspace_id, created_at desc);

