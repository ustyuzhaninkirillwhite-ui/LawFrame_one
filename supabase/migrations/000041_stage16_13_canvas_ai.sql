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
  ('canvas.ai.use', 'Use Canvas AI Assistant', 'Use the Canvas AI Assistant with redacted Canvas context.', 'canvas', false),
  ('canvas.ai.explain', 'Explain Canvas with AI', 'Request Canvas workflow explanations from AI.', 'canvas', false),
  ('canvas.ai.propose_patch', 'Propose Canvas AI patch', 'Ask AI to propose CanvasOperation patches without applying them.', 'canvas', false),
  ('canvas.ai.apply_patch', 'Apply Canvas AI patch', 'Apply a reviewed AI patch through CanvasOperationService.', 'canvas', true),
  ('canvas.ai.configure_step', 'Configure Canvas step with AI', 'Ask AI to propose bindings and configuration for a selected step.', 'canvas', false),
  ('canvas.ai.fix_validation', 'Fix Canvas validation with AI', 'Ask AI to propose fixes for Canvas validation issues.', 'canvas', false),
  ('canvas.ai.debug_test', 'Debug Canvas test with AI', 'Ask AI to explain redacted Canvas test failures.', 'canvas', false),
  ('canvas.ai.view_raw_context', 'View raw Canvas AI context', 'View full Canvas AI context diagnostics.', 'canvas', true),
  ('canvas.ai.use_sensitive_context', 'Use sensitive Canvas AI context', 'Permit sensitive redacted context expansion through AI policy gates.', 'canvas', true),
  ('canvas.ai.admin_diagnostics', 'Admin Canvas AI diagnostics', 'View Canvas AI tool traces and administrative diagnostics.', 'canvas', true)
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
    ('owner', 'canvas.ai.use'),
    ('owner', 'canvas.ai.explain'),
    ('owner', 'canvas.ai.propose_patch'),
    ('owner', 'canvas.ai.apply_patch'),
    ('owner', 'canvas.ai.configure_step'),
    ('owner', 'canvas.ai.fix_validation'),
    ('owner', 'canvas.ai.debug_test'),
    ('owner', 'canvas.ai.view_raw_context'),
    ('owner', 'canvas.ai.use_sensitive_context'),
    ('owner', 'canvas.ai.admin_diagnostics'),
    ('admin', 'canvas.ai.use'),
    ('admin', 'canvas.ai.explain'),
    ('admin', 'canvas.ai.propose_patch'),
    ('admin', 'canvas.ai.apply_patch'),
    ('admin', 'canvas.ai.configure_step'),
    ('admin', 'canvas.ai.fix_validation'),
    ('admin', 'canvas.ai.debug_test'),
    ('admin', 'canvas.ai.view_raw_context'),
    ('admin', 'canvas.ai.use_sensitive_context'),
    ('admin', 'canvas.ai.admin_diagnostics'),
    ('lawyer', 'canvas.ai.use'),
    ('lawyer', 'canvas.ai.explain'),
    ('lawyer', 'canvas.ai.propose_patch'),
    ('lawyer', 'canvas.ai.apply_patch'),
    ('lawyer', 'canvas.ai.configure_step'),
    ('lawyer', 'canvas.ai.fix_validation'),
    ('lawyer', 'canvas.ai.debug_test'),
    ('assistant', 'canvas.ai.use'),
    ('assistant', 'canvas.ai.explain'),
    ('assistant', 'canvas.ai.propose_patch'),
    ('assistant', 'canvas.ai.configure_step'),
    ('assistant', 'canvas.ai.fix_validation'),
    ('viewer', 'canvas.ai.use'),
    ('viewer', 'canvas.ai.explain')
) as grants(role_code, permission_code)
on conflict (role_code, permission_code) do nothing;

create table if not exists app.canvas_ai_sessions (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  automation_id uuid not null references app.installed_automations(id) on delete cascade,
  draft_version_id uuid null references app.automation_canvas_drafts(id) on delete set null,
  actor_user_id uuid not null references app.profiles(id) on delete restrict,
  mode text not null check (mode in ('explain', 'edit', 'fix_validation', 'configure_step', 'test_plan', 'debug_test')),
  status text not null default 'active' check (status in ('active', 'closed')),
  title text not null default 'Canvas AI session',
  safe_context_hash text null,
  last_message_at timestamptz null,
  trace_id text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.canvas_ai_messages (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  automation_id uuid not null references app.installed_automations(id) on delete cascade,
  draft_version_id uuid null references app.automation_canvas_drafts(id) on delete set null,
  session_id uuid not null references app.canvas_ai_sessions(id) on delete cascade,
  actor_user_id uuid null references app.profiles(id) on delete set null,
  role text not null check (role in ('user', 'assistant', 'tool', 'system')),
  mode text not null check (mode in ('explain', 'edit', 'fix_validation', 'configure_step', 'test_plan', 'debug_test')),
  response_type text null,
  content_preview text not null default '',
  content_hash text null,
  safe_metadata jsonb not null default '{}'::jsonb,
  redaction_codes text[] not null default '{}'::text[],
  trace_id text null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.canvas_ai_patch_proposals (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  automation_id uuid not null references app.installed_automations(id) on delete cascade,
  draft_version_id uuid not null references app.automation_canvas_drafts(id) on delete cascade,
  session_id uuid not null references app.canvas_ai_sessions(id) on delete cascade,
  created_by_user_id uuid not null references app.profiles(id) on delete restrict,
  status text not null check (
    status in (
      'needs_clarification',
      'validation_failed',
      'policy_blocked',
      'ready_for_review',
      'applied',
      'rejected',
      'expired'
    )
  ),
  title text not null,
  user_request_hash text not null,
  user_request_preview text not null,
  assistant_summary text not null,
  base_workflow_hash text not null,
  proposed_workflow_hash text null,
  operations jsonb not null default '[]'::jsonb,
  operation_types text[] not null default '{}'::text[],
  module_codes text[] not null default '{}'::text[],
  validation_summary jsonb not null default '{}'::jsonb,
  policy_result jsonb not null default '{}'::jsonb,
  diff_summary jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null default timezone('utc', now()) + interval '30 minutes',
  applied_at timestamptz null,
  rejected_at timestamptz null,
  rejection_reason text null,
  trace_id text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.canvas_ai_tool_calls (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  automation_id uuid not null references app.installed_automations(id) on delete cascade,
  draft_version_id uuid null references app.automation_canvas_drafts(id) on delete set null,
  session_id uuid not null references app.canvas_ai_sessions(id) on delete cascade,
  patch_proposal_id uuid null references app.canvas_ai_patch_proposals(id) on delete cascade,
  tool_name text not null,
  status text not null check (status in ('requested', 'succeeded', 'failed', 'blocked')),
  input_hash text null,
  result_hash text null,
  safe_input jsonb not null default '{}'::jsonb,
  safe_result jsonb not null default '{}'::jsonb,
  redaction_codes text[] not null default '{}'::text[],
  trace_id text null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.canvas_ai_audit_events (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  automation_id uuid not null references app.installed_automations(id) on delete cascade,
  draft_version_id uuid null references app.automation_canvas_drafts(id) on delete set null,
  session_id uuid null references app.canvas_ai_sessions(id) on delete set null,
  patch_proposal_id uuid null references app.canvas_ai_patch_proposals(id) on delete set null,
  actor_user_id uuid null references app.profiles(id) on delete set null,
  event_name text not null,
  policy_codes text[] not null default '{}'::text[],
  safe_metadata jsonb not null default '{}'::jsonb,
  trace_id text null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_canvas_ai_sessions_lookup
  on app.canvas_ai_sessions (workspace_id, automation_id, draft_version_id, status, created_at desc);

create index if not exists idx_canvas_ai_messages_session
  on app.canvas_ai_messages (workspace_id, session_id, created_at asc);

create index if not exists idx_canvas_ai_messages_automation
  on app.canvas_ai_messages (workspace_id, automation_id, draft_version_id, created_at desc);

create index if not exists idx_canvas_ai_patch_proposals_lookup
  on app.canvas_ai_patch_proposals (workspace_id, automation_id, draft_version_id, session_id, status, created_at desc);

create index if not exists idx_canvas_ai_patch_proposals_expiry
  on app.canvas_ai_patch_proposals (status, expires_at);

create index if not exists idx_canvas_ai_tool_calls_lookup
  on app.canvas_ai_tool_calls (workspace_id, automation_id, draft_version_id, session_id, status, created_at desc);

create index if not exists idx_canvas_ai_audit_events_lookup
  on app.canvas_ai_audit_events (workspace_id, automation_id, draft_version_id, session_id, created_at desc);

alter table app.canvas_ai_sessions enable row level security;
alter table app.canvas_ai_messages enable row level security;
alter table app.canvas_ai_patch_proposals enable row level security;
alter table app.canvas_ai_tool_calls enable row level security;
alter table app.canvas_ai_audit_events enable row level security;

drop policy if exists canvas_ai_sessions_select_user on app.canvas_ai_sessions;
create policy canvas_ai_sessions_select_user
  on app.canvas_ai_sessions
  for select
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'canvas.ai.use'));

drop policy if exists canvas_ai_sessions_insert_user on app.canvas_ai_sessions;
create policy canvas_ai_sessions_insert_user
  on app.canvas_ai_sessions
  for insert
  to authenticated
  with check (public.has_workspace_permission(workspace_id, 'canvas.ai.use'));

drop policy if exists canvas_ai_messages_select_user on app.canvas_ai_messages;
create policy canvas_ai_messages_select_user
  on app.canvas_ai_messages
  for select
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'canvas.ai.use'));

drop policy if exists canvas_ai_messages_insert_user on app.canvas_ai_messages;
create policy canvas_ai_messages_insert_user
  on app.canvas_ai_messages
  for insert
  to authenticated
  with check (public.has_workspace_permission(workspace_id, 'canvas.ai.use'));

drop policy if exists canvas_ai_patch_proposals_select_user on app.canvas_ai_patch_proposals;
create policy canvas_ai_patch_proposals_select_user
  on app.canvas_ai_patch_proposals
  for select
  to authenticated
  using (
    public.has_workspace_permission(workspace_id, 'canvas.ai.propose_patch')
    or public.has_workspace_permission(workspace_id, 'canvas.ai.explain')
  );

drop policy if exists canvas_ai_patch_proposals_insert_proposer on app.canvas_ai_patch_proposals;
create policy canvas_ai_patch_proposals_insert_proposer
  on app.canvas_ai_patch_proposals
  for insert
  to authenticated
  with check (public.has_workspace_permission(workspace_id, 'canvas.ai.propose_patch'));

drop policy if exists canvas_ai_patch_proposals_update_applier on app.canvas_ai_patch_proposals;
create policy canvas_ai_patch_proposals_update_applier
  on app.canvas_ai_patch_proposals
  for update
  to authenticated
  using (
    public.has_workspace_permission(workspace_id, 'canvas.ai.apply_patch')
    or public.has_workspace_permission(workspace_id, 'canvas.ai.propose_patch')
  )
  with check (
    public.has_workspace_permission(workspace_id, 'canvas.ai.apply_patch')
    or public.has_workspace_permission(workspace_id, 'canvas.ai.propose_patch')
  );

drop policy if exists canvas_ai_tool_calls_select_admin on app.canvas_ai_tool_calls;
create policy canvas_ai_tool_calls_select_admin
  on app.canvas_ai_tool_calls
  for select
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'canvas.ai.admin_diagnostics'));

drop policy if exists canvas_ai_tool_calls_insert_user on app.canvas_ai_tool_calls;
create policy canvas_ai_tool_calls_insert_user
  on app.canvas_ai_tool_calls
  for insert
  to authenticated
  with check (public.has_workspace_permission(workspace_id, 'canvas.ai.use'));

drop policy if exists canvas_ai_audit_events_select_auditor on app.canvas_ai_audit_events;
create policy canvas_ai_audit_events_select_auditor
  on app.canvas_ai_audit_events
  for select
  to authenticated
  using (
    public.has_workspace_permission(workspace_id, 'audit.read')
    or public.has_workspace_permission(workspace_id, 'canvas.ai.admin_diagnostics')
  );

drop policy if exists canvas_ai_audit_events_insert_user on app.canvas_ai_audit_events;
create policy canvas_ai_audit_events_insert_user
  on app.canvas_ai_audit_events
  for insert
  to authenticated
  with check (public.has_workspace_permission(workspace_id, 'canvas.ai.use'));

grant select, insert, update on app.canvas_ai_sessions to authenticated;
grant select, insert on app.canvas_ai_messages to authenticated;
grant select, insert, update on app.canvas_ai_patch_proposals to authenticated;
grant select, insert on app.canvas_ai_tool_calls to authenticated;
grant select, insert on app.canvas_ai_audit_events to authenticated;
