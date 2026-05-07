create table if not exists app.ai_provider_connections (
  id text primary key,
  workspace_id uuid null references app.workspaces(id) on delete cascade,
  provider_code text not null check (provider_code in ('cometapi', 'openai_compatible', 'openai', 'mock')),
  display_name text not null,
  base_url text not null,
  api_key_ref text not null,
  enabled boolean not null default true,
  model_discovery_mode text not null check (model_discovery_mode in ('manual_allowlist', 'models_endpoint')),
  allowed_models text[] not null default array[]::text[],
  default_model text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.ai_model_routes (
  route_code text primary key check (
    route_code in (
      'default_chat',
      'agent_general',
      'rag_legal_summary',
      'automation_planner_high'
    )
  ),
  provider_connection_id text not null references app.ai_provider_connections(id) on delete restrict,
  provider_code text not null check (provider_code in ('cometapi', 'openai_compatible', 'openai', 'mock')),
  model text not null,
  supports_streaming boolean not null default true,
  supports_json boolean not null default true,
  supports_tool_calls boolean not null default false,
  max_context_tokens integer null,
  visible_to_user boolean not null default false check (visible_to_user = false),
  admin_visible boolean not null default true,
  enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.ai_route_valves (
  id uuid primary key default public.app_uuid_v7(),
  route_code text not null references app.ai_model_routes(route_code) on delete cascade,
  key text not null,
  value_type text not null check (value_type in ('string', 'number', 'boolean', 'enum', 'secret_ref')),
  default_value jsonb null,
  required boolean not null default true,
  admin_only boolean not null default true,
  secret boolean not null default false,
  description text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (route_code, key)
);

create table if not exists app.ai_route_policy_snapshots (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid null references app.workspaces(id) on delete cascade,
  route_code text not null references app.ai_model_routes(route_code) on delete restrict,
  provider_code text not null,
  model text not null,
  policy_decision_id text not null,
  snapshot jsonb not null default '{}'::jsonb,
  trace_id text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.ai_stream_jobs (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  actor_id uuid null references app.profiles(id) on delete set null,
  route_code text not null references app.ai_model_routes(route_code) on delete restrict,
  provider_code text not null,
  model text not null,
  status text not null check (status in ('started', 'completed', 'failed', 'cancelled')),
  trace_id text not null,
  request_id text null,
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz null
);

create table if not exists app.ai_stream_events (
  id uuid primary key default public.app_uuid_v7(),
  stream_job_id uuid not null references app.ai_stream_jobs(id) on delete cascade,
  event_type text not null check (
    event_type in (
      'message_start',
      'text_delta',
      'tool_call_start',
      'tool_call_delta',
      'tool_result',
      'usage',
      'route_snapshot',
      'evidence',
      'error',
      'message_done'
    )
  ),
  payload jsonb not null default '{}'::jsonb,
  trace_id text not null,
  created_at timestamptz not null default timezone('utc', now())
);

insert into app.role_permissions (role_code, permission_code)
values
  ('owner', 'ai.chat.use'),
  ('owner', 'ai.workflow.create'),
  ('owner', 'ai.workflow.patch'),
  ('owner', 'ai.use_confidential'),
  ('owner', 'ai.use_legal_secret'),
  ('owner', 'ai.admin.playground'),
  ('admin', 'ai.chat.use'),
  ('admin', 'ai.workflow.create'),
  ('admin', 'ai.workflow.patch'),
  ('admin', 'ai.use_confidential'),
  ('admin', 'ai.use_legal_secret'),
  ('admin', 'ai.admin.playground'),
  ('lawyer', 'ai.chat.use'),
  ('lawyer', 'ai.workflow.create'),
  ('lawyer', 'ai.workflow.patch'),
  ('lawyer', 'ai.use_confidential'),
  ('assistant', 'ai.chat.use'),
  ('assistant', 'ai.workflow.create'),
  ('viewer', 'ai.chat.use')
on conflict (role_code, permission_code) do nothing;

insert into app.ai_provider_connections (
  id,
  workspace_id,
  provider_code,
  display_name,
  base_url,
  api_key_ref,
  enabled,
  model_discovery_mode,
  allowed_models,
  default_model
)
values (
  'owner_default_ai',
  null,
  'cometapi',
  'CometAPI DeepSeek V4 Flash',
  'https://api.cometapi.com/v1',
  'owner_default_ai',
  true,
  'manual_allowlist',
  array['deepseek-v4-flash'],
  'deepseek-v4-flash'
)
on conflict (id) do update
set
  provider_code = excluded.provider_code,
  display_name = excluded.display_name,
  base_url = excluded.base_url,
  api_key_ref = excluded.api_key_ref,
  enabled = excluded.enabled,
  model_discovery_mode = excluded.model_discovery_mode,
  allowed_models = excluded.allowed_models,
  default_model = excluded.default_model,
  updated_at = timezone('utc', now());

insert into app.ai_provider_connections (
  id,
  provider_code,
  display_name,
  base_url,
  api_key_ref,
  enabled,
  model_discovery_mode,
  allowed_models,
  default_model
)
values (
  'stage20_reserved_owner_route',
  'openai',
  'Stage 20 reserved automation planner',
  'https://api.openai.com/v1',
  'stage20_reserved_owner_route',
  false,
  'manual_allowlist',
  array['gpt-5.5'],
  'gpt-5.5'
)
on conflict (id) do update
set
  enabled = false,
  updated_at = timezone('utc', now());

insert into app.ai_model_routes (
  route_code,
  provider_connection_id,
  provider_code,
  model,
  supports_streaming,
  supports_json,
  supports_tool_calls,
  max_context_tokens,
  visible_to_user,
  admin_visible,
  enabled
)
values
  ('default_chat', 'owner_default_ai', 'cometapi', 'deepseek-v4-flash', true, true, true, 1000000, false, true, true),
  ('agent_general', 'owner_default_ai', 'cometapi', 'deepseek-v4-flash', true, true, true, 1000000, false, true, true),
  ('rag_legal_summary', 'owner_default_ai', 'cometapi', 'deepseek-v4-flash', true, true, false, 1000000, false, true, true),
  ('automation_planner_high', 'stage20_reserved_owner_route', 'openai', 'gpt-5.5', true, true, true, null, false, true, false)
on conflict (route_code) do update
set
  provider_connection_id = excluded.provider_connection_id,
  provider_code = excluded.provider_code,
  model = excluded.model,
  supports_streaming = excluded.supports_streaming,
  supports_json = excluded.supports_json,
  supports_tool_calls = excluded.supports_tool_calls,
  max_context_tokens = excluded.max_context_tokens,
  visible_to_user = false,
  admin_visible = excluded.admin_visible,
  enabled = excluded.enabled,
  updated_at = timezone('utc', now());

insert into app.ai_route_valves (
  route_code,
  key,
  value_type,
  default_value,
  required,
  admin_only,
  secret,
  description
)
select
  route_code,
  key,
  value_type,
  default_value,
  true,
  true,
  false,
  description
from (
  values
    ('temperature', 'number', '0.2'::jsonb, 'Sampling temperature.'),
    ('max_output_tokens', 'number', '4096'::jsonb, 'Maximum provider output tokens.'),
    ('json_mode_enabled', 'boolean', 'true'::jsonb, 'Whether JSON output mode is requested.'),
    ('tool_calling_enabled', 'boolean', 'true'::jsonb, 'Whether tool calling is allowed for this route.'),
    ('context_budget_tokens', 'number', '120000'::jsonb, 'Prompt context budget.'),
    ('redaction_required', 'boolean', 'true'::jsonb, 'Require redaction/reference substitution before provider calls.'),
    ('allow_external_provider_for_client_material', 'boolean', 'false'::jsonb, 'Allow external provider for client material after policy checks.'),
    ('timeout_ms', 'number', '90000'::jsonb, 'Provider request timeout.'),
    ('retry_count', 'number', '1'::jsonb, 'Transient provider retry count.')
) as valve(key, value_type, default_value, description)
cross join (
  values
    ('default_chat'),
    ('agent_general'),
    ('rag_legal_summary'),
    ('automation_planner_high')
) as route(route_code)
on conflict (route_code, key) do update
set
  value_type = excluded.value_type,
  default_value = excluded.default_value,
  required = excluded.required,
  admin_only = excluded.admin_only,
  secret = false,
  description = excluded.description,
  updated_at = timezone('utc', now());

update app.ai_route_valves
set default_value = 'false'::jsonb
where route_code = 'rag_legal_summary'
  and key = 'tool_calling_enabled';

update app.ai_route_valves
set default_value = 'false'::jsonb
where route_code = 'default_chat'
  and key = 'redaction_required';

alter table app.ai_requests
  add column if not exists route_code text null,
  add column if not exists provider_code text null,
  add column if not exists policy_decision_id text null,
  add column if not exists trace_id text null;

create index if not exists idx_ai_model_routes_stage18_enabled
  on app.ai_model_routes (enabled, route_code);

create index if not exists idx_ai_route_policy_snapshots_workspace
  on app.ai_route_policy_snapshots (workspace_id, route_code, created_at desc);

create index if not exists idx_ai_stream_jobs_workspace_trace
  on app.ai_stream_jobs (workspace_id, trace_id, created_at desc);

create index if not exists idx_ai_stream_events_job
  on app.ai_stream_events (stream_job_id, created_at);

alter table app.ai_provider_connections enable row level security;
alter table app.ai_model_routes enable row level security;
alter table app.ai_route_valves enable row level security;
alter table app.ai_route_policy_snapshots enable row level security;
alter table app.ai_stream_jobs enable row level security;
alter table app.ai_stream_events enable row level security;

drop policy if exists ai_provider_connections_select_admin on app.ai_provider_connections;
create policy ai_provider_connections_select_admin
  on app.ai_provider_connections
  for select
  to authenticated
  using (workspace_id is null or public.is_workspace_member(workspace_id));

drop policy if exists ai_model_routes_select_member on app.ai_model_routes;
create policy ai_model_routes_select_member
  on app.ai_model_routes
  for select
  to authenticated
  using (admin_visible = true);

drop policy if exists ai_route_valves_select_member on app.ai_route_valves;
create policy ai_route_valves_select_member
  on app.ai_route_valves
  for select
  to authenticated
  using (admin_only = true);

drop policy if exists ai_route_policy_snapshots_select_member on app.ai_route_policy_snapshots;
create policy ai_route_policy_snapshots_select_member
  on app.ai_route_policy_snapshots
  for select
  to authenticated
  using (workspace_id is null or public.is_workspace_member(workspace_id));

drop policy if exists ai_stream_jobs_select_member on app.ai_stream_jobs;
create policy ai_stream_jobs_select_member
  on app.ai_stream_jobs
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists ai_stream_events_select_member on app.ai_stream_events;
create policy ai_stream_events_select_member
  on app.ai_stream_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from app.ai_stream_jobs j
      where j.id = stream_job_id
        and public.is_workspace_member(j.workspace_id)
    )
  );

grant select, insert, update on app.ai_provider_connections to authenticated;
grant select, insert, update on app.ai_model_routes to authenticated;
grant select, insert, update on app.ai_route_valves to authenticated;
grant select, insert, update on app.ai_route_policy_snapshots to authenticated;
grant select, insert, update on app.ai_stream_jobs to authenticated;
grant select, insert, update on app.ai_stream_events to authenticated;
