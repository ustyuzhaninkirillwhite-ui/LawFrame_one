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
  ('canvas.runtime.view', 'View runtime sync status', 'View Activepieces runtime sync status for Canvas workflows.', 'canvas', false),
  ('canvas.runtime.pull', 'Pull runtime snapshot', 'Pull Activepieces runtime snapshots for reverse sync review.', 'canvas', true),
  ('canvas.runtime.import_preview', 'Preview runtime import', 'Preview reverse sync imports from Activepieces into Canvas.', 'canvas', true),
  ('canvas.runtime.import_apply', 'Apply runtime import', 'Create a Canvas draft from reviewed Activepieces runtime changes.', 'canvas', true),
  ('canvas.runtime.reject_import', 'Reject runtime import', 'Reject reviewed Activepieces runtime changes.', 'canvas', true),
  ('canvas.runtime.overwrite', 'Overwrite runtime', 'Overwrite Activepieces runtime with canonical LexFrame Canvas projection.', 'canvas', true),
  ('canvas.runtime.resolve_conflict', 'Resolve runtime sync conflict', 'Resolve conflicts between LexFrame Canvas and Activepieces runtime.', 'canvas', true),
  ('canvas.runtime.view_technical_diff', 'View technical runtime diff', 'View advanced Activepieces runtime diff details.', 'canvas', true),
  ('canvas.runtime.import_unknown_step', 'Import unknown runtime step', 'Import unknown Activepieces steps in admin review mode.', 'canvas', true),
  ('canvas.runtime.import_code_step', 'Import runtime code step', 'Import Activepieces code steps in admin review mode.', 'canvas', true)
on conflict (code) do update
set
  label = excluded.label,
  description = excluded.description,
  scope = excluded.scope,
  high_risk = excluded.high_risk;

insert into app.role_permissions (role_code, permission_code)
values
  ('owner', 'canvas.runtime.view'),
  ('owner', 'canvas.runtime.pull'),
  ('owner', 'canvas.runtime.import_preview'),
  ('owner', 'canvas.runtime.import_apply'),
  ('owner', 'canvas.runtime.reject_import'),
  ('owner', 'canvas.runtime.overwrite'),
  ('owner', 'canvas.runtime.resolve_conflict'),
  ('owner', 'canvas.runtime.view_technical_diff'),
  ('owner', 'canvas.runtime.import_unknown_step'),
  ('owner', 'canvas.runtime.import_code_step'),
  ('admin', 'canvas.runtime.view'),
  ('admin', 'canvas.runtime.pull'),
  ('admin', 'canvas.runtime.import_preview'),
  ('admin', 'canvas.runtime.import_apply'),
  ('admin', 'canvas.runtime.reject_import'),
  ('admin', 'canvas.runtime.overwrite'),
  ('admin', 'canvas.runtime.resolve_conflict'),
  ('admin', 'canvas.runtime.view_technical_diff'),
  ('lawyer', 'canvas.runtime.view'),
  ('lawyer', 'canvas.runtime.pull'),
  ('lawyer', 'canvas.runtime.import_preview'),
  ('lawyer', 'canvas.runtime.import_apply'),
  ('security_admin', 'canvas.runtime.view'),
  ('security_admin', 'canvas.runtime.pull'),
  ('security_admin', 'canvas.runtime.import_preview'),
  ('security_admin', 'canvas.runtime.reject_import'),
  ('security_admin', 'canvas.runtime.resolve_conflict'),
  ('security_admin', 'canvas.runtime.view_technical_diff'),
  ('assistant', 'canvas.runtime.view'),
  ('viewer', 'canvas.runtime.view')
on conflict (role_code, permission_code) do nothing;

alter table app.automation_runtime_bindings
  add column if not exists last_synced_snapshot_id uuid null,
  add column if not exists last_synced_snapshot_hash text null,
  add column if not exists last_synced_workflow_hash text null,
  add column if not exists last_synced_mapping_hash text null,
  add column if not exists last_runtime_snapshot_id uuid null,
  add column if not exists runtime_modified_at timestamptz null,
  add column if not exists runtime_modified_by uuid null references app.profiles(id) on delete set null,
  add column if not exists conflict_id uuid null;

update app.automation_runtime_bindings
set
  last_synced_snapshot_hash = coalesce(last_synced_snapshot_hash, last_synced_hash, runtime_hash, sync_hash),
  last_synced_workflow_hash = coalesce(last_synced_workflow_hash, source_workflow_hash, sync_hash),
  last_synced_mapping_hash = coalesce(last_synced_mapping_hash, sync_hash)
where last_synced_snapshot_hash is null
   or last_synced_workflow_hash is null
   or last_synced_mapping_hash is null;

alter table app.automation_runtime_bindings
  drop constraint if exists automation_runtime_bindings_status_check;

alter table app.automation_runtime_bindings
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
      'importable',
      'import_requires_review',
      'import_blocked_by_policy',
      'conflict',
      'unknown_runtime_nodes',
      'runtime_unavailable',
      'blocked_by_policy',
      'deprecated_piece',
      'missing_connection',
      'failed'
    )
  );

alter table app.activepieces_flow_snapshots
  add column if not exists automation_id uuid null references app.installed_automations(id) on delete cascade,
  add column if not exists activepieces_project_id text null,
  add column if not exists previous_snapshot_hash text null,
  add column if not exists last_synced_hash text null,
  add column if not exists activepieces_updated_at timestamptz null,
  add column if not exists activepieces_updated_by text null;

update app.activepieces_flow_snapshots s
set automation_id = b.installed_automation_id,
    activepieces_project_id = b.external_project_id,
    last_synced_hash = coalesce(s.last_synced_hash, b.last_synced_hash)
from app.automation_runtime_bindings b
where s.runtime_binding_id = b.id
  and (s.automation_id is null or s.activepieces_project_id is null or s.last_synced_hash is null);

alter table app.activepieces_flow_snapshots
  drop constraint if exists activepieces_flow_snapshots_source_check;

alter table app.activepieces_flow_snapshots
  add constraint activepieces_flow_snapshots_source_check
  check (
    source in (
      'after_sync',
      'before_sync',
      'manual_pull',
      'after_builder_close',
      'before_run',
      'scheduled_reconcile',
      'webhook',
      'webhook_hint',
      'pre_import',
      'pre_overwrite'
    )
  );

create table if not exists app.activepieces_reverse_mappings (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid null references app.workspaces(id) on delete cascade,
  piece_name text not null,
  piece_version text not null,
  action_name text null,
  trigger_name text null,
  module_code text not null,
  module_version text not null,
  reverse_mapping_schema jsonb not null default '{}'::jsonb,
  reverse_input_mapper jsonb not null default '{}'::jsonb,
  reverse_output_mapper jsonb not null default '{}'::jsonb,
  confidence text not null default 'exact' check (confidence in ('exact', 'compatible', 'partial', 'unknown', 'blocked')),
  status text not null default 'active' check (status in ('active', 'deprecated', 'blocked')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (piece_name, piece_version, action_name, trigger_name, module_code, module_version)
);

create table if not exists app.automation_import_candidates (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  automation_id uuid not null references app.installed_automations(id) on delete cascade,
  runtime_binding_id uuid not null references app.automation_runtime_bindings(id) on delete cascade,
  snapshot_id uuid not null references app.activepieces_flow_snapshots(id) on delete cascade,
  base_canvas_draft_id uuid null references app.automation_canvas_drafts(id) on delete set null,
  base_workflow_hash text not null,
  candidate_workflow jsonb not null,
  candidate_workflow_hash text not null,
  validation_summary jsonb not null,
  importability text not null check (importability in ('fully_importable', 'importable_with_warnings', 'requires_review', 'blocked_by_policy', 'unmappable')),
  status text not null default 'preview_ready' check (status in ('preview_ready', 'blocked_by_policy', 'applied', 'rejected', 'expired', 'conflict')),
  diff_report_id uuid null,
  created_by uuid not null references app.profiles(id) on delete restrict,
  applied_by uuid null references app.profiles(id) on delete set null,
  rejected_by uuid null references app.profiles(id) on delete set null,
  rejection_reason text null,
  created_at timestamptz not null default timezone('utc', now()),
  applied_at timestamptz null,
  rejected_at timestamptz null,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.automation_import_diffs (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  automation_id uuid not null references app.installed_automations(id) on delete cascade,
  runtime_binding_id uuid not null references app.automation_runtime_bindings(id) on delete cascade,
  snapshot_id uuid not null references app.activepieces_flow_snapshots(id) on delete cascade,
  candidate_id uuid null references app.automation_import_candidates(id) on delete set null,
  diff_items jsonb not null,
  technical_diff jsonb not null default '{}'::jsonb,
  importability text not null check (importability in ('fully_importable', 'importable_with_warnings', 'requires_review', 'blocked_by_policy', 'unmappable')),
  severity text not null check (severity in ('info', 'warning', 'requires_review', 'policy_block', 'conflict')),
  summary jsonb not null default '{}'::jsonb,
  created_by uuid not null references app.profiles(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now())
);

alter table app.automation_import_candidates
  add constraint automation_import_candidates_diff_report_fk
  foreign key (diff_report_id)
  references app.automation_import_diffs(id)
  on delete set null;

create table if not exists app.runtime_sync_conflicts (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  automation_id uuid not null references app.installed_automations(id) on delete cascade,
  runtime_binding_id uuid not null references app.automation_runtime_bindings(id) on delete cascade,
  snapshot_id uuid null references app.activepieces_flow_snapshots(id) on delete set null,
  conflict_type text not null check (
    conflict_type in (
      'both_sides_changed',
      'unmappable_runtime',
      'policy_block',
      'unknown_runtime_nodes',
      'approval_removed',
      'forbidden_piece_added',
      'direct_ai_provider_added',
      'external_delivery_without_approval',
      'piece_version_incompatible'
    )
  ),
  status text not null default 'open' check (status in ('open', 'resolved', 'rejected', 'overwritten')),
  runtime_hash text null,
  canonical_workflow_hash text null,
  issue_summary jsonb not null default '{}'::jsonb,
  resolution_action text null,
  created_by uuid null references app.profiles(id) on delete set null,
  resolved_by uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz null
);

create index if not exists idx_reverse_mappings_piece
  on app.activepieces_reverse_mappings (piece_name, piece_version, action_name, trigger_name)
  where status = 'active';

create index if not exists idx_import_candidates_automation
  on app.automation_import_candidates (workspace_id, automation_id, created_at desc);

create index if not exists idx_import_diffs_automation
  on app.automation_import_diffs (workspace_id, automation_id, created_at desc);

create index if not exists idx_runtime_conflicts_open
  on app.runtime_sync_conflicts (workspace_id, automation_id, created_at desc)
  where status = 'open';

create index if not exists idx_flow_snapshots_automation
  on app.activepieces_flow_snapshots (workspace_id, automation_id, created_at desc)
  where automation_id is not null;

alter table app.activepieces_reverse_mappings enable row level security;
alter table app.automation_import_candidates enable row level security;
alter table app.automation_import_diffs enable row level security;
alter table app.runtime_sync_conflicts enable row level security;

drop policy if exists activepieces_reverse_mappings_select_member on app.activepieces_reverse_mappings;
create policy activepieces_reverse_mappings_select_member
  on app.activepieces_reverse_mappings
  for select
  to authenticated
  using (workspace_id is null or public.has_workspace_permission(workspace_id, 'canvas.runtime.import_preview'));

drop policy if exists activepieces_reverse_mappings_admin on app.activepieces_reverse_mappings;
create policy activepieces_reverse_mappings_admin
  on app.activepieces_reverse_mappings
  for all
  to authenticated
  using (workspace_id is not null and public.has_workspace_permission(workspace_id, 'canvas.runtime.resolve_conflict'))
  with check (workspace_id is not null and public.has_workspace_permission(workspace_id, 'canvas.runtime.resolve_conflict'));

drop policy if exists automation_import_candidates_select_viewer on app.automation_import_candidates;
create policy automation_import_candidates_select_viewer
  on app.automation_import_candidates
  for select
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'canvas.runtime.view'));

drop policy if exists automation_import_candidates_manage_importer on app.automation_import_candidates;
create policy automation_import_candidates_manage_importer
  on app.automation_import_candidates
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'canvas.runtime.import_preview'))
  with check (public.has_workspace_permission(workspace_id, 'canvas.runtime.import_preview'));

drop policy if exists automation_import_diffs_select_viewer on app.automation_import_diffs;
create policy automation_import_diffs_select_viewer
  on app.automation_import_diffs
  for select
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'canvas.runtime.view'));

drop policy if exists automation_import_diffs_manage_importer on app.automation_import_diffs;
create policy automation_import_diffs_manage_importer
  on app.automation_import_diffs
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'canvas.runtime.import_preview'))
  with check (public.has_workspace_permission(workspace_id, 'canvas.runtime.import_preview'));

drop policy if exists runtime_sync_conflicts_select_viewer on app.runtime_sync_conflicts;
create policy runtime_sync_conflicts_select_viewer
  on app.runtime_sync_conflicts
  for select
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'canvas.runtime.view'));

drop policy if exists runtime_sync_conflicts_manage_resolver on app.runtime_sync_conflicts;
create policy runtime_sync_conflicts_manage_resolver
  on app.runtime_sync_conflicts
  for all
  to authenticated
  using (
    public.has_workspace_permission(workspace_id, 'canvas.runtime.import_preview')
    or public.has_workspace_permission(workspace_id, 'canvas.runtime.resolve_conflict')
  )
  with check (
    public.has_workspace_permission(workspace_id, 'canvas.runtime.import_preview')
    or public.has_workspace_permission(workspace_id, 'canvas.runtime.resolve_conflict')
  );

grant select, insert, update on app.activepieces_reverse_mappings to authenticated;
grant select, insert, update on app.automation_import_candidates to authenticated;
grant select, insert, update on app.automation_import_diffs to authenticated;
grant select, insert, update on app.runtime_sync_conflicts to authenticated;

insert into app.activepieces_reverse_mappings (
  piece_name,
  piece_version,
  action_name,
  trigger_name,
  module_code,
  module_version,
  confidence,
  status
)
values
  ('@lexframe/piece-canvas-trigger', '0.1.0', null, 'manual_start', 'manual_start', '0.1.0', 'exact', 'active'),
  ('@lexframe/piece-legal-module', '0.1.0', 'execute', null, 'legal_module', '0.1.0', 'compatible', 'active'),
  ('@lexframe/piece-legal-search', '1.4.2', 'searchCaseLaw', null, 'case_law_search', '1.2.0', 'exact', 'active'),
  ('@lexframe/piece-ai-gateway', '0.1.0', 'run_ai_gateway', null, 'ai_gateway', '0.1.0', 'exact', 'active'),
  ('@lexframe/piece-approval', '0.1.0', 'create_approval_task', null, 'human_approval', '0.1.0', 'exact', 'active'),
  ('@lexframe/piece-approval', '0.1.0', 'read_approval_decision', null, 'human_approval', '0.1.0', 'exact', 'active'),
  ('@lexframe/piece-delivery', '0.1.0', 'send_delivery', null, 'email_delivery', '0.1.0', 'exact', 'active'),
  ('@lexframe/piece-delivery', '0.1.0', 'preview_delivery', null, 'email_delivery', '0.1.0', 'exact', 'active'),
  ('@lexframe/piece-error-policy', '0.1.0', 'report_failure', null, 'error_handler', '0.1.0', 'exact', 'active'),
  ('@lexframe/piece-runtime-state', '0.1.0', 'complete_run', null, 'end', '0.1.0', 'exact', 'active')
on conflict (piece_name, piece_version, action_name, trigger_name, module_code, module_version)
do update set
  confidence = excluded.confidence,
  status = excluded.status,
  updated_at = timezone('utc', now());
