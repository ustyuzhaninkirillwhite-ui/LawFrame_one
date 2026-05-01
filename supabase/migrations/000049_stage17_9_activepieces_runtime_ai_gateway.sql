insert into app.permissions (code, label, description, scope, high_risk)
values
  (
    'activepieces.runtime_evidence',
    'Run Stage 17.9 Activepieces runtime evidence',
    'Generate read-back and security evidence for Activepieces runtime, AI Gateway and Local Owner Key Vault.',
    'activepieces',
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
  ('owner', 'activepieces.runtime_evidence'),
  ('admin', 'activepieces.runtime_evidence'),
  ('security_admin', 'activepieces.runtime_evidence')
on conflict (role_code, permission_code) do nothing;

alter table app.activepieces_project_bindings
  add column if not exists project_display_name text null,
  add column if not exists read_back_hash text null,
  add column if not exists error_code text null;

update app.activepieces_project_bindings
set project_display_name = coalesce(project_display_name, display_name)
where project_display_name is null;

alter table app.activepieces_project_bindings
  drop constraint if exists activepieces_project_bindings_status_check,
  drop constraint if exists app_activepieces_project_bindings_status_check;

alter table app.activepieces_project_bindings
  add constraint activepieces_project_bindings_status_check
  check (
    status in (
      'pending',
      'provisioned',
      'suspended',
      'error',
      'drift_detected'
    )
  );

alter table app.activepieces_user_bindings
  add column if not exists user_id uuid null references app.profiles(id) on delete cascade,
  add column if not exists ap_role text null,
  add column if not exists error_code text null;

update app.activepieces_user_bindings
set
  user_id = coalesce(user_id, auth_user_id),
  ap_role = coalesce(ap_role, role)
where user_id is null
   or ap_role is null;

alter table app.activepieces_user_bindings
  drop constraint if exists activepieces_user_bindings_status_check,
  drop constraint if exists app_activepieces_user_bindings_status_check,
  drop constraint if exists activepieces_user_bindings_ap_role_check;

alter table app.activepieces_user_bindings
  add constraint activepieces_user_bindings_status_check
  check (status in ('pending', 'provisioned', 'disabled', 'suspended', 'error')),
  add constraint activepieces_user_bindings_ap_role_check
  check (ap_role is null or ap_role in ('ADMIN', 'EDITOR', 'VIEWER'));

alter table app.automation_runtime_bindings
  add column if not exists ap_published_version_id text null,
  add column if not exists piece_version_pin text null,
  add column if not exists last_snapshot_id uuid null references app.activepieces_flow_snapshots(id) on delete set null,
  add column if not exists error_code text null;

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
      'missing_piece',
      'deprecated_piece',
      'missing_connection',
      'error',
      'failed'
    )
  );

create table if not exists app.activepieces_flow_bindings (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  automation_id uuid not null references app.installed_automations(id) on delete cascade,
  automation_version_id uuid null references app.automation_canvas_versions(id) on delete set null,
  runtime_binding_id uuid null references app.automation_runtime_bindings(id) on delete set null,
  ap_project_id text not null,
  ap_flow_id text null,
  ap_flow_version_id text null,
  ap_published_version_id text null,
  piece_version_pin text null,
  source_workflow_hash text not null,
  runtime_hash text null,
  last_synced_hash text null,
  sync_status text not null check (
    sync_status in (
      'not_created',
      'sync_required',
      'syncing',
      'synced',
      'runtime_modified',
      'conflict',
      'blocked_by_policy',
      'missing_piece',
      'missing_connection',
      'error'
    )
  ),
  last_synced_at timestamptz null,
  last_read_back_at timestamptz null,
  last_snapshot_id uuid null references app.activepieces_flow_snapshots(id) on delete set null,
  error_code text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, automation_id)
);

insert into app.activepieces_flow_bindings (
  id,
  workspace_id,
  automation_id,
  automation_version_id,
  runtime_binding_id,
  ap_project_id,
  ap_flow_id,
  ap_flow_version_id,
  ap_published_version_id,
  piece_version_pin,
  source_workflow_hash,
  runtime_hash,
  last_synced_hash,
  sync_status,
  last_synced_at,
  last_read_back_at,
  last_snapshot_id,
  error_code,
  created_at,
  updated_at
)
select
  public.app_uuid_v7(),
  b.workspace_id,
  b.installed_automation_id,
  b.automation_version_id,
  b.id,
  b.external_project_id,
  b.external_flow_id,
  b.activepieces_flow_version_id,
  b.ap_published_version_id,
  b.piece_version_pin,
  coalesce(b.source_workflow_hash, b.sync_hash, 'unknown'),
  b.runtime_hash,
  b.last_synced_hash,
  case
    when b.status in ('synced', 'runtime_modified', 'conflict', 'blocked_by_policy', 'missing_piece', 'missing_connection')
      then b.status
    when b.status = 'deprecated_piece' then 'missing_piece'
    when b.status in ('failed', 'compile_failed', 'runtime_unavailable') then 'error'
    else 'sync_required'
  end,
  b.last_synced_at,
  coalesce(b.last_read_back_at, b.last_checked_at),
  coalesce(b.last_snapshot_id, b.last_runtime_snapshot_id, b.last_synced_snapshot_id),
  b.error_code,
  b.created_at,
  b.updated_at
from app.automation_runtime_bindings b
where b.external_project_id is not null
on conflict (workspace_id, automation_id) do update
set
  automation_version_id = excluded.automation_version_id,
  runtime_binding_id = excluded.runtime_binding_id,
  ap_project_id = excluded.ap_project_id,
  ap_flow_id = excluded.ap_flow_id,
  ap_flow_version_id = excluded.ap_flow_version_id,
  ap_published_version_id = excluded.ap_published_version_id,
  piece_version_pin = excluded.piece_version_pin,
  source_workflow_hash = excluded.source_workflow_hash,
  runtime_hash = excluded.runtime_hash,
  last_synced_hash = excluded.last_synced_hash,
  sync_status = excluded.sync_status,
  last_synced_at = excluded.last_synced_at,
  last_read_back_at = excluded.last_read_back_at,
  last_snapshot_id = excluded.last_snapshot_id,
  error_code = excluded.error_code,
  updated_at = timezone('utc', now());

alter table app.activepieces_flow_snapshots
  add column if not exists flow_binding_id uuid null references app.activepieces_flow_bindings(id) on delete set null,
  add column if not exists snapshot_kind text null,
  add column if not exists runtime_hash text null,
  add column if not exists redaction_report jsonb not null default '{}'::jsonb,
  add column if not exists trace_id text null;

update app.activepieces_flow_snapshots s
set
  flow_binding_id = coalesce(s.flow_binding_id, fb.id),
  snapshot_kind = coalesce(
    s.snapshot_kind,
    case s.source
      when 'before_sync' then 'before_update'
      when 'after_sync' then 'after_update'
      when 'manual_pull' then 'read_back'
      else 'read_back'
    end
  ),
  runtime_hash = coalesce(s.runtime_hash, s.snapshot_hash),
  trace_id = coalesce(s.trace_id, 'trace_migration_stage17_9')
from app.activepieces_flow_bindings fb
where fb.runtime_binding_id = s.runtime_binding_id;

alter table app.activepieces_flow_snapshots
  drop constraint if exists activepieces_flow_snapshots_source_check,
  drop constraint if exists activepieces_flow_snapshots_snapshot_kind_check;

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
      'pre_overwrite',
      'read_back',
      'evidence'
    )
  ),
  add constraint activepieces_flow_snapshots_snapshot_kind_check
  check (
    snapshot_kind is null
    or snapshot_kind in (
      'read_back',
      'before_update',
      'after_update',
      'reverse_sync',
      'evidence'
    )
  );

create table if not exists app.local_owner_key_status (
  key_id text not null,
  provider text not null check (provider in ('xai', 'openai_compatible', 'cometapi', 'local')),
  model text not null,
  route text not null,
  fingerprint text not null,
  enabled boolean not null,
  purpose text not null check (purpose in ('ai_gateway', 'workflow_planning', 'activepieces_custom_piece')),
  priority integer not null default 100,
  last_used_at timestamptz null,
  last_validation_status text not null check (
    last_validation_status in (
      'valid',
      'invalid',
      'disabled',
      'budget_exhausted',
      'policy_blocked',
      'unavailable'
    )
  ),
  validation_error_code text null,
  source_path_status text not null check (source_path_status in ('default_path', 'env_override', 'unavailable')),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (key_id, purpose)
);

create table if not exists app.ai_gateway_audit_events (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  automation_id uuid null references app.installed_automations(id) on delete set null,
  run_id uuid null references app.workflow_runs(id) on delete set null,
  ap_project_id text null,
  ap_flow_id text null,
  ap_flow_version_id text null,
  step_name text null,
  event_type text not null,
  key_id text null,
  key_fingerprint text null,
  provider text null,
  model text null,
  route text null,
  data_classification text null,
  token_usage jsonb null,
  input_hash text null,
  output_hash text null,
  error_code text null,
  duration_ms integer null,
  trace_id text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint ai_gateway_audit_token_usage_object
  check (token_usage is null or jsonb_typeof(token_usage) = 'object')
);

create table if not exists app.activepieces_runtime_tokens (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  automation_id uuid not null references app.installed_automations(id) on delete cascade,
  workflow_run_id uuid null references app.workflow_runs(id) on delete cascade,
  ap_project_id text not null,
  ap_flow_id text not null,
  ap_flow_version_id text null,
  step_name text not null,
  purpose text not null check (
    purpose in (
      'activepieces_ai_gateway_action',
      'activepieces_callback',
      'artifact_write'
    )
  ),
  scopes text[] not null,
  jti_hash text not null unique,
  token_hash text not null unique,
  expires_at timestamptz not null,
  trace_id text not null,
  consumed_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.activepieces_runtime_artifacts (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  automation_id uuid null references app.installed_automations(id) on delete set null,
  workflow_run_id uuid null references app.workflow_runs(id) on delete set null,
  step_name text not null,
  artifact_type text not null,
  content_hash text not null,
  safe_metadata jsonb not null default '{}'::jsonb,
  trace_id text not null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table app.activepieces_callback_receipts
  drop constraint if exists activepieces_callback_receipts_callback_type_check;

alter table app.activepieces_callback_receipts
  add constraint activepieces_callback_receipts_callback_type_check
  check (
    callback_type in (
      'step_event',
      'run_event',
      'artifact',
      'approval_gate',
      'delivery_gate',
      'runtime_callback'
    )
  );

alter table app.activepieces_run_bindings
  add column if not exists scoped_runtime_token_jti_hash text null,
  add column if not exists scoped_runtime_token_expires_at timestamptz null;

alter table app.activepieces_user_bindings
  add column if not exists last_read_back_at timestamptz null;

create index if not exists idx_activepieces_project_bindings_stage17_9_status
  on app.activepieces_project_bindings (workspace_id, status, last_read_back_at desc);

create index if not exists idx_activepieces_user_bindings_stage17_9_status
  on app.activepieces_user_bindings (workspace_id, status, last_read_back_at desc);

create index if not exists idx_activepieces_flow_bindings_workspace_auto
  on app.activepieces_flow_bindings (workspace_id, automation_id);

create index if not exists idx_activepieces_flow_bindings_ap_flow
  on app.activepieces_flow_bindings (ap_flow_id);

create index if not exists idx_activepieces_flow_bindings_status
  on app.activepieces_flow_bindings (sync_status);

create index if not exists idx_activepieces_flow_snapshots_stage17_9_binding
  on app.activepieces_flow_snapshots (flow_binding_id, created_at desc)
  where flow_binding_id is not null;

create index if not exists idx_local_owner_key_status_purpose
  on app.local_owner_key_status (purpose, enabled, last_validation_status);

create index if not exists idx_ai_gateway_audit_events_workspace_trace
  on app.ai_gateway_audit_events (workspace_id, trace_id, created_at desc);

create index if not exists idx_ai_gateway_audit_events_run
  on app.ai_gateway_audit_events (run_id, event_type, created_at desc)
  where run_id is not null;

create index if not exists idx_activepieces_runtime_tokens_run
  on app.activepieces_runtime_tokens (workflow_run_id, purpose, expires_at desc);

create index if not exists idx_activepieces_runtime_artifacts_run
  on app.activepieces_runtime_artifacts (workflow_run_id, created_at desc);

alter table app.activepieces_flow_bindings enable row level security;
alter table app.local_owner_key_status enable row level security;
alter table app.ai_gateway_audit_events enable row level security;
alter table app.activepieces_runtime_tokens enable row level security;
alter table app.activepieces_runtime_artifacts enable row level security;

drop policy if exists activepieces_flow_bindings_select_member
  on app.activepieces_flow_bindings;
create policy activepieces_flow_bindings_select_member
  on app.activepieces_flow_bindings
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists activepieces_flow_bindings_manage_sync
  on app.activepieces_flow_bindings;
create policy activepieces_flow_bindings_manage_sync
  on app.activepieces_flow_bindings
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'activepieces.sync_flow'))
  with check (public.has_workspace_permission(workspace_id, 'activepieces.sync_flow'));

drop policy if exists local_owner_key_status_select_security
  on app.local_owner_key_status;
create policy local_owner_key_status_select_security
  on app.local_owner_key_status
  for select
  to authenticated
  using (true);

drop policy if exists ai_gateway_audit_events_select_member
  on app.ai_gateway_audit_events;
create policy ai_gateway_audit_events_select_member
  on app.ai_gateway_audit_events
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists ai_gateway_audit_events_manage_runtime
  on app.ai_gateway_audit_events;
create policy ai_gateway_audit_events_manage_runtime
  on app.ai_gateway_audit_events
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'automation.run'))
  with check (public.has_workspace_permission(workspace_id, 'automation.run'));

drop policy if exists activepieces_runtime_tokens_select_security
  on app.activepieces_runtime_tokens;
create policy activepieces_runtime_tokens_select_security
  on app.activepieces_runtime_tokens
  for select
  to authenticated
  using (
    public.has_workspace_permission(workspace_id, 'activepieces.runtime_evidence')
  );

drop policy if exists activepieces_runtime_artifacts_select_member
  on app.activepieces_runtime_artifacts;
create policy activepieces_runtime_artifacts_select_member
  on app.activepieces_runtime_artifacts
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists activepieces_runtime_artifacts_manage_runtime
  on app.activepieces_runtime_artifacts;
create policy activepieces_runtime_artifacts_manage_runtime
  on app.activepieces_runtime_artifacts
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'automation.run'))
  with check (public.has_workspace_permission(workspace_id, 'automation.run'));

grant select, insert, update on app.activepieces_flow_bindings to authenticated;
grant select on app.local_owner_key_status to authenticated;
grant select, insert, update on app.ai_gateway_audit_events to authenticated;
grant select, insert, update on app.activepieces_runtime_tokens to authenticated;
grant select, insert, update on app.activepieces_runtime_artifacts to authenticated;
