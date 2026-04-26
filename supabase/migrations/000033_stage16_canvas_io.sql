alter table app.automation_canvas_operations drop constraint if exists automation_canvas_operations_operation_type_check;
alter table app.automation_canvas_operations
  add constraint automation_canvas_operations_operation_type_check
  check (
    operation_type in (
      'ADD_NODE',
      'UPDATE_NODE',
      'MOVE_NODE',
      'DELETE_NODE',
      'ADD_EDGE',
      'DELETE_EDGE',
      'UPDATE_EDGE',
      'UPDATE_NODE_CONFIG',
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

create table if not exists app.automation_canvas_binding_events (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  installed_automation_id uuid not null references app.installed_automations(id) on delete cascade,
  draft_version_id uuid not null references app.automation_canvas_drafts(id) on delete cascade,
  operation_id uuid null,
  node_id text null,
  input_key text null,
  binding_id text not null,
  event_type text not null,
  source_summary jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  validation_state text null check (
    validation_state in ('valid', 'warning', 'invalid', 'stale', 'policy_blocked')
  ),
  actor_id uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_app_canvas_binding_events_lookup
  on app.automation_canvas_binding_events (workspace_id, installed_automation_id, created_at desc);

create table if not exists app.automation_canvas_sample_data (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  installed_automation_id uuid not null references app.installed_automations(id) on delete cascade,
  draft_version_id uuid not null references app.automation_canvas_drafts(id) on delete cascade,
  node_id text not null,
  output_key text not null,
  data_type text not null,
  classification text not null,
  preview_payload jsonb null,
  redacted_payload jsonb null,
  raw_payload_ref text null,
  source text not null check (source in ('mock', 'test_run', 'pinned', 'manual')),
  created_by uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_app_canvas_sample_data_lookup
  on app.automation_canvas_sample_data (
    workspace_id,
    installed_automation_id,
    draft_version_id,
    node_id,
    output_key,
    created_at desc
  );

create table if not exists app.automation_canvas_pinned_data (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  installed_automation_id uuid not null references app.installed_automations(id) on delete cascade,
  draft_version_id uuid not null references app.automation_canvas_drafts(id) on delete cascade,
  node_id text not null,
  output_key text not null,
  pinned_sample_data_id uuid not null references app.automation_canvas_sample_data(id) on delete cascade,
  pinned_by uuid null references app.profiles(id) on delete set null,
  pinned_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, installed_automation_id, draft_version_id, node_id, output_key)
);

create index if not exists idx_app_canvas_pinned_data_lookup
  on app.automation_canvas_pinned_data (
    workspace_id,
    installed_automation_id,
    draft_version_id,
    node_id,
    output_key
  );

alter table app.automation_canvas_binding_events enable row level security;
alter table app.automation_canvas_sample_data enable row level security;
alter table app.automation_canvas_pinned_data enable row level security;

create policy automation_canvas_binding_events_select_viewer
  on app.automation_canvas_binding_events
  for select
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'canvas.view'));

create policy automation_canvas_binding_events_insert_editor
  on app.automation_canvas_binding_events
  for insert
  to authenticated
  with check (public.has_workspace_permission(workspace_id, 'canvas.edit'));

create policy automation_canvas_sample_data_select_viewer
  on app.automation_canvas_sample_data
  for select
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'canvas.view'));

create policy automation_canvas_sample_data_manage_editor
  on app.automation_canvas_sample_data
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'canvas.edit'))
  with check (public.has_workspace_permission(workspace_id, 'canvas.edit'));

create policy automation_canvas_pinned_data_select_viewer
  on app.automation_canvas_pinned_data
  for select
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'canvas.view'));

create policy automation_canvas_pinned_data_manage_editor
  on app.automation_canvas_pinned_data
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'canvas.edit'))
  with check (public.has_workspace_permission(workspace_id, 'canvas.edit'));

grant select, insert on app.automation_canvas_binding_events to authenticated;
grant select, insert, update, delete on app.automation_canvas_sample_data to authenticated;
grant select, insert, update, delete on app.automation_canvas_pinned_data to authenticated;
