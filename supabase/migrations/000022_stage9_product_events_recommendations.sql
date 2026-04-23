insert into app.permissions (code, label, description, scope, high_risk)
values
  (
    'recommendation.read',
    'Read recommendations',
    'Open personal recommendation inbox items and previews.',
    'recommendation',
    false
  ),
  (
    'recommendation.accept',
    'Accept recommendation',
    'Convert a recommendation into a workflow draft.',
    'recommendation',
    true
  ),
  (
    'recommendation.manage',
    'Manage team recommendations',
    'Review team-level patterns, suppressions and analytics surfaces.',
    'recommendation',
    true
  )
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
    ('owner'::workspace_role, 'recommendation.read'),
    ('owner'::workspace_role, 'recommendation.accept'),
    ('owner'::workspace_role, 'recommendation.manage'),
    ('admin'::workspace_role, 'recommendation.read'),
    ('admin'::workspace_role, 'recommendation.accept'),
    ('admin'::workspace_role, 'recommendation.manage'),
    ('lawyer'::workspace_role, 'recommendation.read'),
    ('lawyer'::workspace_role, 'recommendation.accept'),
    ('assistant'::workspace_role, 'recommendation.read')
) as grants(role_code, permission_code)
where exists (select 1 from app.roles r where r.code = grants.role_code)
on conflict do nothing;

create table if not exists app.event_definitions (
  event_name text primary key,
  event_group text not null,
  schema_version text not null,
  owner text not null check (
    owner in ('frontend', 'backend', 'workflow_runtime', 'analytics')
  ),
  activity_code text not null,
  is_recommendation_signal boolean not null default false,
  is_authoritative boolean not null default false,
  risk_level text not null check (risk_level in ('low', 'medium', 'high')),
  allowed_sources jsonb not null default '[]'::jsonb,
  privacy_class text not null,
  required_fields jsonb not null default '[]'::jsonb,
  payload_schema jsonb not null default '{}'::jsonb,
  denylist_fields jsonb not null default '[]'::jsonb,
  deprecated_at timestamptz null,
  description text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.product_event_outbox (
  id uuid primary key default public.app_uuid_v7(),
  event_id uuid not null,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  actor_user_id uuid null references app.profiles(id) on delete set null,
  session_id text null,
  trace_id text null,
  event_name text not null,
  event_group text not null,
  activity_code text not null,
  schema_version text not null,
  source text not null check (
    source in ('frontend', 'backend', 'workflow_runtime', 'analytics')
  ),
  privacy_class text not null,
  risk_level text not null check (risk_level in ('low', 'medium', 'high')),
  process_instance_id text null,
  run_id text null,
  resource_type text null,
  resource_id text null,
  event_time timestamptz not null,
  properties jsonb not null default '{}'::jsonb,
  payload_hash text not null,
  client_event_id text null,
  idempotency_key text null,
  status text not null default 'pending' check (
    status in ('pending', 'published', 'mirrored_posthog', 'quarantined', 'failed')
  ),
  attempt_count integer not null default 0,
  available_at timestamptz not null default timezone('utc', now()),
  last_error text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists idx_app_product_event_outbox_client_event
  on app.product_event_outbox (workspace_id, source, client_event_id)
  where client_event_id is not null;

create table if not exists app.product_event_quarantine (
  id uuid primary key default public.app_uuid_v7(),
  event_id uuid not null,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  actor_user_id uuid null references app.profiles(id) on delete set null,
  session_id text null,
  trace_id text null,
  event_name text not null,
  source text not null check (
    source in ('frontend', 'backend', 'workflow_runtime', 'analytics')
  ),
  reason_code text not null,
  resource_type text null,
  resource_id text null,
  process_instance_id text null,
  run_id text null,
  event_time timestamptz not null,
  properties jsonb not null default '{}'::jsonb,
  client_event_id text null,
  idempotency_key text null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.recommendation_candidates (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  owner_user_id uuid null references app.profiles(id) on delete cascade,
  pattern_id text not null,
  scope text not null check (scope in ('personal', 'team')),
  title text not null,
  summary text not null,
  rationale text not null,
  activity_sequence jsonb not null default '[]'::jsonb,
  source_events jsonb not null default '[]'::jsonb,
  advisory_only boolean not null default true,
  risk_level text not null check (risk_level in ('low', 'medium', 'high')),
  repeat_count integer not null default 0,
  period_days integer not null default 30,
  estimated_time_saved_minutes integer not null default 0,
  explainability_summary text not null default '',
  warnings jsonb not null default '[]'::jsonb,
  available_actions jsonb not null default '["accept", "dismiss", "snooze", "feedback"]'::jsonb,
  workflow_skeleton jsonb not null,
  validation_report jsonb not null default '{}'::jsonb,
  policy_report jsonb not null default '{}'::jsonb,
  runtime_plan_preview jsonb not null default '{}'::jsonb,
  missing_inputs jsonb not null default '[]'::jsonb,
  source_trace_ids jsonb not null default '[]'::jsonb,
  similar_template_ids jsonb not null default '[]'::jsonb,
  pattern_summary jsonb not null default '{}'::jsonb,
  module_mapping jsonb not null default '[]'::jsonb,
  status text not null default 'candidate' check (
    status in ('candidate', 'accepted', 'dismissed', 'snoozed')
  ),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists idx_app_recommendation_candidates_personal
  on app.recommendation_candidates (workspace_id, pattern_id, owner_user_id)
  where owner_user_id is not null;

create unique index if not exists idx_app_recommendation_candidates_team
  on app.recommendation_candidates (workspace_id, pattern_id, scope)
  where owner_user_id is null;

create table if not exists app.recommendation_instances (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  candidate_id uuid not null references app.recommendation_candidates(id) on delete cascade,
  owner_user_id uuid null references app.profiles(id) on delete cascade,
  scope text not null check (scope in ('personal', 'team')),
  status text not null default 'candidate' check (
    status in ('candidate', 'accepted', 'dismissed', 'snoozed')
  ),
  snoozed_until timestamptz null,
  accepted_at timestamptz null,
  dismissed_at timestamptz null,
  accepted_draft_id uuid null references app.workflow_drafts(id) on delete set null,
  notification_id uuid null references app.notifications(id) on delete set null,
  last_seen_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists idx_app_recommendation_instances_personal
  on app.recommendation_instances (candidate_id, owner_user_id)
  where owner_user_id is not null;

create unique index if not exists idx_app_recommendation_instances_team
  on app.recommendation_instances (candidate_id)
  where owner_user_id is null;

create table if not exists app.recommendation_feedback (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  recommendation_id uuid not null references app.recommendation_candidates(id) on delete cascade,
  actor_user_id uuid not null references app.profiles(id) on delete cascade,
  feedback_type text not null check (
    feedback_type in (
      'helpful',
      'not_helpful',
      'already_covered',
      'too_risky',
      'not_relevant'
    )
  ),
  note text null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.recommendation_suppressions (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  recommendation_id uuid null references app.recommendation_candidates(id) on delete cascade,
  pattern_id text not null,
  scope text not null check (scope in ('personal', 'team')),
  suppressed_by_user_id uuid not null references app.profiles(id) on delete cascade,
  reason_code text not null,
  note text null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.process_case_snapshots (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  pattern_id text null,
  scope text not null check (scope in ('personal', 'team')),
  case_key text not null,
  process_instance_id text null,
  session_id text null,
  trace_id text null,
  run_id text null,
  actor_ids jsonb not null default '[]'::jsonb,
  activity_sequence jsonb not null default '[]'::jsonb,
  event_count integer not null default 0,
  started_at timestamptz not null,
  finished_at timestamptz null,
  duration_ms bigint null,
  status text not null check (
    status in ('completed', 'in_progress', 'failed', 'abandoned')
  ),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.recommendation_quality_snapshots (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  metrics jsonb not null default '[]'::jsonb,
  mining_lag_minutes integer not null default 0,
  quarantine_rate_percent numeric(5, 2) not null default 0,
  missing_trace_rate_percent numeric(5, 2) not null default 0,
  captured_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_app_product_event_outbox_status
  on app.product_event_outbox (status, available_at asc);

create index if not exists idx_app_product_event_quarantine_created
  on app.product_event_quarantine (workspace_id, created_at desc);

create index if not exists idx_app_recommendation_candidates_workspace
  on app.recommendation_candidates (workspace_id, updated_at desc);

create index if not exists idx_app_recommendation_instances_lookup
  on app.recommendation_instances (workspace_id, updated_at desc);

create index if not exists idx_app_recommendation_feedback_lookup
  on app.recommendation_feedback (recommendation_id, created_at desc);

create index if not exists idx_app_recommendation_suppressions_lookup
  on app.recommendation_suppressions (workspace_id, created_at desc);

create index if not exists idx_app_process_case_snapshots_lookup
  on app.process_case_snapshots (workspace_id, started_at desc);

create index if not exists idx_app_recommendation_quality_snapshots_lookup
  on app.recommendation_quality_snapshots (workspace_id, captured_at desc);
