alter table app.automation_canvas_operations drop constraint if exists automation_canvas_operations_operation_type_check;
alter table app.automation_canvas_operations
  add constraint automation_canvas_operations_operation_type_check
  check (
    operation_type in (
      'ADD_NODE_FROM_MODULE',
      'ADD_NODE',
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
      'UNPIN_SAMPLE_DATA'
    )
  );

alter table app.legal_modules drop constraint if exists legal_modules_risk_level_check;
alter table app.legal_modules
  add constraint legal_modules_risk_level_check
  check (risk_level in ('low', 'medium', 'high', 'critical'));

alter table app.legal_modules drop constraint if exists legal_modules_current_status_check;
alter table app.legal_modules
  add constraint legal_modules_current_status_check
  check (current_status in ('draft', 'published', 'deprecated', 'retired'));

alter table app.legal_module_versions drop constraint if exists legal_module_versions_status_check;
alter table app.legal_module_versions
  add constraint legal_module_versions_status_check
  check (status in ('draft', 'published', 'deprecated', 'retired'));

create table if not exists app.canvas_module_favorites (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  actor_id uuid not null references app.profiles(id) on delete cascade,
  module_code text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, actor_id, module_code)
);

create table if not exists app.canvas_module_recent (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  actor_id uuid not null references app.profiles(id) on delete cascade,
  module_code text not null,
  used_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, actor_id, module_code)
);

create table if not exists app.canvas_module_team_presets (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  code text not null,
  label text not null,
  source_module_code text null,
  recommended_module_codes text[] not null default '{}'::text[],
  enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, code)
);

create index if not exists idx_app_canvas_module_recent_lookup
  on app.canvas_module_recent (workspace_id, actor_id, used_at desc);

create index if not exists idx_app_canvas_module_team_presets_lookup
  on app.canvas_module_team_presets (workspace_id, enabled);

alter table app.canvas_module_favorites enable row level security;
alter table app.canvas_module_recent enable row level security;
alter table app.canvas_module_team_presets enable row level security;

drop policy if exists canvas_module_favorites_select_viewer on app.canvas_module_favorites;
create policy canvas_module_favorites_select_viewer
  on app.canvas_module_favorites
  for select
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'canvas.view'));

drop policy if exists canvas_module_favorites_manage_editor on app.canvas_module_favorites;
create policy canvas_module_favorites_manage_editor
  on app.canvas_module_favorites
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'canvas.edit'))
  with check (public.has_workspace_permission(workspace_id, 'canvas.edit'));

drop policy if exists canvas_module_recent_select_viewer on app.canvas_module_recent;
create policy canvas_module_recent_select_viewer
  on app.canvas_module_recent
  for select
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'canvas.view'));

drop policy if exists canvas_module_recent_manage_editor on app.canvas_module_recent;
create policy canvas_module_recent_manage_editor
  on app.canvas_module_recent
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'canvas.edit'))
  with check (public.has_workspace_permission(workspace_id, 'canvas.edit'));

drop policy if exists canvas_module_team_presets_select_viewer on app.canvas_module_team_presets;
create policy canvas_module_team_presets_select_viewer
  on app.canvas_module_team_presets
  for select
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'canvas.view'));

drop policy if exists canvas_module_team_presets_manage_editor on app.canvas_module_team_presets;
create policy canvas_module_team_presets_manage_editor
  on app.canvas_module_team_presets
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'canvas.edit'))
  with check (public.has_workspace_permission(workspace_id, 'canvas.edit'));

grant select, insert, update, delete on app.canvas_module_favorites to authenticated;
grant select, insert, update, delete on app.canvas_module_recent to authenticated;
grant select, insert, update, delete on app.canvas_module_team_presets to authenticated;
