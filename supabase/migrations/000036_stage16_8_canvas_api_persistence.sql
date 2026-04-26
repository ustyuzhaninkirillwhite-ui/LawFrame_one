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
  ('canvas.publish', 'Publish Canvas', 'Publish immutable Canvas workflow versions.', 'canvas', true),
  ('canvas.restore_version', 'Restore Canvas versions', 'Restore published Canvas versions or snapshots as drafts.', 'canvas', true),
  ('canvas.manage_locks', 'Manage Canvas locks', 'Manage or recover Canvas edit locks.', 'canvas', true),
  ('canvas.view_validation', 'View Canvas validation', 'View detailed Canvas validation results.', 'canvas', false),
  ('canvas.view_raw_dsl', 'View raw Canvas DSL', 'View raw Workflow DSL and diagnostics.', 'canvas', true),
  ('canvas.import_runtime', 'Import runtime flow', 'Import runtime builder changes as a Canvas draft.', 'canvas', true)
on conflict (code) do update
set
  label = excluded.label,
  description = excluded.description,
  scope = excluded.scope,
  high_risk = excluded.high_risk;

insert into app.role_permissions (role_code, permission_code)
values
  ('owner', 'canvas.publish'),
  ('owner', 'canvas.restore_version'),
  ('owner', 'canvas.manage_locks'),
  ('owner', 'canvas.view_validation'),
  ('owner', 'canvas.view_raw_dsl'),
  ('owner', 'canvas.import_runtime'),
  ('admin', 'canvas.publish'),
  ('admin', 'canvas.restore_version'),
  ('admin', 'canvas.manage_locks'),
  ('admin', 'canvas.view_validation'),
  ('admin', 'canvas.view_raw_dsl'),
  ('admin', 'canvas.import_runtime'),
  ('lawyer', 'canvas.view_validation')
on conflict (role_code, permission_code) do nothing;

alter table app.automation_canvas_drafts
  add column if not exists base_version_id uuid null,
  add column if not exists current_version_id uuid null,
  add column if not exists normalized_canvas jsonb not null default '{"nodes":[],"edges":[],"viewport":{"x":0,"y":0,"zoom":1}}'::jsonb,
  add column if not exists runtime_projection_status text not null default 'not_compiled',
  add column if not exists activepieces_sync_status text not null default 'not_synced',
  add column if not exists archived_at timestamptz null;

alter table app.automation_canvas_drafts drop constraint if exists automation_canvas_drafts_status_check;
alter table app.automation_canvas_drafts
  add constraint automation_canvas_drafts_status_check
  check (
    status in (
      'editing',
      'validating',
      'valid',
      'invalid',
      'ready_to_publish',
      'published_to_version',
      'conflict',
      'archived',
      'draft',
      'published',
      'restored',
      'runtime_synced',
      'runtime_modified'
    )
  );

alter table app.automation_canvas_drafts drop constraint if exists automation_canvas_drafts_workspace_id_installed_automation_id_key;

create unique index if not exists idx_canvas_drafts_active_automation
  on app.automation_canvas_drafts (workspace_id, installed_automation_id)
  where archived_at is null;

create table if not exists app.automation_canvas_validation_results (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  installed_automation_id uuid not null references app.installed_automations(id) on delete cascade,
  draft_version_id uuid null references app.automation_canvas_drafts(id) on delete cascade,
  version_id uuid null,
  revision integer null,
  validation_level text not null default 'fast' check (validation_level in ('fast', 'full', 'publish_gate', 'runtime_gate')),
  status text not null,
  errors jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  policy_blocks jsonb not null default '[]'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  can_save boolean not null default true,
  can_test boolean not null default false,
  can_publish boolean not null default false,
  can_compile boolean not null default false,
  can_run boolean not null default false,
  created_by_user_id uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.automation_canvas_versions (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  installed_automation_id uuid not null references app.installed_automations(id) on delete cascade,
  draft_version_id uuid null references app.automation_canvas_drafts(id) on delete set null,
  version_no integer not null,
  schema_version text not null default '2.0',
  workflow jsonb not null,
  normalized_canvas jsonb not null,
  workflow_hash text not null,
  validation_result_id uuid null references app.automation_canvas_validation_results(id) on delete set null,
  compile_preview_id uuid null,
  runtime_binding_id uuid null,
  status text not null default 'published' check (status in ('published', 'deprecated', 'restored', 'archived')),
  change_note text null,
  published_by_user_id uuid not null references app.profiles(id) on delete restrict,
  published_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  unique (installed_automation_id, version_no),
  unique (installed_automation_id, workflow_hash)
);

create table if not exists app.automation_canvas_snapshots (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  installed_automation_id uuid not null references app.installed_automations(id) on delete cascade,
  draft_version_id uuid not null references app.automation_canvas_drafts(id) on delete cascade,
  revision integer not null,
  snapshot_hash text not null,
  workflow jsonb not null,
  normalized_canvas jsonb not null,
  reason text not null check (
    reason in (
      'initial',
      'autosave_checkpoint',
      'manual_save',
      'before_publish',
      'after_publish',
      'before_import_runtime',
      'before_restore',
      'system_maintenance'
    )
  ),
  note text null,
  created_by_user_id uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (draft_version_id, revision, reason)
);

alter table app.automation_canvas_operations
  add column if not exists expected_revision integer null,
  add column if not exists resulting_revision integer null,
  add column if not exists inverse_operation_payload jsonb null,
  add column if not exists idempotency_key text null,
  add column if not exists validation_result_id uuid null references app.automation_canvas_validation_results(id) on delete set null;

update app.automation_canvas_operations
set
  expected_revision = coalesce(expected_revision, before_revision),
  resulting_revision = coalesce(resulting_revision, after_revision)
where expected_revision is null
   or resulting_revision is null;

alter table app.automation_canvas_operations drop constraint if exists automation_canvas_operations_operation_type_check;
alter table app.automation_canvas_operations
  add constraint automation_canvas_operations_operation_type_check
  check (
    operation_type in (
      'ADD_NODE_FROM_MODULE',
      'ADD_NODE',
      'DUPLICATE_NODE',
      'UPDATE_NODE',
      'MOVE_NODE',
      'DELETE_NODE',
      'UPDATE_NODE_CONFIG',
      'ADD_EDGE',
      'DELETE_EDGE',
      'UPDATE_EDGE',
      'UPDATE_CONDITION',
      'UPDATE_WORKFLOW_POLICY',
      'UPDATE_NODE_POLICY',
      'UPDATE_LAYOUT',
      'UPSERT_WORKFLOW_INPUT',
      'DELETE_WORKFLOW_INPUT',
      'UPSERT_WORKFLOW_OUTPUT',
      'DELETE_WORKFLOW_OUTPUT',
      'UPSERT_INPUT_BINDING',
      'DELETE_INPUT_BINDING',
      'PIN_SAMPLE_DATA',
      'UNPIN_SAMPLE_DATA',
      'SNAPSHOT_RESTORE',
      'RUNTIME_IMPORT_AS_DRAFT'
    )
  );

create unique index if not exists idx_canvas_operations_draft_idempotency
  on app.automation_canvas_operations (draft_version_id, idempotency_key)
  where idempotency_key is not null;

alter table app.automation_canvas_locks
  add column if not exists draft_version_id uuid null references app.automation_canvas_drafts(id) on delete cascade,
  add column if not exists lock_type text not null default 'edit',
  add column if not exists heartbeat_at timestamptz not null default timezone('utc', now()),
  add column if not exists released_at timestamptz null;

update app.automation_canvas_locks l
set draft_version_id = d.id
from app.automation_canvas_drafts d
where l.draft_version_id is null
  and d.workspace_id = l.workspace_id
  and d.installed_automation_id = l.installed_automation_id;

alter table app.automation_canvas_locks drop constraint if exists automation_canvas_locks_workspace_id_installed_automation_id_key;
alter table app.automation_canvas_locks drop constraint if exists automation_canvas_locks_workspace_id_installed_automation_i_key;

create unique index if not exists idx_canvas_locks_active_draft_type
  on app.automation_canvas_locks (draft_version_id, lock_type)
  where released_at is null and draft_version_id is not null;

create index if not exists idx_canvas_drafts_automation
  on app.automation_canvas_drafts (workspace_id, installed_automation_id, status);

create index if not exists idx_canvas_operations_draft_revision
  on app.automation_canvas_operations (draft_version_id, resulting_revision);

create index if not exists idx_canvas_operations_actor
  on app.automation_canvas_operations (actor_id, created_at desc);

create index if not exists idx_canvas_snapshots_draft_revision
  on app.automation_canvas_snapshots (draft_version_id, revision desc);

create index if not exists idx_canvas_versions_automation
  on app.automation_canvas_versions (installed_automation_id, version_no desc);

create index if not exists idx_canvas_validation_draft
  on app.automation_canvas_validation_results (draft_version_id, created_at desc);

alter table app.automation_canvas_validation_results enable row level security;
alter table app.automation_canvas_versions enable row level security;
alter table app.automation_canvas_snapshots enable row level security;

drop policy if exists automation_canvas_validation_select_viewer on app.automation_canvas_validation_results;
create policy automation_canvas_validation_select_viewer
  on app.automation_canvas_validation_results
  for select
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'canvas.view'));

drop policy if exists automation_canvas_validation_manage_editor on app.automation_canvas_validation_results;
create policy automation_canvas_validation_manage_editor
  on app.automation_canvas_validation_results
  for insert
  to authenticated
  with check (public.has_workspace_permission(workspace_id, 'canvas.edit'));

drop policy if exists automation_canvas_versions_select_viewer on app.automation_canvas_versions;
create policy automation_canvas_versions_select_viewer
  on app.automation_canvas_versions
  for select
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'canvas.view'));

drop policy if exists automation_canvas_versions_manage_publisher on app.automation_canvas_versions;
create policy automation_canvas_versions_manage_publisher
  on app.automation_canvas_versions
  for insert
  to authenticated
  with check (public.has_workspace_permission(workspace_id, 'canvas.publish'));

drop policy if exists automation_canvas_snapshots_select_viewer on app.automation_canvas_snapshots;
create policy automation_canvas_snapshots_select_viewer
  on app.automation_canvas_snapshots
  for select
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'canvas.view'));

drop policy if exists automation_canvas_snapshots_manage_editor on app.automation_canvas_snapshots;
create policy automation_canvas_snapshots_manage_editor
  on app.automation_canvas_snapshots
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'canvas.edit'))
  with check (public.has_workspace_permission(workspace_id, 'canvas.edit'));

grant select, insert on app.automation_canvas_validation_results to authenticated;
grant select, insert on app.automation_canvas_versions to authenticated;
grant select, insert, update, delete on app.automation_canvas_snapshots to authenticated;
