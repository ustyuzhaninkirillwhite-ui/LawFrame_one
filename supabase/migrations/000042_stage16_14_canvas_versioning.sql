insert into app.permissions (code, label, description, scope, high_risk)
values
  ('canvas.version.view', 'View Canvas versions', 'View Canvas version state, history, and checkpoints.', 'canvas', false),
  ('canvas.version.compare', 'Compare Canvas versions', 'Compare Canvas versions, drafts, and checkpoints.', 'canvas', false),
  ('canvas.version.download_json', 'Download Canvas JSON', 'Export redacted Canvas version JSON.', 'canvas', true),
  ('canvas.checkpoint.create', 'Create Canvas checkpoints', 'Create named or automatic Canvas checkpoints.', 'canvas', false),
  ('canvas.publish.validate', 'Validate Canvas publish', 'Run publish validation before creating an immutable Canvas version.', 'canvas', false),
  ('canvas.version.restore_as_draft', 'Restore Canvas version as draft', 'Restore a Canvas version without changing production.', 'canvas', true),
  ('canvas.version.rollback', 'Rollback Canvas version', 'Move production Canvas pointer to a previous immutable version.', 'canvas', true),
  ('canvas.runtime.rollback', 'Rollback Canvas runtime binding', 'Rollback runtime binding when projections are hash-compatible.', 'canvas', true),
  ('canvas.version.emergency_disable', 'Emergency disable Canvas production', 'Disable new production runs for a Canvas automation.', 'canvas', true),
  ('canvas.version.view_runtime_projection', 'View Canvas runtime projection', 'View redacted immutable runtime projection snapshots.', 'canvas', true)
on conflict (code) do update
set
  label = excluded.label,
  description = excluded.description,
  scope = excluded.scope,
  high_risk = excluded.high_risk;

insert into app.role_permissions (role_code, permission_code)
values
  ('owner', 'canvas.version.view'),
  ('owner', 'canvas.version.compare'),
  ('owner', 'canvas.version.download_json'),
  ('owner', 'canvas.checkpoint.create'),
  ('owner', 'canvas.publish.validate'),
  ('owner', 'canvas.version.restore_as_draft'),
  ('owner', 'canvas.version.rollback'),
  ('owner', 'canvas.runtime.rollback'),
  ('owner', 'canvas.version.emergency_disable'),
  ('owner', 'canvas.version.view_runtime_projection'),
  ('admin', 'canvas.version.view'),
  ('admin', 'canvas.version.compare'),
  ('admin', 'canvas.version.download_json'),
  ('admin', 'canvas.checkpoint.create'),
  ('admin', 'canvas.publish.validate'),
  ('admin', 'canvas.version.restore_as_draft'),
  ('admin', 'canvas.version.rollback'),
  ('admin', 'canvas.runtime.rollback'),
  ('admin', 'canvas.version.emergency_disable'),
  ('admin', 'canvas.version.view_runtime_projection'),
  ('lawyer', 'canvas.version.view'),
  ('lawyer', 'canvas.version.compare'),
  ('lawyer', 'canvas.checkpoint.create'),
  ('lawyer', 'canvas.publish.validate'),
  ('lawyer', 'canvas.version.restore_as_draft'),
  ('security_admin', 'canvas.version.view'),
  ('security_admin', 'canvas.version.compare'),
  ('security_admin', 'canvas.version.download_json'),
  ('security_admin', 'canvas.version.emergency_disable'),
  ('security_admin', 'canvas.version.view_runtime_projection')
on conflict (role_code, permission_code) do nothing;

alter table app.automation_canvas_versions
  add column if not exists version_name text null,
  add column if not exists version_description text null,
  add column if not exists publish_report jsonb not null default '{}'::jsonb,
  add column if not exists runtime_projection_id uuid null,
  add column if not exists superseded_by_version_id uuid null references app.automation_canvas_versions(id) on delete set null,
  add column if not exists archived_at timestamptz null,
  add column if not exists archived_by_user_id uuid null references app.profiles(id) on delete set null;

alter table app.automation_canvas_versions
  drop constraint if exists automation_canvas_versions_status_check;

alter table app.automation_canvas_versions
  add constraint automation_canvas_versions_status_check
  check (status in ('published', 'deprecated', 'restored', 'superseded', 'archived'));

alter table app.automation_canvas_snapshots
  add column if not exists checkpoint_name text null,
  add column if not exists checkpoint_description text null,
  add column if not exists checkpoint_kind text not null default 'auto',
  add column if not exists retention_until timestamptz null,
  add column if not exists is_named boolean not null default false;

alter table app.automation_canvas_snapshots
  drop constraint if exists automation_canvas_snapshots_checkpoint_kind_check;

alter table app.automation_canvas_snapshots
  add constraint automation_canvas_snapshots_checkpoint_kind_check
  check (checkpoint_kind in ('manual', 'auto', 'system', 'publish'));

create table if not exists app.automation_runtime_projections (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  automation_id uuid not null references app.installed_automations(id) on delete cascade,
  automation_version_id uuid not null references app.automation_canvas_versions(id) on delete cascade,
  provider text not null default 'activepieces' check (provider in ('activepieces')),
  projection_json jsonb not null,
  projection_hash text not null,
  compile_report jsonb not null default '{}'::jsonb,
  compile_report_id uuid null references app.automation_compile_reports(id) on delete set null,
  required_pieces jsonb not null default '[]'::jsonb,
  required_connections jsonb not null default '[]'::jsonb,
  pinned_piece_versions jsonb not null default '[]'::jsonb,
  created_by uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (automation_version_id),
  unique (automation_version_id, projection_hash)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'automation_canvas_versions_runtime_projection_id_fkey'
      and conrelid = 'app.automation_canvas_versions'::regclass
  ) then
    alter table app.automation_canvas_versions
      add constraint automation_canvas_versions_runtime_projection_id_fkey
      foreign key (runtime_projection_id)
      references app.automation_runtime_projections(id)
      on delete set null;
  end if;
end $$;

alter table app.automation_runtime_bindings
  add column if not exists runtime_projection_id uuid null references app.automation_runtime_projections(id) on delete set null,
  add column if not exists active boolean not null default true;

create table if not exists app.automation_version_rollbacks (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  automation_id uuid not null references app.installed_automations(id) on delete cascade,
  from_version_id uuid null references app.automation_canvas_versions(id) on delete set null,
  to_version_id uuid null references app.automation_canvas_versions(id) on delete set null,
  rollback_type text not null check (
    rollback_type in ('restore_as_draft', 'publish_previous_version', 'runtime_binding_rollback', 'emergency_disable')
  ),
  reason text not null,
  impact_report jsonb not null default '{}'::jsonb,
  runtime_binding_before jsonb null,
  runtime_binding_after jsonb null,
  idempotency_key text not null,
  actor_user_id uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz null,
  unique (workspace_id, automation_id, idempotency_key)
);

alter table app.installed_automations
  add column if not exists active_canvas_version_id uuid null references app.automation_canvas_versions(id) on delete set null,
  add column if not exists production_disabled_at timestamptz null,
  add column if not exists production_disabled_reason text null,
  add column if not exists production_disabled_by uuid null references app.profiles(id) on delete set null;

alter table app.workflow_runs
  add column if not exists automation_version_id uuid null references app.automation_canvas_versions(id) on delete set null,
  add column if not exists workflow_snapshot_hash text null,
  add column if not exists workflow_snapshot jsonb null,
  add column if not exists runtime_projection_id uuid null references app.automation_runtime_projections(id) on delete set null,
  add column if not exists runtime_projection_snapshot jsonb null;

with latest_versions as (
  select distinct on (v.workspace_id, v.installed_automation_id)
    v.workspace_id,
    v.installed_automation_id,
    v.id
  from app.automation_canvas_versions v
  where v.status in ('published', 'restored')
  order by v.workspace_id, v.installed_automation_id, v.version_no desc
)
update app.installed_automations ia
set active_canvas_version_id = latest_versions.id
from latest_versions
where ia.active_canvas_version_id is null
  and latest_versions.workspace_id = ia.workspace_id
  and latest_versions.installed_automation_id = ia.id;

alter table app.installed_automations
  drop constraint if exists installed_automations_workflow_state_check,
  drop constraint if exists app_installed_automations_workflow_state_check,
  drop constraint if exists installed_automations_sync_state_check,
  drop constraint if exists app_installed_automations_sync_state_check;

alter table app.installed_automations
  add constraint installed_automations_workflow_state_check
  check (workflow_state in ('draft', 'published', 'compiled', 'execution_ready')),
  add constraint installed_automations_sync_state_check
  check (sync_state in ('not_requested', 'pending', 'synced', 'failed', 'disabled'));

create or replace function app.enforce_canvas_version_immutability()
returns trigger
language plpgsql
as $$
begin
  if old.status in ('published', 'restored', 'superseded')
     or old.published_at is not null then
    if old.workflow is distinct from new.workflow
       or old.normalized_canvas is distinct from new.normalized_canvas
       or old.workflow_hash is distinct from new.workflow_hash
       or old.validation_result_id is distinct from new.validation_result_id
       or old.publish_report is distinct from new.publish_report then
      raise exception 'Published Canvas versions are immutable'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_canvas_version_immutability on app.automation_canvas_versions;
create trigger trg_canvas_version_immutability
before update on app.automation_canvas_versions
for each row execute function app.enforce_canvas_version_immutability();

create index if not exists idx_canvas_versions_active
  on app.automation_canvas_versions (workspace_id, installed_automation_id, status, version_no desc);

create index if not exists idx_canvas_versions_runtime_projection
  on app.automation_canvas_versions (runtime_projection_id)
  where runtime_projection_id is not null;

create index if not exists idx_canvas_snapshots_checkpoint
  on app.automation_canvas_snapshots (workspace_id, installed_automation_id, is_named, created_at desc);

create index if not exists idx_runtime_projections_automation
  on app.automation_runtime_projections (workspace_id, automation_id, created_at desc);

create index if not exists idx_runtime_bindings_projection
  on app.automation_runtime_bindings (workspace_id, installed_automation_id, automation_version_id, runtime_projection_id)
  where active = true;

create index if not exists idx_version_rollbacks_automation
  on app.automation_version_rollbacks (workspace_id, automation_id, created_at desc);

create index if not exists idx_workflow_runs_version
  on app.workflow_runs (workspace_id, installed_automation_id, automation_version_id, created_at desc);

alter table app.automation_runtime_projections enable row level security;
alter table app.automation_version_rollbacks enable row level security;

drop policy if exists automation_runtime_projections_select_viewer on app.automation_runtime_projections;
create policy automation_runtime_projections_select_viewer
  on app.automation_runtime_projections
  for select
  to authenticated
  using (
    public.has_workspace_permission(workspace_id, 'canvas.version.view_runtime_projection')
    or public.has_workspace_permission(workspace_id, 'canvas.runtime.view')
  );

drop policy if exists automation_runtime_projections_manage_publisher on app.automation_runtime_projections;
create policy automation_runtime_projections_manage_publisher
  on app.automation_runtime_projections
  for insert
  to authenticated
  with check (
    public.has_workspace_permission(workspace_id, 'canvas.publish')
    or public.has_workspace_permission(workspace_id, 'canvas.version.rollback')
  );

drop policy if exists automation_version_rollbacks_select_viewer on app.automation_version_rollbacks;
create policy automation_version_rollbacks_select_viewer
  on app.automation_version_rollbacks
  for select
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'canvas.version.view'));

drop policy if exists automation_version_rollbacks_manage_admin on app.automation_version_rollbacks;
create policy automation_version_rollbacks_manage_admin
  on app.automation_version_rollbacks
  for insert
  to authenticated
  with check (
    public.has_workspace_permission(workspace_id, 'canvas.version.rollback')
    or public.has_workspace_permission(workspace_id, 'canvas.runtime.rollback')
    or public.has_workspace_permission(workspace_id, 'canvas.version.emergency_disable')
  );

grant select, insert on app.automation_runtime_projections to authenticated;
grant select, insert on app.automation_version_rollbacks to authenticated;
