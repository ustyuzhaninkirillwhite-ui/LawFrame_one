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
  (
    'canvas.override_policy',
    'Override Canvas validation policy',
    'Approve exceptional Canvas policy overrides with audit trail.',
    'canvas',
    true
  )
on conflict (code) do update
set
  label = excluded.label,
  description = excluded.description,
  scope = excluded.scope,
  high_risk = excluded.high_risk;

insert into app.role_permissions (role_code, permission_code)
values
  ('owner', 'canvas.override_policy'),
  ('admin', 'canvas.override_policy')
on conflict (role_code, permission_code) do nothing;

alter table app.automation_canvas_validation_results
  add column if not exists workflow_hash text null,
  add column if not exists mode text null,
  add column if not exists reason text null,
  add column if not exists source text not null default 'backend',
  add column if not exists cache_key text null,
  add column if not exists started_at timestamptz null,
  add column if not exists finished_at timestamptz null,
  add column if not exists duration_ms integer null;

alter table app.automation_canvas_validation_results
  drop constraint if exists automation_canvas_validation_results_validation_level_check;

alter table app.automation_canvas_validation_results
  add constraint automation_canvas_validation_results_validation_level_check
  check (
    validation_level in (
      'fast',
      'full',
      'publish_gate',
      'runtime_gate',
      'operation_preview',
      'field_level'
    )
  );

update app.automation_canvas_validation_results
set
  mode = coalesce(mode, validation_level),
  started_at = coalesce(started_at, created_at),
  finished_at = coalesce(finished_at, created_at),
  duration_ms = coalesce(duration_ms, 0)
where mode is null
   or started_at is null
   or finished_at is null
   or duration_ms is null;

alter table app.automation_canvas_validation_results
  alter column mode set default 'fast',
  alter column started_at set default timezone('utc', now());

create table if not exists app.automation_canvas_validation_issues (
  id uuid primary key default public.app_uuid_v7(),
  issue_id text not null,
  validation_run_id uuid not null references app.automation_canvas_validation_results(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  installed_automation_id uuid not null references app.installed_automations(id) on delete cascade,
  draft_version_id uuid null references app.automation_canvas_drafts(id) on delete cascade,
  code text not null,
  category text not null check (
    category in (
      'structure',
      'schema',
      'type_compatibility',
      'semantic',
      'security',
      'policy',
      'runtime',
      'ux',
      'performance'
    )
  ),
  severity text not null check (severity in ('info', 'warning', 'error', 'policy_block')),
  message text not null,
  developer_message text null,
  node_id text null,
  edge_id text null,
  binding_id text null,
  input_key text null,
  field_path text null,
  blocks text[] not null default '{}',
  suggested_fixes jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (validation_run_id, issue_id)
);

create table if not exists app.automation_canvas_validation_rule_registry (
  code text primary key,
  category text not null,
  severity_default text not null check (severity_default in ('info', 'warning', 'error', 'policy_block')),
  description text not null,
  applies_to text[] not null default '{}',
  enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.automation_canvas_policy_overrides (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  installed_automation_id uuid not null references app.installed_automations(id) on delete cascade,
  validation_issue_id uuid null references app.automation_canvas_validation_issues(id) on delete set null,
  issue_code text not null,
  reason text not null,
  approved_by uuid not null references app.profiles(id) on delete restrict,
  expires_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  check (
    issue_code not in (
      'WF_POLICY_001_EXTERNAL_ACTION_REQUIRES_APPROVAL',
      'WF_POLICY_002_AI_ROUTE_FORBIDDEN_FOR_DATA_CLASS',
      'WF_POLICY_005_SECRET_VALUE_IN_CONFIG',
      'WF_POLICY_006_DIRECT_SUPABASE_SERVICE_ROLE_FORBIDDEN',
      'WF_POLICY_010_SIGNED_URL_IN_CONFIG_FORBIDDEN'
    )
  )
);

create index if not exists idx_canvas_validation_results_cache
  on app.automation_canvas_validation_results (workspace_id, installed_automation_id, cache_key, created_at desc)
  where cache_key is not null;

create index if not exists idx_canvas_validation_issues_run
  on app.automation_canvas_validation_issues (validation_run_id, severity, code);

create index if not exists idx_canvas_validation_issues_issue_id
  on app.automation_canvas_validation_issues (workspace_id, installed_automation_id, issue_id, created_at desc);

create index if not exists idx_canvas_validation_issues_node
  on app.automation_canvas_validation_issues (draft_version_id, node_id, created_at desc)
  where node_id is not null;

create index if not exists idx_canvas_policy_overrides_lookup
  on app.automation_canvas_policy_overrides (workspace_id, installed_automation_id, issue_code, expires_at);

alter table app.automation_canvas_validation_issues enable row level security;
alter table app.automation_canvas_validation_rule_registry enable row level security;
alter table app.automation_canvas_policy_overrides enable row level security;

drop policy if exists automation_canvas_validation_issues_select_viewer on app.automation_canvas_validation_issues;
create policy automation_canvas_validation_issues_select_viewer
  on app.automation_canvas_validation_issues
  for select
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'canvas.view_validation'));

drop policy if exists automation_canvas_validation_issues_insert_editor on app.automation_canvas_validation_issues;
create policy automation_canvas_validation_issues_insert_editor
  on app.automation_canvas_validation_issues
  for insert
  to authenticated
  with check (public.has_workspace_permission(workspace_id, 'canvas.edit'));

drop policy if exists automation_canvas_validation_rule_registry_select_viewer on app.automation_canvas_validation_rule_registry;
create policy automation_canvas_validation_rule_registry_select_viewer
  on app.automation_canvas_validation_rule_registry
  for select
  to authenticated
  using (true);

drop policy if exists automation_canvas_policy_overrides_select_viewer on app.automation_canvas_policy_overrides;
create policy automation_canvas_policy_overrides_select_viewer
  on app.automation_canvas_policy_overrides
  for select
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'canvas.view_validation'));

drop policy if exists automation_canvas_policy_overrides_insert_admin on app.automation_canvas_policy_overrides;
create policy automation_canvas_policy_overrides_insert_admin
  on app.automation_canvas_policy_overrides
  for insert
  to authenticated
  with check (public.has_workspace_permission(workspace_id, 'canvas.override_policy'));

grant select, insert on app.automation_canvas_validation_issues to authenticated;
grant select on app.automation_canvas_validation_rule_registry to authenticated;
grant select, insert on app.automation_canvas_policy_overrides to authenticated;

insert into app.automation_canvas_validation_rule_registry (
  code,
  category,
  severity_default,
  description,
  applies_to
)
values
  ('WF_STRUCTURE_001_TRIGGER_REQUIRED', 'structure', 'error', 'Workflow must have a trigger node.', array['workflow']),
  ('WF_STRUCTURE_002_SINGLE_PRIMARY_TRIGGER', 'structure', 'error', 'Guided Canvas mode supports a single primary trigger.', array['workflow']),
  ('WF_STRUCTURE_003_END_NODE_REQUIRED', 'structure', 'error', 'Workflow must have an end node.', array['workflow']),
  ('WF_STRUCTURE_004_NO_DISCONNECTED_NODE', 'structure', 'error', 'All runtime nodes must be reachable from the trigger.', array['node']),
  ('WF_STRUCTURE_005_EDGE_TARGET_EXISTS', 'structure', 'error', 'Edges must reference existing source and target nodes.', array['edge']),
  ('WF_STRUCTURE_006_HANDLE_EXISTS', 'structure', 'error', 'Edges must reference existing source and target handles.', array['edge']),
  ('WF_STRUCTURE_007_NO_UNSUPPORTED_CYCLE', 'structure', 'error', 'Unsupported control-flow cycles are forbidden outside loop blocks.', array['workflow']),
  ('WF_STRUCTURE_008_ROUTER_FALLBACK_REQUIRED', 'structure', 'warning', 'Router and condition blocks should have a fallback branch.', array['node']),
  ('WF_STRUCTURE_009_LOOP_BODY_REQUIRED', 'structure', 'error', 'Loop blocks must have a loop body and an after-loop path.', array['node']),
  ('WF_STRUCTURE_010_MERGE_INPUTS_REQUIRED', 'structure', 'error', 'Merge blocks must have at least two incoming branch inputs.', array['node']),
  ('WF_SCHEMA_001_WORKFLOW_SCHEMA_INVALID', 'schema', 'error', 'Workflow DSL does not match the canonical Canvas schema.', array['workflow']),
  ('WF_SCHEMA_002_NODE_SCHEMA_INVALID', 'schema', 'error', 'Canvas node does not match the canonical node schema.', array['node']),
  ('WF_SCHEMA_003_EDGE_SCHEMA_INVALID', 'schema', 'error', 'Canvas edge does not match the canonical edge schema.', array['edge']),
  ('WF_SCHEMA_004_NODE_CONFIG_INVALID', 'schema', 'error', 'Node config does not match the module config schema.', array['node']),
  ('WF_SCHEMA_005_CONDITION_SCHEMA_INVALID', 'schema', 'error', 'Condition expression schema is invalid.', array['edge']),
  ('WF_SCHEMA_006_BINDING_SCHEMA_INVALID', 'schema', 'error', 'Input binding schema is invalid.', array['binding']),
  ('WF_TYPE_001_REQUIRED_INPUT_MISSING', 'type_compatibility', 'error', 'Required step input must have a binding or configured default.', array['binding']),
  ('WF_TYPE_002_OUTPUT_NOT_FOUND', 'type_compatibility', 'error', 'Input binding references a missing source output.', array['binding']),
  ('WF_TYPE_003_INPUT_NOT_FOUND', 'type_compatibility', 'error', 'Input binding references a missing target input.', array['binding']),
  ('WF_TYPE_004_INCOMPATIBLE_TYPES', 'type_compatibility', 'error', 'Source output type is incompatible with target input type.', array['binding']),
  ('WF_TYPE_005_NULLABLE_TO_REQUIRED_WITHOUT_FALLBACK', 'type_compatibility', 'error', 'Nullable source cannot feed a required input without fallback.', array['binding']),
  ('WF_TYPE_006_ARRAY_TO_SCALAR_WITHOUT_TRANSFORM', 'type_compatibility', 'error', 'Array source must declare selection or transform for scalar input.', array['binding']),
  ('WF_TYPE_007_ENUM_VALUE_INVALID', 'type_compatibility', 'error', 'Configured enum value is not allowed.', array['node']),
  ('WF_LEGAL_001_CLAIM_DRAFT_REQUIRES_FACTS', 'semantic', 'error', 'Claim drafting modules require facts.', array['node']),
  ('WF_LEGAL_002_PRETRIAL_CLAIM_REQUIRES_COUNTERPARTY', 'semantic', 'error', 'Pretrial claim drafting requires a counterparty.', array['node']),
  ('WF_LEGAL_003_DOCUMENT_TEMPLATE_REQUIRED', 'semantic', 'error', 'Document drafting or template application requires a template.', array['node']),
  ('WF_LEGAL_004_CASE_LAW_SEARCH_RESULT_NOT_SELECTED', 'semantic', 'warning', 'Case law search results should be selected before drafting.', array['node']),
  ('WF_LEGAL_005_PROFILE_REQUIRED_FOR_PERSONALIZED_DRAFT', 'semantic', 'error', 'Personalized legal drafting requires a profile.', array['node']),
  ('WF_LEGAL_006_LEGAL_SOURCE_CITATION_REQUIRED_FOR_RAG_OUTPUT', 'semantic', 'warning', 'RAG-generated legal outputs should expose citations.', array['node']),
  ('WF_POLICY_001_EXTERNAL_ACTION_REQUIRES_APPROVAL', 'policy', 'policy_block', 'External delivery requires an approval gate before execution.', array['node']),
  ('WF_POLICY_002_AI_ROUTE_FORBIDDEN_FOR_DATA_CLASS', 'policy', 'policy_block', 'AI route is forbidden for this data classification.', array['node']),
  ('WF_POLICY_003_DOCUMENT_ACCESS_DENIED', 'security', 'policy_block', 'Document reference is not accessible in the active workspace.', array['binding']),
  ('WF_POLICY_004_CROSS_WORKSPACE_REFERENCE', 'security', 'policy_block', 'Canvas workflow cannot reference another workspace.', array['binding']),
  ('WF_POLICY_005_SECRET_VALUE_IN_CONFIG', 'security', 'policy_block', 'Secrets must not be stored directly in node config.', array['node']),
  ('WF_POLICY_006_DIRECT_SUPABASE_SERVICE_ROLE_FORBIDDEN', 'security', 'policy_block', 'Supabase service role values are forbidden in Canvas DSL.', array['node']),
  ('WF_POLICY_007_UNKNOWN_HTTP_DOMAIN', 'security', 'policy_block', 'HTTP actions cannot call an unknown domain.', array['node']),
  ('WF_POLICY_008_CODE_STEP_FORBIDDEN', 'security', 'policy_block', 'Code steps are forbidden outside explicit admin review.', array['node']),
  ('WF_POLICY_009_PUBLISHED_TEMPLATE_HAS_PRIVATE_REFERENCE', 'policy', 'policy_block', 'Published templates cannot retain private document references.', array['workflow']),
  ('WF_POLICY_010_SIGNED_URL_IN_CONFIG_FORBIDDEN', 'security', 'policy_block', 'Signed URLs must not be persisted in Canvas config.', array['node']),
  ('WF_RUNTIME_001_RUNTIME_MAPPING_MISSING', 'runtime', 'error', 'Runtime mapping is missing.', array['runtime']),
  ('WF_RUNTIME_002_ACTIVEPIECES_PIECE_MISSING', 'runtime', 'error', 'Activepieces piece is not available.', array['runtime']),
  ('WF_RUNTIME_003_ACTIVEPIECES_ACTION_MISSING', 'runtime', 'error', 'Activepieces action is not available.', array['runtime']),
  ('WF_RUNTIME_004_CONNECTION_REQUIRED', 'runtime', 'error', 'Runtime connection is required.', array['runtime']),
  ('WF_RUNTIME_005_CONNECTION_MISSING', 'runtime', 'error', 'Runtime connection is missing.', array['runtime']),
  ('WF_RUNTIME_006_CONNECTION_ERROR', 'runtime', 'error', 'Runtime connection is unavailable.', array['runtime']),
  ('WF_RUNTIME_007_RUNTIME_UNAVAILABLE', 'runtime', 'error', 'Runtime service is unavailable.', array['runtime']),
  ('WF_RUNTIME_008_COMPILER_UNSUPPORTED_NODE', 'runtime', 'error', 'Compiler does not support this node.', array['runtime']),
  ('WF_RUNTIME_009_REVERSE_SYNC_UNKNOWN_STEP', 'runtime', 'policy_block', 'Reverse sync contains an unknown runtime step.', array['runtime']),
  ('WF_UX_001_DISPLAY_NAME_MISSING', 'ux', 'warning', 'Canvas node should have a readable display name.', array['node']),
  ('WF_UX_002_BRANCH_LABEL_MISSING', 'ux', 'warning', 'Branch edge should have a readable label.', array['edge']),
  ('WF_UX_003_APPROVAL_REASON_MISSING', 'ux', 'warning', 'Approval step should explain why review is required.', array['node']),
  ('WF_UX_004_END_RESULT_DESCRIPTION_MISSING', 'ux', 'warning', 'End step should describe the result.', array['node']),
  ('WF_UX_005_RISK_BADGE_REQUIRED', 'ux', 'warning', 'High-risk steps should expose a risk badge.', array['node'])
on conflict (code) do update
set
  category = excluded.category,
  severity_default = excluded.severity_default,
  description = excluded.description,
  applies_to = excluded.applies_to,
  enabled = true;
