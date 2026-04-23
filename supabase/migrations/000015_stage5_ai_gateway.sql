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
      'connection',
      'recommendation',
      'billing',
      'audit'
    )
  );

insert into app.permissions (code, label, description, scope, high_risk)
values
  ('ai.chat.use', 'Use AI chat', 'Use the AI chat workspace and session routes.', 'ai', false),
  ('ai.workflow.create', 'Create AI workflow drafts', 'Create and save workflow drafts produced by the AI planner.', 'ai', true),
  ('ai.workflow.patch', 'Create AI workflow patches', 'Generate and review patches for installed automations.', 'ai', true),
  ('ai.use_confidential', 'Use AI with confidential data', 'Allow AI planning with confidential client materials.', 'ai', true),
  ('ai.use_legal_secret', 'Use AI with legal secret data', 'Allow AI planning with legal secret materials.', 'ai', true),
  ('ai.admin.playground', 'Access AI playground', 'Access the internal AI evaluation and QA playground.', 'ai', true)
on conflict (code) do update
set
  label = excluded.label,
  description = excluded.description,
  scope = excluded.scope,
  high_risk = excluded.high_risk;

insert into app.role_permissions (role_code, permission_code)
select role_code, permission_code
from (
  values
    ('owner'::workspace_role, 'ai.chat.use'),
    ('owner'::workspace_role, 'ai.workflow.create'),
    ('owner'::workspace_role, 'ai.workflow.patch'),
    ('owner'::workspace_role, 'ai.use_confidential'),
    ('owner'::workspace_role, 'ai.use_legal_secret'),
    ('owner'::workspace_role, 'ai.admin.playground'),
    ('admin'::workspace_role, 'ai.chat.use'),
    ('admin'::workspace_role, 'ai.workflow.create'),
    ('admin'::workspace_role, 'ai.workflow.patch'),
    ('admin'::workspace_role, 'ai.use_confidential'),
    ('admin'::workspace_role, 'ai.use_legal_secret'),
    ('admin'::workspace_role, 'ai.admin.playground'),
    ('lawyer'::workspace_role, 'ai.chat.use'),
    ('lawyer'::workspace_role, 'ai.workflow.create'),
    ('lawyer'::workspace_role, 'ai.workflow.patch'),
    ('lawyer'::workspace_role, 'ai.use_confidential'),
    ('assistant'::workspace_role, 'ai.chat.use'),
    ('assistant'::workspace_role, 'ai.workflow.create'),
    ('viewer'::workspace_role, 'ai.chat.use')
) as grants(role_code, permission_code)
where exists (select 1 from app.roles r where r.code = grants.role_code)
on conflict do nothing;

create table if not exists app.workspace_ai_policies (
  workspace_id uuid primary key references app.workspaces(id) on delete cascade,
  ai_enabled boolean not null default true,
  allow_confidential boolean not null default true,
  allow_legal_secret boolean not null default false,
  cometapi_public_enabled boolean not null default true,
  plaintext_opt_in boolean not null default false,
  sensitive_logging boolean not null default false,
  monthly_budget_usd numeric(12, 4) not null default 50,
  requests_per_minute_limit integer not null default 20,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

insert into app.workspace_ai_policies (workspace_id)
select id
from app.workspaces
on conflict (workspace_id) do nothing;

create table if not exists app.ai_data_classes (
  code text primary key,
  label text not null,
  external_allowed boolean not null,
  default_provider_route text not null check (
    default_provider_route in ('xai', 'xai_zdr', 'cometapi', 'local_mock', 'blocked')
  ),
  created_at timestamptz not null default timezone('utc', now())
);

insert into app.ai_data_classes (code, label, external_allowed, default_provider_route)
values
  ('A_PUBLIC', 'Public', true, 'xai'),
  ('A_TEMPLATE_NON_SENSITIVE', 'Template non-sensitive', true, 'xai'),
  ('B_INTERNAL_WORKSPACE', 'Internal workspace', true, 'xai'),
  ('B_ANONYMIZED_LEGAL', 'Anonymized legal', true, 'cometapi'),
  ('C_CONFIDENTIAL_CLIENT', 'Confidential client', true, 'xai_zdr'),
  ('C_LEGAL_SECRET', 'Legal secret', true, 'xai_zdr'),
  ('D_AI_EXTERNAL_FORBIDDEN', 'External AI forbidden', false, 'local_mock')
on conflict (code) do update
set
  label = excluded.label,
  external_allowed = excluded.external_allowed,
  default_provider_route = excluded.default_provider_route;

create table if not exists app.ai_chat_sessions (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  created_by_user_id uuid null references app.profiles(id) on delete set null,
  source text not null check (
    source in ('global_chat', 'automation_chat', 'document_chat')
  ),
  mode text not null check (
    mode in ('create_workflow', 'modify_workflow', 'explain_workflow', 'extract_fields')
  ),
  status text not null default 'active' check (
    status in ('active', 'archived')
  ),
  title text not null,
  current_automation_id text null,
  selected_document_ids jsonb not null default '[]'::jsonb,
  selected_template_ids jsonb not null default '[]'::jsonb,
  selected_profile_id text null,
  content_storage_mode text not null default 'metadata_only' check (
    content_storage_mode in ('metadata_only', 'encrypted', 'plaintext_allowed')
  ),
  allowed_modes jsonb not null default '[]'::jsonb,
  ai_policy_summary jsonb not null default '{}'::jsonb,
  last_message_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.ai_chat_messages (
  id uuid primary key default public.app_uuid_v7(),
  session_id uuid not null references app.ai_chat_sessions(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  created_by_user_id uuid null references app.profiles(id) on delete set null,
  role text not null check (role in ('user', 'assistant', 'system')),
  response_type text null check (
    response_type is null or response_type in (
      'workflow_draft_ready',
      'clarification_required',
      'patch_ready',
      'blocked_by_policy',
      'queued',
      'error',
      'explanation'
    )
  ),
  content_text text null,
  content_preview text not null,
  content_storage_mode text not null check (
    content_storage_mode in ('metadata_only', 'encrypted', 'plaintext_allowed')
  ),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.ai_requests (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  session_id uuid null references app.ai_chat_sessions(id) on delete set null,
  task_type text not null check (
    task_type in (
      'workflow_planning',
      'workflow_patch',
      'document_analysis',
      'field_extraction',
      'clarification'
    )
  ),
  data_class text not null references app.ai_data_classes(code),
  provider text null check (provider is null or provider in ('xai', 'cometapi', 'local')),
  model text null,
  route_reason text not null,
  prompt_hash text not null,
  response_hash text null,
  schema_version text null,
  prompt_version text not null,
  status text not null check (
    status in ('queued', 'completed', 'blocked', 'error')
  ),
  error_code text null,
  latency_ms integer null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(12, 6) not null default 0,
  request_payload jsonb not null default '{}'::jsonb,
  idempotency_key text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.ai_request_events (
  id uuid primary key default public.app_uuid_v7(),
  request_id uuid not null references app.ai_requests(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.ai_provider_calls (
  id uuid primary key default public.app_uuid_v7(),
  ai_request_id uuid not null references app.ai_requests(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  provider text not null check (provider in ('xai', 'cometapi', 'local')),
  route text not null check (
    route in ('xai', 'xai_zdr', 'cometapi', 'local_mock', 'blocked')
  ),
  model text not null,
  request_hash text not null,
  response_hash text null,
  status text not null default 'completed' check (
    status in ('queued', 'completed', 'failed')
  ),
  latency_ms integer null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.ai_tool_calls (
  id uuid primary key default public.app_uuid_v7(),
  ai_request_id uuid not null references app.ai_requests(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  tool_name text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'completed' check (
    status in ('queued', 'completed', 'failed')
  ),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.ai_redaction_mappings (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  classification text not null references app.ai_data_classes(code),
  original_hash text not null,
  redacted_text text not null,
  entities jsonb not null default '[]'::jsonb,
  created_by_user_id uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.ai_prompt_templates (
  id uuid primary key default public.app_uuid_v7(),
  code text not null unique,
  title text not null,
  description text not null,
  active_version text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.ai_prompt_template_versions (
  id uuid primary key default public.app_uuid_v7(),
  template_id uuid not null references app.ai_prompt_templates(id) on delete cascade,
  version text not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (template_id, version)
);

insert into app.ai_prompt_templates (id, code, title, description, active_version)
values
  (public.app_uuid_v7(), 'workflow_planning_v1', 'Workflow planning', 'Prompt template for workflow planning drafts.', 'v1'),
  (public.app_uuid_v7(), 'workflow_patch_v1', 'Workflow patching', 'Prompt template for workflow patch generation.', 'v1'),
  (public.app_uuid_v7(), 'redaction_preview_v1', 'Redaction preview', 'Prompt template for redaction previews.', 'v1')
on conflict (code) do nothing;

insert into app.ai_prompt_template_versions (id, template_id, version, body, metadata)
select
  public.app_uuid_v7(),
  t.id,
  'v1',
  case t.code
    when 'workflow_planning_v1' then 'Generate a lexframe.workflow.v1 draft and keep missing fields explicit.'
    when 'workflow_patch_v1' then 'Generate a lexframe.workflow_patch.v1 patch against the current automation.'
    else 'Generate a reversible redaction preview with structured entities.'
  end,
  '{}'::jsonb
from app.ai_prompt_templates t
where not exists (
  select 1
  from app.ai_prompt_template_versions v
  where v.template_id = t.id
    and v.version = 'v1'
);

create table if not exists app.workflow_drafts (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  owner_id uuid not null references app.profiles(id) on delete restrict,
  source text not null check (source in ('ai_chat', 'recommendation', 'manual')),
  status text not null check (
    status in (
      'created',
      'planning',
      'clarification_required',
      'validation_failed',
      'ready_for_review',
      'saved',
      'applied_to_automation',
      'archived'
    )
  ),
  title text not null,
  current_version_id uuid null,
  linked_automation_id text null,
  linked_session_id uuid null references app.ai_chat_sessions(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.workflow_draft_versions (
  id uuid primary key default public.app_uuid_v7(),
  draft_id uuid not null references app.workflow_drafts(id) on delete cascade,
  version_no integer not null check (version_no > 0),
  schema_version text not null,
  prompt_version text not null,
  ai_request_id uuid null references app.ai_requests(id) on delete set null,
  workflow jsonb not null,
  validation_report jsonb not null,
  policy_report jsonb not null,
  runtime_plan_preview jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (draft_id, version_no)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workflow_drafts_current_version_fk'
  ) then
    alter table app.workflow_drafts
      add constraint workflow_drafts_current_version_fk
      foreign key (current_version_id)
      references app.workflow_draft_versions(id)
      on delete set null;
  end if;
end
$$;

create table if not exists app.workflow_draft_validation_reports (
  id uuid primary key default public.app_uuid_v7(),
  draft_id uuid not null references app.workflow_drafts(id) on delete cascade,
  draft_version_id uuid not null references app.workflow_draft_versions(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  validation_report jsonb not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.workflow_draft_patches (
  id uuid primary key default public.app_uuid_v7(),
  draft_id uuid not null references app.workflow_drafts(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  automation_id text not null,
  base_version_id text not null,
  ai_request_id uuid null references app.ai_requests(id) on delete set null,
  patch jsonb not null,
  diff jsonb not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.workflow_draft_missing_fields (
  id uuid primary key default public.app_uuid_v7(),
  draft_id uuid not null references app.workflow_drafts(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  field text not null,
  label text not null,
  field_type text not null check (
    field_type in (
      'text',
      'textarea',
      'select',
      'multiselect',
      'date',
      'email',
      'number',
      'document',
      'template',
      'profile'
    )
  ),
  required boolean not null default true,
  help_text text null,
  options jsonb not null default '[]'::jsonb,
  default_value jsonb null,
  answered_value jsonb null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.ai_cost_usage (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  ai_request_id uuid not null references app.ai_requests(id) on delete cascade,
  provider text not null check (provider in ('xai', 'cometapi', 'local')),
  cost_usd numeric(12, 6) not null default 0,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.ai_jobs (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  ai_request_id uuid null references app.ai_requests(id) on delete set null,
  kind text not null,
  status text not null default 'queued' check (
    status in ('queued', 'running', 'completed', 'failed')
  ),
  payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  last_error text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_app_workspace_ai_policies_updated
  on app.workspace_ai_policies (updated_at desc);

create index if not exists idx_app_ai_chat_sessions_workspace
  on app.ai_chat_sessions (workspace_id, updated_at desc);

create index if not exists idx_app_ai_chat_messages_session
  on app.ai_chat_messages (session_id, created_at asc);

create index if not exists idx_app_ai_requests_workspace
  on app.ai_requests (workspace_id, created_at desc);

create index if not exists idx_app_ai_requests_idempotency
  on app.ai_requests (workspace_id, session_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_app_ai_request_events_request
  on app.ai_request_events (request_id, created_at asc);

create index if not exists idx_app_ai_provider_calls_request
  on app.ai_provider_calls (ai_request_id, created_at desc);

create index if not exists idx_app_ai_redaction_mappings_workspace
  on app.ai_redaction_mappings (workspace_id, created_at desc);

create index if not exists idx_app_workflow_drafts_workspace
  on app.workflow_drafts (workspace_id, updated_at desc);

create index if not exists idx_app_workflow_draft_versions_draft
  on app.workflow_draft_versions (draft_id, version_no desc);

create index if not exists idx_app_workflow_draft_missing_fields_draft
  on app.workflow_draft_missing_fields (draft_id, created_at asc);

create index if not exists idx_app_ai_cost_usage_workspace
  on app.ai_cost_usage (workspace_id, created_at desc);

create index if not exists idx_app_ai_jobs_workspace
  on app.ai_jobs (workspace_id, status, created_at desc);
