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
  ('canvas.test.validate', 'Validate Canvas test run', 'Run validation-only checks for Canvas drafts.', 'canvas', false),
  ('canvas.test.step', 'Test Canvas step', 'Run step-level Canvas tests in the draft/test namespace.', 'canvas', false),
  ('canvas.test.branch', 'Test Canvas branch', 'Run condition branch checks in the Canvas draft/test namespace.', 'canvas', false),
  ('canvas.test.loop', 'Test Canvas loop', 'Run bounded loop sample checks in the Canvas draft/test namespace.', 'canvas', false),
  ('canvas.test.dry_run', 'Dry-run Canvas workflow', 'Run production-like Canvas dry-runs without production side effects.', 'canvas', true),
  ('canvas.test.cancel', 'Cancel Canvas test run', 'Cancel in-progress Canvas test or dry-run executions.', 'canvas', false),
  ('canvas.test.view_history', 'View Canvas test history', 'View Canvas test run history and traces.', 'canvas', false),
  ('canvas.test.view_redacted', 'View redacted Canvas test data', 'View redacted Canvas test inputs and outputs.', 'canvas', false),
  ('canvas.test.view_raw_data', 'View raw Canvas test data', 'View raw Canvas test input/output payloads when workspace policy allows it.', 'canvas', true),
  ('canvas.test.pin_data', 'Pin Canvas test data', 'Pin step outputs for draft-only Canvas testing.', 'canvas', false),
  ('canvas.test.create_fixture', 'Create Canvas test fixtures', 'Create test fixtures for Canvas dry-runs and step tests.', 'canvas', false),
  ('canvas.test.edit_fixture', 'Edit Canvas test fixtures', 'Edit Canvas test fixtures for draft/test execution.', 'canvas', false),
  ('canvas.test.use_real_ai', 'Use real AI in Canvas tests', 'Allow AI gateway test routes during Canvas test execution.', 'canvas', true),
  ('canvas.test.use_real_documents', 'Use real documents in Canvas tests', 'Allow permitted document reads during Canvas test execution.', 'canvas', true)
on conflict (code) do update
set
  label = excluded.label,
  description = excluded.description,
  scope = excluded.scope,
  high_risk = excluded.high_risk;

insert into app.role_permissions (role_code, permission_code)
select role_code::workspace_role, permission_code
from (
  values
    ('owner', 'canvas.test.validate'),
    ('owner', 'canvas.test.step'),
    ('owner', 'canvas.test.branch'),
    ('owner', 'canvas.test.loop'),
    ('owner', 'canvas.test.dry_run'),
    ('owner', 'canvas.test.cancel'),
    ('owner', 'canvas.test.view_history'),
    ('owner', 'canvas.test.view_redacted'),
    ('owner', 'canvas.test.view_raw_data'),
    ('owner', 'canvas.test.pin_data'),
    ('owner', 'canvas.test.create_fixture'),
    ('owner', 'canvas.test.edit_fixture'),
    ('owner', 'canvas.test.use_real_ai'),
    ('owner', 'canvas.test.use_real_documents'),
    ('admin', 'canvas.test.validate'),
    ('admin', 'canvas.test.step'),
    ('admin', 'canvas.test.branch'),
    ('admin', 'canvas.test.loop'),
    ('admin', 'canvas.test.dry_run'),
    ('admin', 'canvas.test.cancel'),
    ('admin', 'canvas.test.view_history'),
    ('admin', 'canvas.test.view_redacted'),
    ('admin', 'canvas.test.view_raw_data'),
    ('admin', 'canvas.test.pin_data'),
    ('admin', 'canvas.test.create_fixture'),
    ('admin', 'canvas.test.edit_fixture'),
    ('admin', 'canvas.test.use_real_ai'),
    ('admin', 'canvas.test.use_real_documents'),
    ('lawyer', 'canvas.test.validate'),
    ('lawyer', 'canvas.test.step'),
    ('lawyer', 'canvas.test.branch'),
    ('lawyer', 'canvas.test.loop'),
    ('lawyer', 'canvas.test.dry_run'),
    ('lawyer', 'canvas.test.cancel'),
    ('lawyer', 'canvas.test.view_history'),
    ('lawyer', 'canvas.test.view_redacted'),
    ('lawyer', 'canvas.test.pin_data'),
    ('lawyer', 'canvas.test.create_fixture'),
    ('lawyer', 'canvas.test.edit_fixture'),
    ('lawyer', 'canvas.test.use_real_documents'),
    ('viewer', 'canvas.test.view_history'),
    ('viewer', 'canvas.test.view_redacted')
) as grants(role_code, permission_code)
on conflict (role_code, permission_code) do nothing;

alter table app.automation_canvas_sample_data
  add column if not exists payload_hash text null,
  add column if not exists schema_version text not null default '1',
  add column if not exists expires_at timestamptz null,
  add column if not exists retention_until timestamptz null,
  add column if not exists is_active boolean not null default true,
  add column if not exists encrypted_payload_ref uuid null;

alter table app.automation_canvas_sample_data
  drop constraint if exists automation_canvas_sample_data_source_check;
alter table app.automation_canvas_sample_data
  add constraint automation_canvas_sample_data_source_check
  check (
    source in (
      'mock',
      'test_run',
      'pinned',
      'manual',
      'schema_generated',
      'manual_fixture',
      'previous_test_run_output',
      'previous_production_run_redacted',
      'module_example',
      'pinned_node_output',
      'uploaded_test_document'
    )
  );

update app.automation_canvas_sample_data
set
  payload_hash = coalesce(payload_hash, md5(coalesce(redacted_payload, preview_payload, '{}'::jsonb)::text)),
  retention_until = coalesce(retention_until, created_at + interval '30 days')
where payload_hash is null
   or retention_until is null;

alter table app.automation_canvas_sample_data
  alter column payload_hash set not null,
  alter column retention_until set not null;

alter table app.automation_canvas_pinned_data
  add column if not exists output_schema_version text not null default '1',
  add column if not exists output_hash text null,
  add column if not exists classification text not null default 'internal',
  add column if not exists expires_at timestamptz null,
  add column if not exists is_active boolean not null default true,
  add column if not exists encrypted_payload_ref uuid null;

update app.automation_canvas_pinned_data pd
set
  output_hash = coalesce(pd.output_hash, sd.payload_hash),
  classification = coalesce(nullif(pd.classification, 'internal'), sd.classification, 'internal')
from app.automation_canvas_sample_data sd
where pd.pinned_sample_data_id = sd.id
  and (pd.output_hash is null or pd.classification = 'internal');

alter table app.automation_canvas_pinned_data
  alter column output_hash set not null;

create table if not exists app.automation_canvas_test_runs (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  installed_automation_id uuid not null references app.installed_automations(id) on delete cascade,
  draft_version_id uuid not null references app.automation_canvas_drafts(id) on delete cascade,
  actor_user_id uuid not null references app.profiles(id) on delete restrict,
  test_mode text not null check (
    test_mode in (
      'validation_only',
      'test_selected_step',
      'test_until_selected_step',
      'test_branch',
      'test_loop_sample',
      'test_subworkflow_contract',
      'dry_run_full',
      'replay_from_previous_run'
    )
  ),
  target_node_id text null,
  target_branch_id text null,
  status text not null default 'created' check (
    status in (
      'created',
      'validating',
      'running',
      'succeeded',
      'failed',
      'cancelled',
      'blocked_by_policy',
      'expired'
    )
  ),
  validation_status text not null default 'invalid',
  validation_result jsonb not null default '{}'::jsonb,
  input_fixture_id uuid null,
  uses_pinned_data boolean not null default false,
  dry_run_policy jsonb not null default '{}'::jsonb,
  redaction_policy jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz null,
  duration_ms integer null,
  error_code text null,
  error_message text null,
  trace_id text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.automation_canvas_test_run_steps (
  id uuid primary key default public.app_uuid_v7(),
  test_run_id uuid not null references app.automation_canvas_test_runs(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  node_id text not null,
  display_name text not null,
  module_code text null,
  status text not null check (
    status in (
      'not_started',
      'running',
      'succeeded',
      'failed',
      'skipped',
      'simulated',
      'blocked_by_policy',
      'redacted'
    )
  ),
  started_at timestamptz null,
  finished_at timestamptz null,
  duration_ms integer null,
  input_summary jsonb null,
  output_summary jsonb null,
  input_redacted boolean not null default true,
  output_redacted boolean not null default true,
  input_blob_ref uuid null,
  output_blob_ref uuid null,
  error_code text null,
  error_message text null,
  debug_error jsonb null,
  diagnostic jsonb null,
  position integer not null default 0
);

create table if not exists app.automation_canvas_test_data_blobs (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  test_run_id uuid not null references app.automation_canvas_test_runs(id) on delete cascade,
  node_id text not null,
  blob_type text not null check (blob_type in ('input', 'output', 'log', 'artifact_preview')),
  classification text not null,
  encrypted_payload bytea null,
  payload_hash text not null,
  redacted_payload jsonb null,
  retention_until timestamptz not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.automation_canvas_test_fixtures (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  installed_automation_id uuid not null references app.installed_automations(id) on delete cascade,
  name text not null,
  description text null,
  fixture_type text not null check (fixture_type in ('workflow_input', 'node_input', 'branch_case', 'loop_items')),
  payload_schema_version text not null,
  payload jsonb not null,
  classification text not null,
  created_by uuid not null references app.profiles(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_canvas_test_runs_lookup
  on app.automation_canvas_test_runs (workspace_id, installed_automation_id, created_at desc);

create index if not exists idx_canvas_test_run_steps_lookup
  on app.automation_canvas_test_run_steps (test_run_id, position asc);

create index if not exists idx_canvas_test_data_blobs_lookup
  on app.automation_canvas_test_data_blobs (workspace_id, test_run_id, created_at desc);

create index if not exists idx_canvas_test_fixtures_lookup
  on app.automation_canvas_test_fixtures (workspace_id, installed_automation_id, created_at desc);

create index if not exists idx_canvas_pinned_data_active
  on app.automation_canvas_pinned_data (workspace_id, installed_automation_id, draft_version_id, node_id, output_key)
  where is_active;

alter table app.automation_canvas_test_runs enable row level security;
alter table app.automation_canvas_test_run_steps enable row level security;
alter table app.automation_canvas_test_data_blobs enable row level security;
alter table app.automation_canvas_test_fixtures enable row level security;

drop policy if exists automation_canvas_test_runs_select_history on app.automation_canvas_test_runs;
create policy automation_canvas_test_runs_select_history
  on app.automation_canvas_test_runs
  for select
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'canvas.test.view_history'));

drop policy if exists automation_canvas_test_runs_insert_runner on app.automation_canvas_test_runs;
create policy automation_canvas_test_runs_insert_runner
  on app.automation_canvas_test_runs
  for insert
  to authenticated
  with check (
    public.has_workspace_permission(workspace_id, 'canvas.test.validate')
    or public.has_workspace_permission(workspace_id, 'canvas.test.step')
    or public.has_workspace_permission(workspace_id, 'canvas.test.dry_run')
  );

drop policy if exists automation_canvas_test_runs_update_runner on app.automation_canvas_test_runs;
create policy automation_canvas_test_runs_update_runner
  on app.automation_canvas_test_runs
  for update
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'canvas.test.cancel'))
  with check (public.has_workspace_permission(workspace_id, 'canvas.test.cancel'));

drop policy if exists automation_canvas_test_run_steps_select_history on app.automation_canvas_test_run_steps;
create policy automation_canvas_test_run_steps_select_history
  on app.automation_canvas_test_run_steps
  for select
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'canvas.test.view_history'));

drop policy if exists automation_canvas_test_run_steps_insert_runner on app.automation_canvas_test_run_steps;
create policy automation_canvas_test_run_steps_insert_runner
  on app.automation_canvas_test_run_steps
  for insert
  to authenticated
  with check (public.has_workspace_permission(workspace_id, 'canvas.test.step'));

drop policy if exists automation_canvas_test_data_blobs_select_redacted on app.automation_canvas_test_data_blobs;
create policy automation_canvas_test_data_blobs_select_redacted
  on app.automation_canvas_test_data_blobs
  for select
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'canvas.test.view_redacted'));

drop policy if exists automation_canvas_test_data_blobs_insert_runner on app.automation_canvas_test_data_blobs;
create policy automation_canvas_test_data_blobs_insert_runner
  on app.automation_canvas_test_data_blobs
  for insert
  to authenticated
  with check (public.has_workspace_permission(workspace_id, 'canvas.test.step'));

drop policy if exists automation_canvas_test_fixtures_select_history on app.automation_canvas_test_fixtures;
create policy automation_canvas_test_fixtures_select_history
  on app.automation_canvas_test_fixtures
  for select
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'canvas.test.view_history'));

drop policy if exists automation_canvas_test_fixtures_manage_editor on app.automation_canvas_test_fixtures;
create policy automation_canvas_test_fixtures_manage_editor
  on app.automation_canvas_test_fixtures
  for all
  to authenticated
  using (
    public.has_workspace_permission(workspace_id, 'canvas.test.create_fixture')
    or public.has_workspace_permission(workspace_id, 'canvas.test.edit_fixture')
  )
  with check (
    public.has_workspace_permission(workspace_id, 'canvas.test.create_fixture')
    or public.has_workspace_permission(workspace_id, 'canvas.test.edit_fixture')
  );

grant select, insert, update on app.automation_canvas_test_runs to authenticated;
grant select, insert on app.automation_canvas_test_run_steps to authenticated;
grant select, insert on app.automation_canvas_test_data_blobs to authenticated;
grant select, insert, update, delete on app.automation_canvas_test_fixtures to authenticated;
