alter table app.profiles
  add column if not exists first_name text null,
  add column if not exists last_name text null,
  add column if not exists display_name text null;

alter table app.workspaces
  add column if not exists organization_display_name text null,
  add column if not exists organization_legal_name text null,
  add column if not exists organization_settings_json jsonb not null default '{}'::jsonb;

alter table app.ai_model_routes drop constraint if exists ai_model_routes_route_code_check;
alter table app.ai_model_routes
  add constraint ai_model_routes_route_code_check check (
    route_code in (
      'default_chat',
      'agent_general',
      'rag_legal_summary',
      'document_generation_assist',
      'chat_title_generation',
      'automation_planner_high',
      'automation_blueprint',
      'canvas_ai_assist',
      'workflow_patch_generation',
      'automation_tool_reasoning'
    )
  );

create table if not exists app.ai_secret_refs (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid null references app.workspaces(id) on delete cascade,
  owner_scope text not null check (owner_scope in ('user', 'workspace', 'system')),
  owner_user_id uuid null references app.profiles(id) on delete set null,
  provider_connection_id text null references app.ai_provider_connections(id) on delete set null,
  backend text not null check (backend in ('supabase_vault', 'local_owner_vault', 'env_secret', 'dev_mock')),
  backend_secret_id text null,
  fingerprint text not null,
  status text not null default 'active' check (status in ('active', 'rotated', 'revoked')),
  created_by uuid null references app.profiles(id) on delete set null,
  last_rotated_by uuid null references app.profiles(id) on delete set null,
  last_rotated_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ai_secret_refs_no_raw_secret check (
    backend_secret_id is null
    or backend_secret_id !~ '(sk-[A-Za-z0-9_-]{12,}|Bearer\\s+|eyJ[A-Za-z0-9_-]+\\.)'
  )
);

alter table app.ai_provider_connections
  add column if not exists owner_scope text not null default 'system' check (owner_scope in ('user', 'workspace', 'system')),
  add column if not exists owner_user_id uuid null references app.profiles(id) on delete set null,
  add column if not exists secret_ref_id uuid null references app.ai_secret_refs(id) on delete set null,
  add column if not exists provider_metadata_redacted jsonb not null default '{}'::jsonb,
  add column if not exists ui_label text null,
  add column if not exists last_test_status text not null default 'not_tested' check (last_test_status in ('not_tested', 'pending', 'success', 'failed', 'blocked')),
  add column if not exists last_tested_at timestamptz null,
  add column if not exists last_used_at timestamptz null;

update app.ai_provider_connections
set ui_label = coalesce(ui_label, display_name),
    owner_scope = coalesce(owner_scope, case when workspace_id is null then 'system' else 'workspace' end);

create table if not exists app.ai_route_group_preferences (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid null references app.workspaces(id) on delete cascade,
  user_id uuid null references app.profiles(id) on delete cascade,
  route_group text not null check (route_group in ('chat_ai', 'automation_ai')),
  scope_type text not null check (scope_type in ('user', 'workspace', 'system')),
  provider_connection_id text not null references app.ai_provider_connections(id) on delete restrict,
  model_id text not null,
  enabled boolean not null default true,
  capabilities_confirmed jsonb not null default '{}'::jsonb,
  updated_by uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ai_route_group_preferences_scope_consistency check (
    (scope_type = 'user' and workspace_id is not null and user_id is not null)
    or (scope_type = 'workspace' and workspace_id is not null and user_id is null)
    or (scope_type = 'system' and user_id is null)
  ),
  constraint ai_route_group_preferences_automation_json check (
    route_group <> 'automation_ai'
    or capabilities_confirmed ? 'structuredJsonSchema'
    or capabilities_confirmed ? 'jsonMode'
  )
);

create unique index if not exists ux_ai_route_group_preferences_scope
  on app.ai_route_group_preferences (
    coalesce(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    route_group,
    scope_type
  );

create table if not exists app.ai_effective_route_snapshots (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  user_id uuid null references app.profiles(id) on delete set null,
  route_group text not null check (route_group in ('chat_ai', 'automation_ai')),
  route_code text not null,
  provider_connection_id text not null,
  provider_code text not null,
  model_id text not null,
  source text not null check (source in ('user_preference', 'workspace_preference', 'system_default', 'stage18_default_route')),
  policy_decision_id text not null,
  safe_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint ai_effective_route_snapshots_no_secret check (
    safe_snapshot::text !~ '(sk-[A-Za-z0-9_-]{12,}|Bearer\\s+|eyJ[A-Za-z0-9_-]+\\.)'
  )
);

create table if not exists app.ai_provider_connection_tests (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  provider_connection_id text not null references app.ai_provider_connections(id) on delete cascade,
  status text not null check (status in ('not_tested', 'pending', 'success', 'failed', 'blocked')),
  latency_ms integer null,
  error_code text null,
  response_metadata_redacted jsonb not null default '{}'::jsonb,
  tested_by uuid null references app.profiles(id) on delete set null,
  tested_at timestamptz not null default timezone('utc', now()),
  constraint ai_provider_connection_tests_no_secret check (
    response_metadata_redacted::text !~ '(sk-[A-Za-z0-9_-]{12,}|Bearer\\s+|eyJ[A-Za-z0-9_-]+\\.)'
  )
);

create index if not exists idx_ai_secret_refs_workspace_user
  on app.ai_secret_refs (workspace_id, owner_user_id, owner_scope);

create index if not exists idx_ai_provider_connections_stage21_workspace
  on app.ai_provider_connections (workspace_id, owner_user_id, owner_scope);

create index if not exists idx_ai_provider_connections_secret_ref
  on app.ai_provider_connections (secret_ref_id);

create index if not exists idx_ai_route_group_preferences_workspace_user
  on app.ai_route_group_preferences (workspace_id, user_id, route_group);

create index if not exists idx_ai_effective_route_snapshots_workspace
  on app.ai_effective_route_snapshots (workspace_id, user_id, route_group, created_at desc);

create index if not exists idx_ai_provider_connection_tests_connection
  on app.ai_provider_connection_tests (workspace_id, provider_connection_id, tested_at desc);

insert into app.permissions (code, label, description, scope, high_risk)
values
  ('settings.view', 'View settings', 'Open internal settings.', 'workspace', false),
  ('settings.profile.update_self', 'Update own profile settings', 'Update own profile settings.', 'profile', false),
  ('settings.organization.view', 'View organization settings', 'View active organization settings.', 'workspace', false),
  ('settings.organization.update', 'Update organization settings', 'Update organization display fields.', 'workspace', true),
  ('settings.ai.view', 'View AI settings', 'View safe AI provider and route metadata.', 'ai', false),
  ('settings.ai.manage_self', 'Manage own AI settings', 'Manage user-scoped AI provider preferences.', 'ai', false),
  ('settings.ai.manage_workspace', 'Manage workspace AI settings', 'Manage workspace-scoped AI provider preferences.', 'ai', true),
  ('settings.ai.secret.create_self', 'Create own AI secret', 'Create user-scoped AI secrets.', 'ai', true),
  ('settings.ai.secret.rotate_self', 'Rotate own AI secret', 'Rotate user-scoped AI secrets.', 'ai', true),
  ('settings.ai.secret.delete_self', 'Delete own AI secret', 'Delete user-scoped AI secrets.', 'ai', true),
  ('settings.ai.secret.create_workspace', 'Create workspace AI secret', 'Create workspace-scoped AI secrets.', 'ai', true),
  ('settings.ai.secret.rotate_workspace', 'Rotate workspace AI secret', 'Rotate workspace-scoped AI secrets.', 'ai', true),
  ('settings.ai.secret.delete_workspace', 'Delete workspace AI secret', 'Delete workspace-scoped AI secrets.', 'ai', true),
  ('settings.ai.connection.test', 'Test AI connection', 'Run prompt-free backend AI provider connection checks.', 'ai', true),
  ('settings.ai.diagnostics.view', 'View AI diagnostics', 'View safe AI route diagnostics.', 'ai', true),
  ('settings.ai.effective_policy.view', 'View effective AI policy', 'View effective AI route policy snapshots.', 'ai', true)
on conflict (code) do update
set label = excluded.label,
    description = excluded.description,
    scope = excluded.scope,
    high_risk = excluded.high_risk;

insert into app.role_permissions (role_code, permission_code)
select role_code::workspace_role, permission_code
from (
  values
    ('owner', 'settings.view'),
    ('owner', 'settings.profile.update_self'),
    ('owner', 'settings.organization.view'),
    ('owner', 'settings.organization.update'),
    ('owner', 'settings.ai.view'),
    ('owner', 'settings.ai.manage_self'),
    ('owner', 'settings.ai.manage_workspace'),
    ('owner', 'settings.ai.secret.create_self'),
    ('owner', 'settings.ai.secret.rotate_self'),
    ('owner', 'settings.ai.secret.delete_self'),
    ('owner', 'settings.ai.secret.create_workspace'),
    ('owner', 'settings.ai.secret.rotate_workspace'),
    ('owner', 'settings.ai.secret.delete_workspace'),
    ('owner', 'settings.ai.connection.test'),
    ('owner', 'settings.ai.diagnostics.view'),
    ('owner', 'settings.ai.effective_policy.view'),
    ('admin', 'settings.view'),
    ('admin', 'settings.profile.update_self'),
    ('admin', 'settings.organization.view'),
    ('admin', 'settings.organization.update'),
    ('admin', 'settings.ai.view'),
    ('admin', 'settings.ai.manage_self'),
    ('admin', 'settings.ai.manage_workspace'),
    ('admin', 'settings.ai.secret.create_self'),
    ('admin', 'settings.ai.secret.rotate_self'),
    ('admin', 'settings.ai.secret.create_workspace'),
    ('admin', 'settings.ai.secret.rotate_workspace'),
    ('admin', 'settings.ai.connection.test'),
    ('admin', 'settings.ai.diagnostics.view'),
    ('admin', 'settings.ai.effective_policy.view'),
    ('lawyer', 'settings.view'),
    ('lawyer', 'settings.profile.update_self'),
    ('lawyer', 'settings.organization.view'),
    ('lawyer', 'settings.ai.view'),
    ('lawyer', 'settings.ai.manage_self'),
    ('lawyer', 'settings.ai.secret.create_self'),
    ('lawyer', 'settings.ai.secret.rotate_self'),
    ('lawyer', 'settings.ai.connection.test'),
    ('assistant', 'settings.view'),
    ('assistant', 'settings.profile.update_self'),
    ('assistant', 'settings.organization.view'),
    ('assistant', 'settings.ai.view'),
    ('assistant', 'settings.ai.manage_self'),
    ('assistant', 'settings.ai.secret.create_self'),
    ('assistant', 'settings.ai.secret.rotate_self'),
    ('assistant', 'settings.ai.connection.test'),
    ('viewer', 'settings.view'),
    ('viewer', 'settings.profile.update_self'),
    ('viewer', 'settings.organization.view'),
    ('viewer', 'settings.ai.view'),
    ('viewer', 'settings.ai.manage_self')
) as grants(role_code, permission_code)
on conflict (role_code, permission_code) do nothing;

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
  ('document_generation_assist', 'owner_default_ai', 'cometapi', 'deepseek-v4-flash', true, true, true, 1000000, false, true, true),
  ('chat_title_generation', 'owner_default_ai', 'cometapi', 'deepseek-v4-flash', false, true, false, 16000, false, true, true),
  ('automation_planner_high', 'stage20_reserved_owner_route', 'openai', 'gpt-5.5', true, true, true, null, false, true, true),
  ('automation_blueprint', 'stage20_reserved_owner_route', 'openai', 'gpt-5.5', true, true, true, null, false, true, true),
  ('canvas_ai_assist', 'owner_default_ai', 'cometapi', 'deepseek-v4-flash', true, true, true, 1000000, false, true, true),
  ('workflow_patch_generation', 'stage20_reserved_owner_route', 'openai', 'gpt-5.5', true, true, true, null, false, true, true),
  ('automation_tool_reasoning', 'stage20_reserved_owner_route', 'openai', 'gpt-5.5', true, true, true, null, false, true, true)
on conflict (route_code) do update
set provider_connection_id = excluded.provider_connection_id,
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

alter table app.ai_secret_refs enable row level security;
alter table app.ai_route_group_preferences enable row level security;
alter table app.ai_effective_route_snapshots enable row level security;
alter table app.ai_provider_connection_tests enable row level security;

create policy ai_secret_refs_select_safe_metadata
  on app.ai_secret_refs
  for select
  to authenticated
  using (
    workspace_id is not null
    and (
      public.has_workspace_permission(workspace_id, 'settings.ai.view')
      or owner_user_id = auth.uid()
    )
  );

create policy ai_route_group_preferences_select
  on app.ai_route_group_preferences
  for select
  to authenticated
  using (
    workspace_id is not null
    and public.has_workspace_permission(workspace_id, 'settings.ai.view')
  );

create policy ai_effective_route_snapshots_select
  on app.ai_effective_route_snapshots
  for select
  to authenticated
  using (
    public.has_workspace_permission(workspace_id, 'settings.ai.effective_policy.view')
  );

create policy ai_provider_connection_tests_select
  on app.ai_provider_connection_tests
  for select
  to authenticated
  using (
    public.has_workspace_permission(workspace_id, 'settings.ai.view')
  );

grant select on app.ai_secret_refs, app.ai_route_group_preferences, app.ai_effective_route_snapshots, app.ai_provider_connection_tests to authenticated;
