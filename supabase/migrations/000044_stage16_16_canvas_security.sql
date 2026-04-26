insert into app.permissions (code, label, description, scope, high_risk)
values
  ('canvas.add_node', 'Add Canvas node', 'Add nodes to a Canvas draft.', 'canvas', false),
  ('canvas.delete_node', 'Delete Canvas node', 'Delete nodes from a Canvas draft.', 'canvas', true),
  ('canvas.add_edge', 'Add Canvas edge', 'Create Canvas graph edges.', 'canvas', false),
  ('canvas.delete_edge', 'Delete Canvas edge', 'Delete Canvas graph edges.', 'canvas', true),
  ('canvas.edit_layout', 'Edit Canvas layout', 'Move nodes and update Canvas viewport layout.', 'canvas', false),
  ('canvas.edit_node_config', 'Edit Canvas node config', 'Update non-secret Canvas node configuration.', 'canvas', true),
  ('canvas.edit_bindings', 'Edit Canvas bindings', 'Create and modify Canvas data bindings.', 'canvas', true),
  ('canvas.edit_conditions', 'Edit Canvas conditions', 'Create and modify Canvas condition and branch rules.', 'canvas', true),
  ('canvas.edit_error_handlers', 'Edit Canvas error handlers', 'Create and modify Canvas error handling paths.', 'canvas', true),
  ('canvas.edit_approval_gates', 'Edit Canvas approval gates', 'Create and modify Canvas approval gates.', 'canvas', true),
  ('canvas.edit_delivery_steps', 'Edit Canvas delivery steps', 'Create and modify Canvas external delivery steps.', 'canvas', true),
  ('canvas.edit_ai_steps', 'Edit Canvas AI steps', 'Create and modify Canvas AI steps routed through AI Gateway.', 'canvas', true),
  ('canvas.edit_runtime_mapping', 'Edit Canvas runtime mapping', 'Edit Canvas to runtime mapping metadata.', 'canvas', true),
  ('canvas.compile', 'Compile Canvas', 'Compile a Canvas draft into runtime projection artifacts.', 'canvas', true),
  ('canvas.sync_runtime', 'Sync Canvas runtime', 'Synchronize compiled Canvas runtime with Activepieces.', 'canvas', true),
  ('canvas.view_compile_preview', 'View Canvas compile preview', 'View redacted Canvas compile previews.', 'canvas', false),
  ('canvas.resolve_sync_conflict', 'Resolve Canvas sync conflict', 'Resolve Canvas runtime sync conflicts.', 'canvas', true),
  ('canvas.policy_override', 'Override Canvas policy warning', 'Request or approve override for Canvas policy warnings.', 'canvas', true),
  ('canvas.security_review', 'Review Canvas security', 'Perform Canvas security reviews and runtime import decisions.', 'canvas', true),
  ('canvas.audit_read', 'Read Canvas audit', 'Read Canvas-specific audit events.', 'canvas', true),
  ('canvas.audit_export', 'Export Canvas audit', 'Export Canvas-specific audit events.', 'canvas', true),
  ('canvas.connection_view', 'View Canvas connections', 'View Canvas connection requirements and safe metadata.', 'canvas', false),
  ('canvas.connection_request', 'Request Canvas connection', 'Request a connection required by Canvas.', 'canvas', false),
  ('canvas.connection_manage', 'Manage Canvas connections', 'Approve or manage connections required by Canvas.', 'canvas', true)
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
    ('owner', 'canvas.add_node'),
    ('owner', 'canvas.delete_node'),
    ('owner', 'canvas.add_edge'),
    ('owner', 'canvas.delete_edge'),
    ('owner', 'canvas.edit_layout'),
    ('owner', 'canvas.edit_node_config'),
    ('owner', 'canvas.edit_bindings'),
    ('owner', 'canvas.edit_conditions'),
    ('owner', 'canvas.edit_error_handlers'),
    ('owner', 'canvas.edit_approval_gates'),
    ('owner', 'canvas.edit_delivery_steps'),
    ('owner', 'canvas.edit_ai_steps'),
    ('owner', 'canvas.edit_runtime_mapping'),
    ('owner', 'canvas.compile'),
    ('owner', 'canvas.sync_runtime'),
    ('owner', 'canvas.view_compile_preview'),
    ('owner', 'canvas.resolve_sync_conflict'),
    ('owner', 'canvas.policy_override'),
    ('owner', 'canvas.security_review'),
    ('owner', 'canvas.audit_read'),
    ('owner', 'canvas.audit_export'),
    ('owner', 'canvas.connection_view'),
    ('owner', 'canvas.connection_request'),
    ('owner', 'canvas.connection_manage'),
    ('admin', 'canvas.add_node'),
    ('admin', 'canvas.delete_node'),
    ('admin', 'canvas.add_edge'),
    ('admin', 'canvas.delete_edge'),
    ('admin', 'canvas.edit_layout'),
    ('admin', 'canvas.edit_node_config'),
    ('admin', 'canvas.edit_bindings'),
    ('admin', 'canvas.edit_conditions'),
    ('admin', 'canvas.edit_error_handlers'),
    ('admin', 'canvas.edit_approval_gates'),
    ('admin', 'canvas.edit_delivery_steps'),
    ('admin', 'canvas.edit_ai_steps'),
    ('admin', 'canvas.edit_runtime_mapping'),
    ('admin', 'canvas.compile'),
    ('admin', 'canvas.sync_runtime'),
    ('admin', 'canvas.view_compile_preview'),
    ('admin', 'canvas.resolve_sync_conflict'),
    ('admin', 'canvas.policy_override'),
    ('admin', 'canvas.security_review'),
    ('admin', 'canvas.audit_read'),
    ('admin', 'canvas.audit_export'),
    ('admin', 'canvas.connection_view'),
    ('admin', 'canvas.connection_request'),
    ('admin', 'canvas.connection_manage'),
    ('security_admin', 'canvas.view_compile_preview'),
    ('security_admin', 'canvas.policy_override'),
    ('security_admin', 'canvas.security_review'),
    ('security_admin', 'canvas.audit_read'),
    ('security_admin', 'canvas.audit_export'),
    ('security_admin', 'canvas.connection_view'),
    ('security_admin', 'canvas.connection_manage'),
    ('lawyer', 'canvas.add_node'),
    ('lawyer', 'canvas.delete_node'),
    ('lawyer', 'canvas.add_edge'),
    ('lawyer', 'canvas.delete_edge'),
    ('lawyer', 'canvas.edit_layout'),
    ('lawyer', 'canvas.edit_node_config'),
    ('lawyer', 'canvas.edit_bindings'),
    ('lawyer', 'canvas.edit_conditions'),
    ('lawyer', 'canvas.edit_error_handlers'),
    ('lawyer', 'canvas.edit_approval_gates'),
    ('lawyer', 'canvas.edit_delivery_steps'),
    ('lawyer', 'canvas.edit_ai_steps'),
    ('lawyer', 'canvas.view_compile_preview'),
    ('lawyer', 'canvas.connection_view'),
    ('lawyer', 'canvas.connection_request'),
    ('assistant', 'canvas.add_node'),
    ('assistant', 'canvas.add_edge'),
    ('assistant', 'canvas.edit_layout'),
    ('assistant', 'canvas.edit_node_config'),
    ('assistant', 'canvas.edit_bindings'),
    ('assistant', 'canvas.view_compile_preview'),
    ('assistant', 'canvas.connection_view'),
    ('assistant', 'canvas.connection_request'),
    ('viewer', 'canvas.connection_view')
) as grants(role_code, permission_code)
on conflict (role_code, permission_code) do nothing;

create table if not exists app.canvas_security_policies (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  automation_id uuid null references app.installed_automations(id) on delete cascade,
  code text not null,
  title text not null,
  description text null,
  severity text not null default 'high' check (severity in ('low', 'medium', 'high', 'critical')),
  enforcement text not null default 'block' check (enforcement in ('warn', 'block', 'review_required')),
  enabled boolean not null default true,
  allow_override boolean not null default false,
  policy jsonb not null default '{}'::jsonb,
  created_by uuid null references app.profiles(id) on delete set null,
  updated_by uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, automation_id, code)
);

create table if not exists app.canvas_policy_violations (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  automation_id uuid not null references app.installed_automations(id) on delete cascade,
  draft_version_id uuid null references app.automation_canvas_drafts(id) on delete set null,
  policy_id uuid null references app.canvas_security_policies(id) on delete set null,
  policy_code text not null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  resource_type text not null,
  resource_id text null,
  operation_type text null,
  operation_id uuid null references app.automation_canvas_operations(id) on delete set null,
  decision jsonb not null default '{}'::jsonb,
  safe_evidence jsonb not null default '{}'::jsonb,
  evidence_hash text null,
  status text not null default 'open' check (status in ('open', 'overridden', 'resolved', 'blocked')),
  created_by uuid null references app.profiles(id) on delete set null,
  resolved_by uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz null
);

create table if not exists app.canvas_policy_override_requests (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  automation_id uuid not null references app.installed_automations(id) on delete cascade,
  violation_id uuid null references app.canvas_policy_violations(id) on delete set null,
  policy_code text not null,
  requested_action text not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired')),
  requested_by uuid not null references app.profiles(id) on delete restrict,
  decided_by uuid null references app.profiles(id) on delete set null,
  decision_reason text null,
  expires_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  decided_at timestamptz null
);

create table if not exists app.canvas_runtime_import_reviews (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  automation_id uuid not null references app.installed_automations(id) on delete cascade,
  runtime_snapshot_id uuid null references app.activepieces_flow_snapshots(id) on delete set null,
  draft_candidate_id uuid null references app.automation_import_candidates(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'blocked', 'superseded')),
  risk_level text not null default 'high' check (risk_level in ('low', 'medium', 'high', 'critical')),
  diff_summary jsonb not null default '{}'::jsonb,
  policy_decision jsonb not null default '{}'::jsonb,
  blocked_codes text[] not null default '{}'::text[],
  created_by uuid null references app.profiles(id) on delete set null,
  reviewed_by uuid null references app.profiles(id) on delete set null,
  review_reason text null,
  created_at timestamptz not null default timezone('utc', now()),
  reviewed_at timestamptz null
);

alter table app.activepieces_embed_sessions
  add column if not exists jti_hash text null,
  add column if not exists canvas_role text null,
  add column if not exists issued_for_automation_id uuid null references app.installed_automations(id) on delete set null,
  add column if not exists issued_for_version_id uuid null references app.automation_canvas_versions(id) on delete set null,
  add column if not exists revoked_at timestamptz null,
  add column if not exists issued_reason text null;

create unique index if not exists idx_activepieces_embed_sessions_jti_hash
  on app.activepieces_embed_sessions (jti_hash)
  where jti_hash is not null;

create index if not exists idx_canvas_security_policies_lookup
  on app.canvas_security_policies (workspace_id, automation_id, code);

create index if not exists idx_canvas_policy_violations_lookup
  on app.canvas_policy_violations (workspace_id, automation_id, status, created_at desc);

create index if not exists idx_canvas_policy_override_requests_lookup
  on app.canvas_policy_override_requests (workspace_id, automation_id, status, created_at desc);

create index if not exists idx_canvas_runtime_import_reviews_lookup
  on app.canvas_runtime_import_reviews (workspace_id, automation_id, status, created_at desc);

alter table app.canvas_security_policies enable row level security;
alter table app.canvas_policy_violations enable row level security;
alter table app.canvas_policy_override_requests enable row level security;
alter table app.canvas_runtime_import_reviews enable row level security;

drop policy if exists canvas_security_policies_select_reviewer on app.canvas_security_policies;
create policy canvas_security_policies_select_reviewer
  on app.canvas_security_policies
  for select
  to authenticated
  using (
    public.has_workspace_permission(workspace_id, 'canvas.security_review')
    or public.has_workspace_permission(workspace_id, 'canvas.view')
  );

drop policy if exists canvas_security_policies_backend_only_insert on app.canvas_security_policies;
create policy canvas_security_policies_backend_only_insert
  on app.canvas_security_policies
  for insert
  to authenticated
  with check (false);

drop policy if exists canvas_security_policies_backend_only_update on app.canvas_security_policies;
create policy canvas_security_policies_backend_only_update
  on app.canvas_security_policies
  for update
  to authenticated
  using (false)
  with check (false);

drop policy if exists canvas_policy_violations_select_reviewer on app.canvas_policy_violations;
create policy canvas_policy_violations_select_reviewer
  on app.canvas_policy_violations
  for select
  to authenticated
  using (
    public.has_workspace_permission(workspace_id, 'canvas.security_review')
    or public.has_workspace_permission(workspace_id, 'canvas.audit_read')
  );

drop policy if exists canvas_policy_violations_backend_only_insert on app.canvas_policy_violations;
create policy canvas_policy_violations_backend_only_insert
  on app.canvas_policy_violations
  for insert
  to authenticated
  with check (false);

drop policy if exists canvas_policy_violations_backend_only_update on app.canvas_policy_violations;
create policy canvas_policy_violations_backend_only_update
  on app.canvas_policy_violations
  for update
  to authenticated
  using (false)
  with check (false);

drop policy if exists canvas_policy_override_requests_select_reviewer on app.canvas_policy_override_requests;
create policy canvas_policy_override_requests_select_reviewer
  on app.canvas_policy_override_requests
  for select
  to authenticated
  using (
    public.has_workspace_permission(workspace_id, 'canvas.security_review')
    or public.has_workspace_permission(workspace_id, 'canvas.policy_override')
  );

drop policy if exists canvas_policy_override_requests_backend_only_insert on app.canvas_policy_override_requests;
create policy canvas_policy_override_requests_backend_only_insert
  on app.canvas_policy_override_requests
  for insert
  to authenticated
  with check (false);

drop policy if exists canvas_policy_override_requests_backend_only_update on app.canvas_policy_override_requests;
create policy canvas_policy_override_requests_backend_only_update
  on app.canvas_policy_override_requests
  for update
  to authenticated
  using (false)
  with check (false);

drop policy if exists canvas_runtime_import_reviews_select_reviewer on app.canvas_runtime_import_reviews;
create policy canvas_runtime_import_reviews_select_reviewer
  on app.canvas_runtime_import_reviews
  for select
  to authenticated
  using (
    public.has_workspace_permission(workspace_id, 'canvas.security_review')
    or public.has_workspace_permission(workspace_id, 'canvas.runtime.resolve_conflict')
    or public.has_workspace_permission(workspace_id, 'canvas.resolve_sync_conflict')
  );

drop policy if exists canvas_runtime_import_reviews_backend_only_insert on app.canvas_runtime_import_reviews;
create policy canvas_runtime_import_reviews_backend_only_insert
  on app.canvas_runtime_import_reviews
  for insert
  to authenticated
  with check (false);

drop policy if exists canvas_runtime_import_reviews_backend_only_update on app.canvas_runtime_import_reviews;
create policy canvas_runtime_import_reviews_backend_only_update
  on app.canvas_runtime_import_reviews
  for update
  to authenticated
  using (false)
  with check (false);

drop policy if exists audit_events_canvas_read on audit.audit_events;
create policy audit_events_canvas_read
  on audit.audit_events
  for select
  to authenticated
  using (
    workspace_id is not null
    and (
      public.has_workspace_permission(workspace_id, 'canvas.audit_read')
      or public.has_workspace_permission(workspace_id, 'canvas.audit_export')
    )
    and (
      action like 'canvas.%'
      or event_category like 'canvas.%'
    )
  );

grant select on app.canvas_security_policies to authenticated;
grant select on app.canvas_policy_violations to authenticated;
grant select on app.canvas_policy_override_requests to authenticated;
grant select on app.canvas_runtime_import_reviews to authenticated;
