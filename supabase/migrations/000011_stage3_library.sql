create extension if not exists pg_trgm;

create table if not exists app.legal_modules (
  id uuid primary key default public.app_uuid_v7(),
  code text not null unique,
  title text not null,
  category text not null,
  description text not null,
  risk_level text not null check (risk_level in ('low', 'medium', 'high')),
  current_status text not null default 'draft' check (
    current_status in ('draft', 'published', 'deprecated')
  ),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz null
);

create table if not exists app.legal_module_versions (
  id uuid primary key default public.app_uuid_v7(),
  module_id uuid not null references app.legal_modules(id) on delete cascade,
  version text not null,
  status text not null check (status in ('draft', 'published', 'deprecated')),
  input_schema jsonb not null default '[]'::jsonb,
  output_schema jsonb not null default '[]'::jsonb,
  requirements jsonb not null default '[]'::jsonb,
  runtime_mapping jsonb not null default '{}'::jsonb,
  examples jsonb not null default '[]'::jsonb,
  validation_status text not null default 'valid' check (
    validation_status in ('valid', 'invalid')
  ),
  validation_issues jsonb not null default '[]'::jsonb,
  created_by_user_id uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  published_at timestamptz null,
  unique (module_id, version)
);

create table if not exists app.automation_templates (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid null references app.workspaces(id) on delete cascade,
  code text not null unique,
  title text not null,
  category text not null,
  description text not null,
  scope text not null check (scope in ('product', 'workspace', 'public', 'private')),
  status text not null default 'draft' check (status in ('draft', 'ready', 'blocked')),
  readiness text not null default 'design_ready' check (
    readiness in (
      'not_started',
      'design_ready',
      'contract_ready',
      'backend_ready',
      'frontend_ready',
      'integration_ready',
      'production_ready'
    )
  ),
  required_permissions text[] not null default '{}'::text[],
  module_codes text[] not null default '{}'::text[],
  publication_status text not null default 'not_requested' check (
    publication_status in (
      'not_requested',
      'submitted',
      'approved',
      'rejected',
      'changes_requested'
    )
  ),
  compatibility_status text not null default 'compatible' check (
    compatibility_status in (
      'compatible',
      'runtime_sync_pending',
      'missing_requirements',
      'policy_blocked'
    )
  ),
  runtime_sync_state text not null default 'not_requested' check (
    runtime_sync_state in ('not_requested', 'pending', 'synced', 'failed')
  ),
  available boolean not null default true,
  disabled_reason text null,
  source_template_id uuid null references app.automation_templates(id) on delete set null,
  created_by_user_id uuid null references app.profiles(id) on delete set null,
  updated_by_user_id uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz null
);

create table if not exists app.automation_template_versions (
  id uuid primary key default public.app_uuid_v7(),
  template_id uuid not null references app.automation_templates(id) on delete cascade,
  version text not null,
  status text not null check (status in ('draft', 'published', 'deprecated')),
  publication_status text not null default 'not_requested' check (
    publication_status in (
      'not_requested',
      'submitted',
      'approved',
      'rejected',
      'changes_requested'
    )
  ),
  workflow jsonb not null default '{}'::jsonb,
  requirements jsonb not null default '[]'::jsonb,
  module_codes text[] not null default '{}'::text[],
  required_inputs text[] not null default '{}'::text[],
  validation_status text not null default 'valid' check (
    validation_status in ('valid', 'invalid')
  ),
  validation_issues jsonb not null default '[]'::jsonb,
  created_by_user_id uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  published_at timestamptz null,
  unique (template_id, version)
);

create table if not exists app.installed_automations (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  template_id uuid not null references app.automation_templates(id) on delete restrict,
  source_template_version_id uuid not null references app.automation_template_versions(id) on delete restrict,
  title text not null,
  version text not null,
  workflow_state text not null check (
    workflow_state in ('draft', 'compiled', 'execution_ready')
  ),
  builder_state text not null check (
    builder_state in ('unavailable', 'mock', 'ready')
  ),
  sync_state text not null check (
    sync_state in ('not_requested', 'pending', 'synced', 'failed')
  ),
  compatibility_status text not null check (
    compatibility_status in (
      'compatible',
      'runtime_sync_pending',
      'missing_requirements',
      'policy_blocked'
    )
  ),
  available boolean not null default true,
  disabled_reason text null,
  required_inputs text[] not null default '{}'::text[],
  requirements jsonb not null default '[]'::jsonb,
  missing_connections text[] not null default '{}'::text[],
  next_gate text not null,
  workflow jsonb not null default '{}'::jsonb,
  created_by_user_id uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz null
);

create table if not exists app.publication_requests (
  id uuid primary key default public.app_uuid_v7(),
  template_id uuid not null references app.automation_templates(id) on delete cascade,
  template_version_id uuid not null references app.automation_template_versions(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  status text not null default 'submitted' check (
    status in ('submitted', 'approved', 'rejected', 'changes_requested')
  ),
  submitted_at timestamptz not null default timezone('utc', now()),
  reviewed_at timestamptz null,
  reviewer_user_id uuid null references app.profiles(id) on delete set null,
  review_note text null,
  public_template_id uuid null references app.automation_templates(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_app_legal_modules_status
  on app.legal_modules (current_status, category)
  where deleted_at is null;

create index if not exists idx_app_legal_module_versions_module
  on app.legal_module_versions (module_id, status, created_at desc);

create index if not exists idx_app_automation_templates_workspace_scope
  on app.automation_templates (workspace_id, scope, status, updated_at desc)
  where deleted_at is null;

create index if not exists idx_app_automation_templates_search
  on app.automation_templates using gin (
    to_tsvector(
      'simple',
      coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(code, '')
    )
  );

create index if not exists idx_app_automation_templates_title_trgm
  on app.automation_templates using gin (title gin_trgm_ops);

create index if not exists idx_app_automation_templates_code_trgm
  on app.automation_templates using gin (code gin_trgm_ops);

create index if not exists idx_app_automation_template_versions_template
  on app.automation_template_versions (template_id, status, created_at desc);

create index if not exists idx_app_installed_automations_workspace
  on app.installed_automations (workspace_id, created_at desc)
  where deleted_at is null;

create index if not exists idx_app_publication_requests_workspace_status
  on app.publication_requests (workspace_id, status, submitted_at desc);
