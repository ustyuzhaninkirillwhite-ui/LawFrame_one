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
      'ai',
      'automation',
      'activepieces',
      'approval',
      'canvas',
      'connection',
      'moderation',
      'recommendation',
      'security',
      'billing',
      'audit'
    )
  );

insert into app.permissions (code, label, description, scope, high_risk)
values
  ('canvas.view', 'View Canvas', 'Open LexFrame Canvas automation drafts.', 'canvas', false),
  ('canvas.edit', 'Edit Canvas', 'Create and apply Canvas draft operations.', 'canvas', true),
  ('canvas.debug', 'Debug Canvas', 'View raw Canvas DSL diagnostics.', 'canvas', true),
  ('canvas.open_advanced_builder', 'Open advanced builder from Canvas', 'Request backend-gated Activepieces advanced builder from Canvas.', 'canvas', true)
on conflict (code) do update
set
  label = excluded.label,
  description = excluded.description,
  scope = excluded.scope,
  high_risk = excluded.high_risk;

insert into app.role_permissions (role_code, permission_code)
values
  ('owner', 'canvas.view'),
  ('owner', 'canvas.edit'),
  ('owner', 'canvas.debug'),
  ('owner', 'canvas.open_advanced_builder'),
  ('admin', 'canvas.view'),
  ('admin', 'canvas.edit'),
  ('admin', 'canvas.debug'),
  ('admin', 'canvas.open_advanced_builder'),
  ('lawyer', 'canvas.view'),
  ('lawyer', 'canvas.edit'),
  ('security_admin', 'canvas.view'),
  ('assistant', 'canvas.view'),
  ('viewer', 'canvas.view')
on conflict (role_code, permission_code) do nothing;

create table if not exists app.automation_canvas_drafts (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  project_id text null,
  installed_automation_id uuid not null references app.installed_automations(id) on delete cascade,
  source_template_version_id uuid null references app.automation_template_versions(id) on delete set null,
  schema_version text not null default '2.0' check (schema_version in ('2.0')),
  workflow jsonb not null default '{}'::jsonb,
  workflow_hash text not null,
  validation_summary jsonb not null default '{}'::jsonb,
  runtime_projection jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published', 'restored', 'runtime_synced', 'runtime_modified')),
  created_by_user_id uuid null references app.profiles(id) on delete set null,
  updated_by_user_id uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, installed_automation_id)
);

create table if not exists app.automation_canvas_operations (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  project_id text null,
  installed_automation_id uuid not null references app.installed_automations(id) on delete cascade,
  draft_version_id uuid not null references app.automation_canvas_drafts(id) on delete cascade,
  actor_id uuid null references app.profiles(id) on delete set null,
  client_operation_id text not null,
  operation_type text not null check (
    operation_type in (
      'ADD_NODE',
      'UPDATE_NODE',
      'MOVE_NODE',
      'DELETE_NODE',
      'ADD_EDGE',
      'DELETE_EDGE',
      'UPDATE_EDGE',
      'UPDATE_NODE_CONFIG',
      'UPDATE_LAYOUT'
    )
  ),
  operation_payload jsonb not null default '{}'::jsonb,
  before_hash text null,
  after_hash text null,
  validation_summary jsonb not null default '{}'::jsonb,
  rejected boolean not null default false,
  rejected_reason text null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, installed_automation_id, client_operation_id)
);

create table if not exists app.automation_canvas_locks (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  installed_automation_id uuid not null references app.installed_automations(id) on delete cascade,
  locked_by_user_id uuid not null references app.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, installed_automation_id)
);

create index if not exists idx_app_automation_canvas_drafts_workspace
  on app.automation_canvas_drafts (workspace_id, updated_at desc);

create index if not exists idx_app_automation_canvas_operations_lookup
  on app.automation_canvas_operations (installed_automation_id, created_at desc);

create index if not exists idx_app_automation_canvas_locks_lookup
  on app.automation_canvas_locks (workspace_id, installed_automation_id, expires_at);

alter table app.automation_canvas_drafts enable row level security;
alter table app.automation_canvas_operations enable row level security;
alter table app.automation_canvas_locks enable row level security;

create policy automation_canvas_drafts_select_viewer
  on app.automation_canvas_drafts
  for select
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'canvas.view'));

create policy automation_canvas_drafts_manage_editor
  on app.automation_canvas_drafts
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'canvas.edit'))
  with check (public.has_workspace_permission(workspace_id, 'canvas.edit'));

create policy automation_canvas_operations_select_viewer
  on app.automation_canvas_operations
  for select
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'canvas.view'));

create policy automation_canvas_operations_manage_editor
  on app.automation_canvas_operations
  for insert
  to authenticated
  with check (public.has_workspace_permission(workspace_id, 'canvas.edit'));

create policy automation_canvas_locks_select_viewer
  on app.automation_canvas_locks
  for select
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'canvas.view'));

create policy automation_canvas_locks_manage_editor
  on app.automation_canvas_locks
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'canvas.edit'))
  with check (public.has_workspace_permission(workspace_id, 'canvas.edit'));

grant select, insert, update on app.automation_canvas_drafts to authenticated;
grant select, insert on app.automation_canvas_operations to authenticated;
grant select, insert, update, delete on app.automation_canvas_locks to authenticated;
