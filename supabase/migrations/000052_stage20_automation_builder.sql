-- Stage 20: AI Automation Builder
-- LexFrame product DB remains the source of truth for intents, blueprints,
-- planner evidence, Canvas draft lineage and runtime draft attempts.

insert into app.permissions (code, label, description, scope, high_risk)
values
  ('automation_builder.view', 'View automation builder', 'View automation builder sessions, intents and blueprints.', 'automation', false),
  ('automation_builder.create_intent', 'Create automation intent', 'Create AutomationIntent records from chat or builder page.', 'automation', false),
  ('automation_builder.plan', 'Plan automation blueprint', 'Invoke backend-owned automation planner route.', 'automation', true),
  ('automation_builder.answer_clarification', 'Answer automation clarification', 'Answer persisted planner clarification questions.', 'automation', false),
  ('automation_builder.validate', 'Validate automation blueprint', 'Run backend validation and safety gates for AutomationBlueprint.', 'automation', false),
  ('automation_builder.approve_blueprint', 'Approve automation blueprint', 'Human approval for blueprint conversion.', 'automation', true),
  ('automation_builder.reject_blueprint', 'Reject automation blueprint', 'Reject a generated AutomationBlueprint.', 'automation', false),
  ('automation_builder.convert_to_canvas_draft', 'Convert blueprint to Canvas draft', 'Create LexFrame Workflow DSL/Canvas draft from an approved blueprint.', 'automation', true),
  ('automation_builder.create_runtime_draft', 'Create runtime draft', 'Create backend-controlled runtime draft projection.', 'automation', true),
  ('automation_builder.view_route_snapshot', 'View planner route snapshot', 'View safe route/provider/model diagnostics.', 'automation', true),
  ('automation_builder.view_raw_diagnostics', 'View raw planner diagnostics', 'View redacted advanced planner diagnostics.', 'automation', true),
  ('automation_builder.export', 'Export automation blueprint', 'Export redacted AutomationBlueprint.', 'automation', true),
  ('automation_builder.manage_prompt_templates', 'Manage planner prompt templates', 'Manage backend-approved planner prompt templates.', 'automation', true),
  ('automation_builder.use_legal_secret_context', 'Use legal-secret planner context', 'Use legal-secret references only through approved planner policy.', 'automation', true)
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
    ('owner', 'automation_builder.view'),
    ('owner', 'automation_builder.create_intent'),
    ('owner', 'automation_builder.plan'),
    ('owner', 'automation_builder.answer_clarification'),
    ('owner', 'automation_builder.validate'),
    ('owner', 'automation_builder.approve_blueprint'),
    ('owner', 'automation_builder.reject_blueprint'),
    ('owner', 'automation_builder.convert_to_canvas_draft'),
    ('owner', 'automation_builder.create_runtime_draft'),
    ('owner', 'automation_builder.view_route_snapshot'),
    ('owner', 'automation_builder.view_raw_diagnostics'),
    ('owner', 'automation_builder.export'),
    ('owner', 'automation_builder.manage_prompt_templates'),
    ('owner', 'automation_builder.use_legal_secret_context'),
    ('admin', 'automation_builder.view'),
    ('admin', 'automation_builder.create_intent'),
    ('admin', 'automation_builder.plan'),
    ('admin', 'automation_builder.answer_clarification'),
    ('admin', 'automation_builder.validate'),
    ('admin', 'automation_builder.approve_blueprint'),
    ('admin', 'automation_builder.reject_blueprint'),
    ('admin', 'automation_builder.convert_to_canvas_draft'),
    ('admin', 'automation_builder.create_runtime_draft'),
    ('admin', 'automation_builder.view_route_snapshot'),
    ('admin', 'automation_builder.export'),
    ('lawyer', 'automation_builder.view'),
    ('lawyer', 'automation_builder.create_intent'),
    ('lawyer', 'automation_builder.plan'),
    ('lawyer', 'automation_builder.answer_clarification'),
    ('lawyer', 'automation_builder.validate'),
    ('lawyer', 'automation_builder.approve_blueprint'),
    ('lawyer', 'automation_builder.reject_blueprint'),
    ('lawyer', 'automation_builder.convert_to_canvas_draft'),
    ('lawyer', 'automation_builder.export'),
    ('assistant', 'automation_builder.view'),
    ('assistant', 'automation_builder.create_intent'),
    ('assistant', 'automation_builder.answer_clarification'),
    ('assistant', 'automation_builder.validate'),
    ('viewer', 'automation_builder.view')
) as grants(role_code, permission_code)
on conflict (role_code, permission_code) do nothing;

create table if not exists app.automation_builder_sessions (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  project_id text null,
  source_thread_id uuid null references app.chat_threads(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'archived')),
  title text not null,
  created_by uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz null
);

create table if not exists app.automation_intents (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  project_id text null,
  builder_session_id uuid null references app.automation_builder_sessions(id) on delete set null,
  source text not null check (source in ('project_chat_action', 'automation_builder_page', 'canvas_ai_assistant', 'recommendation', 'template_remix', 'manual')),
  source_thread_id uuid null references app.chat_threads(id) on delete set null,
  source_message_id uuid null references app.chat_messages(id) on delete set null,
  title text null,
  user_goal text not null,
  status text not null check (status in ('created', 'context_collecting', 'needs_clarification', 'planning', 'blueprint_ready', 'blueprint_invalid', 'user_rejected', 'user_approved', 'draft_created', 'runtime_creation_pending', 'runtime_created', 'failed', 'cancelled')),
  classification text not null check (classification in ('public', 'internal', 'workspace_internal', 'confidential', 'client_material', 'legal_secret', 'personal_data')),
  created_by uuid null references app.profiles(id) on delete set null,
  updated_by uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  cancelled_at timestamptz null
);

create table if not exists app.automation_intent_sources (
  id uuid primary key default public.app_uuid_v7(),
  intent_id uuid not null references app.automation_intents(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  source_type text not null,
  source_id text not null,
  source_hash text null,
  classification text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.automation_blueprints (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  project_id text null,
  intent_id uuid not null references app.automation_intents(id) on delete cascade,
  current_version_id uuid null,
  title text not null,
  summary text not null,
  status text not null check (status in ('draft', 'schema_valid', 'needs_clarification', 'policy_blocked', 'validation_failed', 'preview_ready', 'approved', 'converted_to_canvas_draft', 'runtime_projection_created', 'archived')),
  created_by uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.automation_blueprint_versions (
  id uuid primary key default public.app_uuid_v7(),
  blueprint_id uuid not null references app.automation_blueprints(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  intent_id uuid not null references app.automation_intents(id) on delete cascade,
  version text not null,
  status text not null,
  blueprint jsonb not null,
  blueprint_hash text not null,
  route_snapshot jsonb not null default '{}'::jsonb,
  validation_summary jsonb not null default '{}'::jsonb,
  immutable_after_approval boolean not null default false,
  created_by uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (blueprint_id, version)
);

alter table app.automation_blueprints
  drop constraint if exists automation_blueprints_current_version_id_fkey;
alter table app.automation_blueprints
  add constraint automation_blueprints_current_version_id_fkey
  foreign key (current_version_id) references app.automation_blueprint_versions(id) on delete set null;

create table if not exists app.automation_blueprint_steps (
  id uuid primary key default public.app_uuid_v7(),
  blueprint_version_id uuid not null references app.automation_blueprint_versions(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  step_id text not null,
  kind text not null,
  module_code text null,
  module_version text null,
  title text not null,
  policy jsonb not null default '{}'::jsonb,
  runtime_mapping jsonb not null default '{}'::jsonb,
  config_redacted jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (blueprint_version_id, step_id)
);

create table if not exists app.automation_blueprint_edges (
  id uuid primary key default public.app_uuid_v7(),
  blueprint_version_id uuid not null references app.automation_blueprint_versions(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  edge_id text not null,
  source_step_id text not null,
  target_step_id text not null,
  kind text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (blueprint_version_id, edge_id)
);

create table if not exists app.automation_blueprint_inputs (
  id uuid primary key default public.app_uuid_v7(),
  blueprint_version_id uuid not null references app.automation_blueprint_versions(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  input_key text not null,
  label text not null,
  input_type text not null,
  classification text not null,
  required boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.automation_blueprint_outputs (
  id uuid primary key default public.app_uuid_v7(),
  blueprint_version_id uuid not null references app.automation_blueprint_versions(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  output_key text not null,
  label text not null,
  output_type text not null,
  classification text not null,
  required boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.automation_blueprint_context_items (
  id uuid primary key default public.app_uuid_v7(),
  blueprint_version_id uuid null references app.automation_blueprint_versions(id) on delete cascade,
  intent_id uuid not null references app.automation_intents(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  project_id text null,
  source_type text not null,
  source_id text not null,
  source_hash text null,
  classification text not null,
  selected_mode text not null,
  policy_decision text not null,
  blocked boolean not null default false,
  reason_code text null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.automation_blueprint_clarifications (
  id uuid primary key default public.app_uuid_v7(),
  intent_id uuid not null references app.automation_intents(id) on delete cascade,
  blueprint_id uuid null references app.automation_blueprints(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  kind text not null,
  question text not null,
  choices jsonb not null default '[]'::jsonb,
  required boolean not null default true,
  answer_type text not null,
  status text not null default 'open' check (status in ('open', 'answered', 'cancelled')),
  answer jsonb null,
  answered_by uuid null references app.profiles(id) on delete set null,
  answered_at timestamptz null,
  policy_context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.automation_blueprint_validations (
  id uuid primary key default public.app_uuid_v7(),
  blueprint_version_id uuid not null references app.automation_blueprint_versions(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  status text not null,
  errors jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  policy_blocks jsonb not null default '[]'::jsonb,
  created_by uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.automation_blueprint_compile_previews (
  id uuid primary key default public.app_uuid_v7(),
  blueprint_version_id uuid not null references app.automation_blueprint_versions(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  status text not null,
  workflow_hash text null,
  preview jsonb not null default '{}'::jsonb,
  created_by uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.automation_blueprint_approvals (
  id uuid primary key default public.app_uuid_v7(),
  blueprint_version_id uuid not null references app.automation_blueprint_versions(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  decision text not null check (decision in ('approved', 'rejected')),
  reason text null,
  created_by uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.automation_planner_runs (
  id uuid primary key default public.app_uuid_v7(),
  intent_id uuid not null references app.automation_intents(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  status text not null check (status in ('queued', 'running', 'completed', 'schema_failed', 'policy_blocked', 'needs_clarification', 'failed', 'cancelled')),
  route_code text not null default 'automation_planner_high',
  route_snapshot jsonb not null default '{}'::jsonb,
  prompt_hash text null,
  output_hash text null,
  error_code text null,
  created_by uuid null references app.profiles(id) on delete set null,
  started_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.automation_planner_events (
  id uuid primary key default public.app_uuid_v7(),
  planner_run_id uuid not null references app.automation_planner_runs(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  intent_id uuid not null references app.automation_intents(id) on delete cascade,
  event_type text not null,
  payload_redacted jsonb not null default '{}'::jsonb,
  sequence integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.automation_runtime_creation_jobs (
  id uuid primary key default public.app_uuid_v7(),
  blueprint_version_id uuid not null references app.automation_blueprint_versions(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  automation_id uuid null,
  status text not null check (status in ('pending', 'created', 'blocked', 'failed', 'not_configured')),
  runtime_target text not null,
  activepieces_project_id text null,
  activepieces_flow_id text null,
  activepieces_version_id text null,
  evidence_hash text null,
  error_code text null,
  created_by uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.automation_mcp_invocations (
  id uuid primary key default public.app_uuid_v7(),
  runtime_creation_job_id uuid null references app.automation_runtime_creation_jobs(id) on delete set null,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  project_id text null,
  actor_user_id uuid null references app.profiles(id) on delete set null,
  server_ref text null,
  tool_name text not null,
  status text not null check (status in ('blocked', 'started', 'completed', 'failed', 'not_configured')),
  request_hash text null,
  response_hash text null,
  trace_id text null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.automation_builder_artifacts (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  intent_id uuid null references app.automation_intents(id) on delete cascade,
  blueprint_id uuid null references app.automation_blueprints(id) on delete cascade,
  artifact_type text not null,
  status text not null default 'created',
  payload_redacted jsonb not null default '{}'::jsonb,
  content_hash text null,
  created_by uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_automation_intents_workspace_project
  on app.automation_intents (workspace_id, project_id, status, updated_at desc);
create index if not exists idx_automation_blueprints_intent
  on app.automation_blueprints (workspace_id, intent_id, status, updated_at desc);
create index if not exists idx_automation_blueprint_versions_blueprint
  on app.automation_blueprint_versions (blueprint_id, created_at desc);
create index if not exists idx_automation_planner_events_run
  on app.automation_planner_events (planner_run_id, sequence);

alter table app.automation_builder_sessions enable row level security;
alter table app.automation_intents enable row level security;
alter table app.automation_intent_sources enable row level security;
alter table app.automation_blueprints enable row level security;
alter table app.automation_blueprint_versions enable row level security;
alter table app.automation_blueprint_steps enable row level security;
alter table app.automation_blueprint_edges enable row level security;
alter table app.automation_blueprint_inputs enable row level security;
alter table app.automation_blueprint_outputs enable row level security;
alter table app.automation_blueprint_context_items enable row level security;
alter table app.automation_blueprint_clarifications enable row level security;
alter table app.automation_blueprint_validations enable row level security;
alter table app.automation_blueprint_compile_previews enable row level security;
alter table app.automation_blueprint_approvals enable row level security;
alter table app.automation_planner_runs enable row level security;
alter table app.automation_planner_events enable row level security;
alter table app.automation_runtime_creation_jobs enable row level security;
alter table app.automation_mcp_invocations enable row level security;
alter table app.automation_builder_artifacts enable row level security;

drop policy if exists automation_builder_workspace_select on app.automation_intents;
create policy automation_builder_workspace_select on app.automation_intents
  for select to authenticated
  using (public.has_workspace_permission(workspace_id, 'automation_builder.view'));
drop policy if exists automation_builder_workspace_insert on app.automation_intents;
create policy automation_builder_workspace_insert on app.automation_intents
  for insert to authenticated
  with check (public.has_workspace_permission(workspace_id, 'automation_builder.create_intent'));
drop policy if exists automation_builder_workspace_update on app.automation_intents;
create policy automation_builder_workspace_update on app.automation_intents
  for update to authenticated
  using (public.has_workspace_permission(workspace_id, 'automation_builder.create_intent'))
  with check (public.has_workspace_permission(workspace_id, 'automation_builder.create_intent'));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'automation_builder_sessions',
    'automation_intent_sources',
    'automation_blueprints',
    'automation_blueprint_versions',
    'automation_blueprint_steps',
    'automation_blueprint_edges',
    'automation_blueprint_inputs',
    'automation_blueprint_outputs',
    'automation_blueprint_context_items',
    'automation_blueprint_clarifications',
    'automation_blueprint_validations',
    'automation_blueprint_compile_previews',
    'automation_blueprint_approvals',
    'automation_planner_runs',
    'automation_planner_events',
    'automation_runtime_creation_jobs',
    'automation_mcp_invocations',
    'automation_builder_artifacts'
  ]
  loop
    execute format('drop policy if exists %I_select on app.%I', table_name, table_name);
    execute format(
      'create policy %I_select on app.%I for select to authenticated using (public.has_workspace_permission(workspace_id, %L))',
      table_name,
      table_name,
      'automation_builder.view'
    );
    execute format('drop policy if exists %I_insert on app.%I', table_name, table_name);
    execute format(
      'create policy %I_insert on app.%I for insert to authenticated with check (public.has_workspace_permission(workspace_id, %L))',
      table_name,
      table_name,
      'automation_builder.create_intent'
    );
    execute format('drop policy if exists %I_update on app.%I', table_name, table_name);
    execute format(
      'create policy %I_update on app.%I for update to authenticated using (public.has_workspace_permission(workspace_id, %L)) with check (public.has_workspace_permission(workspace_id, %L))',
      table_name,
      table_name,
      'automation_builder.validate',
      'automation_builder.validate'
    );
  end loop;
end $$;

grant select, insert, update on
  app.automation_builder_sessions,
  app.automation_intents,
  app.automation_intent_sources,
  app.automation_blueprints,
  app.automation_blueprint_versions,
  app.automation_blueprint_steps,
  app.automation_blueprint_edges,
  app.automation_blueprint_inputs,
  app.automation_blueprint_outputs,
  app.automation_blueprint_context_items,
  app.automation_blueprint_clarifications,
  app.automation_blueprint_validations,
  app.automation_blueprint_compile_previews,
  app.automation_blueprint_approvals,
  app.automation_planner_runs,
  app.automation_planner_events,
  app.automation_runtime_creation_jobs,
  app.automation_mcp_invocations,
  app.automation_builder_artifacts
to authenticated;
