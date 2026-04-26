insert into app.permissions (code, label, description, scope, high_risk)
values
  (
    'automation.sync_runtime',
    'Sync automation runtime',
    'Compile and synchronize LexFrame Canvas workflow versions to the configured runtime.',
    'automation',
    true
  )
on conflict (code) do update
set
  label = excluded.label,
  description = excluded.description,
  scope = excluded.scope,
  high_risk = excluded.high_risk;

insert into app.role_permissions (role_code, permission_code)
values
  ('owner', 'automation.sync_runtime'),
  ('admin', 'automation.sync_runtime')
on conflict (role_code, permission_code) do nothing;

alter table app.automation_runtime_bindings
  add column if not exists automation_version_id uuid null references app.automation_canvas_versions(id) on delete set null,
  add column if not exists runtime text not null default 'activepieces',
  add column if not exists activepieces_flow_version_id text null,
  add column if not exists source_workflow_hash text null,
  add column if not exists runtime_hash text null,
  add column if not exists last_synced_hash text null,
  add column if not exists last_compile_report_id uuid null,
  add column if not exists last_checked_at timestamptz null;

alter table app.automation_runtime_bindings
  alter column source_template_version_id drop not null;

alter table app.automation_runtime_bindings
  drop constraint if exists automation_runtime_bindings_runtime_check,
  drop constraint if exists automation_runtime_bindings_status_check;

alter table app.automation_runtime_bindings
  add constraint automation_runtime_bindings_runtime_check
  check (runtime in ('activepieces')),
  add constraint automation_runtime_bindings_status_check
  check (
    status in (
      'not_created',
      'pending',
      'compile_failed',
      'sync_required',
      'syncing',
      'synced',
      'runtime_modified',
      'conflict',
      'blocked_by_policy',
      'deprecated_piece',
      'missing_connection',
      'failed'
    )
  );

update app.automation_runtime_bindings
set
  runtime = coalesce(runtime, 'activepieces'),
  source_workflow_hash = coalesce(source_workflow_hash, sync_hash),
  runtime_hash = coalesce(runtime_hash, sync_hash),
  last_synced_hash = coalesce(last_synced_hash, sync_hash)
where source_workflow_hash is null
   or runtime_hash is null
   or last_synced_hash is null;

create table if not exists app.automation_compile_reports (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  automation_id uuid not null references app.installed_automations(id) on delete cascade,
  automation_version_id uuid null references app.automation_canvas_versions(id) on delete set null,
  draft_version_id uuid null references app.automation_canvas_drafts(id) on delete set null,
  compiler_version text not null,
  target_runtime text not null check (target_runtime in ('activepieces')),
  compile_mode text not null check (
    compile_mode in (
      'preview',
      'dry_run_compile',
      'sync_draft_to_runtime',
      'publish_and_sync',
      'repair_runtime_projection'
    )
  ),
  source_workflow_hash text not null,
  status text not null check (
    status in (
      'compiled',
      'compiled_with_warnings',
      'blocked_by_validation',
      'blocked_by_policy',
      'blocked_by_missing_connection',
      'runtime_sync_required',
      'runtime_synced',
      'runtime_conflict'
    )
  ),
  validation_result jsonb not null,
  runtime_ir jsonb not null,
  activepieces_projection jsonb not null,
  generated_operations jsonb not null default '[]'::jsonb,
  required_pieces jsonb not null default '[]'::jsonb,
  required_connections jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  blocking_issues jsonb not null default '[]'::jsonb,
  created_by uuid not null references app.profiles(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.activepieces_flow_snapshots (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  runtime_binding_id uuid not null references app.automation_runtime_bindings(id) on delete cascade,
  activepieces_flow_id text not null,
  activepieces_flow_version_id text null,
  snapshot_json jsonb not null,
  normalized_snapshot_json jsonb not null,
  snapshot_hash text not null,
  source text not null check (
    source in ('after_sync', 'before_sync', 'manual_pull', 'before_run', 'webhook')
  ),
  created_by uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table app.automation_runtime_bindings
  drop constraint if exists automation_runtime_bindings_last_compile_report_id_fkey;

alter table app.automation_runtime_bindings
  add constraint automation_runtime_bindings_last_compile_report_id_fkey
  foreign key (last_compile_report_id)
  references app.automation_compile_reports(id)
  on delete set null;

create table if not exists app.automation_runtime_sync_events (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  automation_id uuid not null references app.installed_automations(id) on delete cascade,
  runtime_binding_id uuid null references app.automation_runtime_bindings(id) on delete set null,
  event_type text not null,
  status text not null,
  compile_report_id uuid null references app.automation_compile_reports(id) on delete set null,
  before_runtime_hash text null,
  after_runtime_hash text null,
  source_workflow_hash text null,
  idempotency_key text null,
  error_code text null,
  error_message text null,
  actor_id uuid null references app.profiles(id) on delete set null,
  trace_id text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, automation_id, event_type, idempotency_key)
);

create table if not exists app.runtime_step_mappings (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  runtime_binding_id uuid not null references app.automation_runtime_bindings(id) on delete cascade,
  source_node_id text not null,
  source_node_hash text not null,
  ir_step_id text not null,
  activepieces_step_name text not null,
  activepieces_step_display_name text not null,
  piece_name text null,
  piece_version text null,
  action_name text null,
  mapping_status text not null check (
    mapping_status in ('active', 'removed', 'unknown', 'conflict')
  ),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (runtime_binding_id, source_node_id, activepieces_step_name)
);

create table if not exists app.legal_module_runtime_mappings (
  id uuid primary key default public.app_uuid_v7(),
  module_version_id uuid not null references app.legal_module_versions(id) on delete cascade,
  runtime text not null check (runtime in ('activepieces', 'internal_worker', 'manual')),
  activepieces_piece_name text null,
  activepieces_piece_version text null,
  activepieces_action_name text null,
  activepieces_trigger_name text null,
  props_mapping jsonb not null default '{}'::jsonb,
  input_transformer jsonb not null default '{}'::jsonb,
  output_transformer jsonb not null default '{}'::jsonb,
  supports_dry_run boolean not null default false,
  supports_test_step boolean not null default false,
  required_connection_types jsonb not null default '[]'::jsonb,
  required_permissions jsonb not null default '[]'::jsonb,
  data_policy jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (
    status in ('active', 'deprecated', 'blocked', 'missing')
  ),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (module_version_id, runtime)
);

create table if not exists app.activepieces_piece_registry (
  id uuid primary key default public.app_uuid_v7(),
  piece_name text not null,
  piece_version text not null,
  display_name text not null,
  source text not null check (
    source in ('lexframe_private', 'activepieces_builtin', 'external')
  ),
  actions jsonb not null default '[]'::jsonb,
  triggers jsonb not null default '[]'::jsonb,
  props_schema jsonb not null default '{}'::jsonb,
  status text not null check (status in ('active', 'deprecated', 'blocked', 'missing')),
  last_checked_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (piece_name, piece_version)
);

insert into app.activepieces_piece_registry (
  piece_name,
  piece_version,
  display_name,
  source,
  actions,
  triggers,
  props_schema,
  status
)
values
  (
    '@lexframe/piece-canvas-trigger',
    '0.1.0',
    'LexFrame Canvas Trigger',
    'lexframe_private',
    '[]'::jsonb,
    '[{"name":"manual_start"}]'::jsonb,
    '{}'::jsonb,
    'active'
  ),
  (
    '@lexframe/piece-legal-module',
    '0.1.0',
    'LexFrame Legal Module',
    'lexframe_private',
    '[{"name":"execute"}]'::jsonb,
    '[]'::jsonb,
    '{}'::jsonb,
    'active'
  ),
  (
    '@lexframe/piece-ai-gateway',
    '0.1.0',
    'LexFrame AI Gateway',
    'lexframe_private',
    '[{"name":"run_ai_gateway"}]'::jsonb,
    '[]'::jsonb,
    '{}'::jsonb,
    'active'
  ),
  (
    '@lexframe/piece-approval',
    '0.1.0',
    'LexFrame Approval',
    'lexframe_private',
    '[{"name":"create_approval_task"},{"name":"read_approval_decision"}]'::jsonb,
    '[]'::jsonb,
    '{}'::jsonb,
    'active'
  ),
  (
    '@lexframe/piece-delivery',
    '0.1.0',
    'LexFrame Delivery',
    'lexframe_private',
    '[{"name":"preview_delivery"},{"name":"send_delivery"},{"name":"record_delivery_audit"}]'::jsonb,
    '[]'::jsonb,
    '{}'::jsonb,
    'active'
  ),
  (
    '@lexframe/piece-error-policy',
    '0.1.0',
    'LexFrame Error Policy',
    'lexframe_private',
    '[{"name":"report_failure"}]'::jsonb,
    '[]'::jsonb,
    '{}'::jsonb,
    'active'
  ),
  (
    '@lexframe/piece-runtime-state',
    '0.1.0',
    'LexFrame Runtime State',
    'lexframe_private',
    '[{"name":"complete_run"}]'::jsonb,
    '[]'::jsonb,
    '{}'::jsonb,
    'active'
  ),
  (
    '@activepieces/piece-flow-control',
    '0.1.0',
    'Activepieces Flow Control',
    'activepieces_builtin',
    '[{"name":"wait_for_approval"},{"name":"evaluate_condition"},{"name":"loop_on_items"}]'::jsonb,
    '[]'::jsonb,
    '{}'::jsonb,
    'active'
  )
on conflict (piece_name, piece_version) do update
set
  display_name = excluded.display_name,
  actions = excluded.actions,
  triggers = excluded.triggers,
  props_schema = excluded.props_schema,
  status = excluded.status,
  last_checked_at = timezone('utc', now());

create index if not exists idx_compile_reports_automation
  on app.automation_compile_reports (workspace_id, automation_id, created_at desc);

create index if not exists idx_compile_reports_source_hash
  on app.automation_compile_reports (workspace_id, automation_id, source_workflow_hash, created_at desc);

create index if not exists idx_flow_snapshots_binding
  on app.activepieces_flow_snapshots (runtime_binding_id, created_at desc);

create index if not exists idx_runtime_sync_events_automation
  on app.automation_runtime_sync_events (workspace_id, automation_id, created_at desc);

create index if not exists idx_runtime_step_mappings_binding
  on app.runtime_step_mappings (runtime_binding_id, mapping_status);

alter table app.automation_compile_reports enable row level security;
alter table app.activepieces_flow_snapshots enable row level security;
alter table app.automation_runtime_sync_events enable row level security;
alter table app.runtime_step_mappings enable row level security;
alter table app.legal_module_runtime_mappings enable row level security;
alter table app.activepieces_piece_registry enable row level security;

drop policy if exists automation_compile_reports_select_viewer on app.automation_compile_reports;
create policy automation_compile_reports_select_viewer
  on app.automation_compile_reports
  for select
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'canvas.view_validation'));

drop policy if exists automation_compile_reports_insert_sync on app.automation_compile_reports;
create policy automation_compile_reports_insert_sync
  on app.automation_compile_reports
  for insert
  to authenticated
  with check (
    public.has_workspace_permission(workspace_id, 'canvas.view_validation')
    or public.has_workspace_permission(workspace_id, 'automation.sync_runtime')
  );

drop policy if exists activepieces_flow_snapshots_select_viewer on app.activepieces_flow_snapshots;
create policy activepieces_flow_snapshots_select_viewer
  on app.activepieces_flow_snapshots
  for select
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'canvas.view_validation'));

drop policy if exists activepieces_flow_snapshots_manage_sync on app.activepieces_flow_snapshots;
create policy activepieces_flow_snapshots_manage_sync
  on app.activepieces_flow_snapshots
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'automation.sync_runtime'))
  with check (public.has_workspace_permission(workspace_id, 'automation.sync_runtime'));

drop policy if exists automation_runtime_sync_events_select_viewer on app.automation_runtime_sync_events;
create policy automation_runtime_sync_events_select_viewer
  on app.automation_runtime_sync_events
  for select
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'canvas.view_validation'));

drop policy if exists automation_runtime_sync_events_manage_sync on app.automation_runtime_sync_events;
create policy automation_runtime_sync_events_manage_sync
  on app.automation_runtime_sync_events
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'automation.sync_runtime'))
  with check (public.has_workspace_permission(workspace_id, 'automation.sync_runtime'));

drop policy if exists runtime_step_mappings_select_viewer on app.runtime_step_mappings;
create policy runtime_step_mappings_select_viewer
  on app.runtime_step_mappings
  for select
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'canvas.view_validation'));

drop policy if exists runtime_step_mappings_manage_sync on app.runtime_step_mappings;
create policy runtime_step_mappings_manage_sync
  on app.runtime_step_mappings
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'automation.sync_runtime'))
  with check (public.has_workspace_permission(workspace_id, 'automation.sync_runtime'));

drop policy if exists legal_module_runtime_mappings_select_member on app.legal_module_runtime_mappings;
create policy legal_module_runtime_mappings_select_member
  on app.legal_module_runtime_mappings
  for select
  to authenticated
  using (true);

drop policy if exists legal_module_runtime_mappings_manage_module_admin on app.legal_module_runtime_mappings;
create policy legal_module_runtime_mappings_manage_module_admin
  on app.legal_module_runtime_mappings
  for all
  to authenticated
  using (false)
  with check (false);

drop policy if exists activepieces_piece_registry_select_member on app.activepieces_piece_registry;
create policy activepieces_piece_registry_select_member
  on app.activepieces_piece_registry
  for select
  to authenticated
  using (true);

drop policy if exists activepieces_piece_registry_manage_sync on app.activepieces_piece_registry;
create policy activepieces_piece_registry_manage_sync
  on app.activepieces_piece_registry
  for all
  to authenticated
  using (false)
  with check (false);

grant select, insert on app.automation_compile_reports to authenticated;
grant select, insert, update on app.activepieces_flow_snapshots to authenticated;
grant select, insert, update on app.automation_runtime_sync_events to authenticated;
grant select, insert, update on app.runtime_step_mappings to authenticated;
grant select, insert, update on app.legal_module_runtime_mappings to authenticated;
grant select, insert, update on app.activepieces_piece_registry to authenticated;
