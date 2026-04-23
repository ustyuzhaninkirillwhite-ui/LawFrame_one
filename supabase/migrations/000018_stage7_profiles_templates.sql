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
      'connection',
      'moderation',
      'recommendation',
      'billing',
      'audit'
    )
  );

create table if not exists app.legal_work_profiles (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid null references app.workspaces(id) on delete cascade,
  owner_user_id uuid null references app.profiles(id) on delete cascade,
  profile_type text not null check (profile_type in ('system', 'workspace', 'personal')),
  name text not null,
  description text null,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  current_version_id uuid null,
  created_by_user_id uuid null references app.profiles(id) on delete set null,
  updated_by_user_id uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz null
);

create table if not exists app.legal_work_profile_versions (
  id uuid primary key default public.app_uuid_v7(),
  profile_id uuid not null references app.legal_work_profiles(id) on delete cascade,
  workspace_id uuid null references app.workspaces(id) on delete cascade,
  version integer not null check (version > 0),
  schema_version text not null,
  status text not null check (status in ('draft', 'published', 'deprecated', 'archived')),
  content jsonb not null default '{}'::jsonb,
  content_hash text not null,
  change_note text null,
  created_by_user_id uuid null references app.profiles(id) on delete set null,
  published_by_user_id uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  published_at timestamptz null,
  unique (profile_id, version)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'legal_work_profiles_current_version_fk'
  ) then
    alter table app.legal_work_profiles
      add constraint legal_work_profiles_current_version_fk
      foreign key (current_version_id)
      references app.legal_work_profile_versions(id)
      on delete set null;
  end if;
end
$$;

create table if not exists app.profile_inheritance_rules (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid null references app.workspaces(id) on delete cascade,
  user_id uuid null references app.profiles(id) on delete cascade,
  system_profile_version_id uuid null references app.legal_work_profile_versions(id) on delete set null,
  workspace_profile_version_id uuid null references app.legal_work_profile_versions(id) on delete set null,
  personal_profile_version_id uuid null references app.legal_work_profile_versions(id) on delete set null,
  merge_strategy text not null default 'deep_merge' check (
    merge_strategy in ('deep_merge', 'replace_arrays', 'locked_sections_first')
  ),
  priority_order jsonb not null default '["system","workspace","personal","automation"]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.effective_profile_snapshots (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid null references app.workspaces(id) on delete cascade,
  user_id uuid null references app.profiles(id) on delete cascade,
  source_profile_version_ids jsonb not null default '[]'::jsonb,
  effective_content jsonb not null default '{}'::jsonb,
  effective_hash text not null,
  created_for_run_id uuid null,
  created_for_preview_id uuid null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.document_types (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid null references app.workspaces(id) on delete cascade,
  code text not null,
  name text not null,
  jurisdiction text null,
  practice_area text null,
  status text not null default 'draft' check (status in ('draft', 'published', 'deprecated')),
  active_version_id uuid null,
  created_by_user_id uuid null references app.profiles(id) on delete set null,
  updated_by_user_id uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz null,
  unique (workspace_id, code)
);

create table if not exists app.document_type_versions (
  id uuid primary key default public.app_uuid_v7(),
  document_type_id uuid not null references app.document_types(id) on delete cascade,
  workspace_id uuid null references app.workspaces(id) on delete cascade,
  version integer not null check (version > 0),
  status text not null check (status in ('draft', 'published', 'deprecated')),
  schema_version text not null,
  structure jsonb not null default '[]'::jsonb,
  attachment_defaults jsonb not null default '[]'::jsonb,
  validation_rules jsonb not null default '{}'::jsonb,
  created_by_user_id uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  published_at timestamptz null,
  unique (document_type_id, version)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'document_types_active_version_fk'
  ) then
    alter table app.document_types
      add constraint document_types_active_version_fk
      foreign key (active_version_id)
      references app.document_type_versions(id)
      on delete set null;
  end if;
end
$$;

create table if not exists app.document_structures (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid null references app.workspaces(id) on delete cascade,
  document_type_id uuid not null references app.document_types(id) on delete cascade,
  document_type_version_id uuid not null references app.document_type_versions(id) on delete cascade,
  section_id text not null,
  title text not null,
  kind text not null,
  is_required boolean not null default false,
  sort_order integer not null check (sort_order >= 0),
  locked boolean not null default false,
  clause_ids jsonb not null default '[]'::jsonb,
  placeholder_codes jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (document_type_version_id, section_id)
);

create table if not exists app.clause_library_items (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid null references app.workspaces(id) on delete cascade,
  owner_user_id uuid null references app.profiles(id) on delete cascade,
  scope text not null check (scope in ('system', 'workspace', 'personal')),
  title text not null,
  tags text[] not null default '{}'::text[],
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  rich_text jsonb not null default '{}'::jsonb,
  created_by_user_id uuid null references app.profiles(id) on delete set null,
  updated_by_user_id uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz null
);

create table if not exists app.phrase_rules (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid null references app.workspaces(id) on delete cascade,
  owner_user_id uuid null references app.profiles(id) on delete cascade,
  rule_type text not null check (rule_type in ('preferred', 'forbidden')),
  phrase text not null,
  rationale text null,
  created_by_user_id uuid null references app.profiles(id) on delete set null,
  updated_by_user_id uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz null
);

create table if not exists app.document_templates (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid null references app.workspaces(id) on delete cascade,
  owner_user_id uuid null references app.profiles(id) on delete cascade,
  document_type_id uuid null references app.document_types(id) on delete set null,
  source_document_id uuid not null references app.documents(id) on delete restrict,
  source_document_version_id uuid not null references app.document_versions(id) on delete restrict,
  title text not null,
  description text null,
  visibility text not null check (visibility in ('workspace', 'personal', 'public', 'system')),
  status text not null default 'draft' check (status in ('draft', 'published', 'deprecated', 'archived')),
  active_version_id uuid null,
  created_by_user_id uuid null references app.profiles(id) on delete set null,
  updated_by_user_id uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz null
);

create table if not exists app.document_template_versions (
  id uuid primary key default public.app_uuid_v7(),
  template_id uuid not null references app.document_templates(id) on delete cascade,
  workspace_id uuid null references app.workspaces(id) on delete cascade,
  version integer not null check (version > 0),
  status text not null check (status in ('draft', 'published', 'deprecated')),
  source_document_version_id uuid not null references app.document_versions(id) on delete restrict,
  preview_document_version_id uuid null references app.document_versions(id) on delete set null,
  placeholders jsonb not null default '[]'::jsonb,
  mappings jsonb not null default '[]'::jsonb,
  created_by_user_id uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  published_at timestamptz null,
  unique (template_id, version)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'document_templates_active_version_fk'
  ) then
    alter table app.document_templates
      add constraint document_templates_active_version_fk
      foreign key (active_version_id)
      references app.document_template_versions(id)
      on delete set null;
  end if;
end
$$;

create table if not exists app.approval_routes (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  name text not null,
  description text null,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  applies_to_document_types jsonb not null default '[]'::jsonb,
  created_by_user_id uuid null references app.profiles(id) on delete set null,
  updated_by_user_id uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.approval_route_steps (
  id uuid primary key default public.app_uuid_v7(),
  route_id uuid not null references app.approval_routes(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  step_id text not null,
  sort_order integer not null check (sort_order > 0),
  approver_role text null,
  approver_user_id uuid null references app.profiles(id) on delete set null,
  title text not null,
  requires_comment boolean not null default false,
  due_in_hours integer null check (due_in_hours is null or due_in_hours > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (route_id, sort_order),
  unique (route_id, step_id)
);

alter table app.workflow_runs
  add column if not exists effective_profile_snapshot_id uuid null references app.effective_profile_snapshots(id) on delete set null,
  add column if not exists document_template_version_id uuid null references app.document_template_versions(id) on delete set null,
  add column if not exists approval_route_id uuid null references app.approval_routes(id) on delete set null;

create table if not exists app.document_validation_reports (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  generation_job_id uuid null,
  document_id uuid null references app.documents(id) on delete set null,
  document_version_id uuid null references app.document_versions(id) on delete set null,
  status text not null check (status in ('valid', 'invalid', 'warning')),
  issue_count integer not null default 0 check (issue_count >= 0),
  blocking_issue_count integer not null default 0 check (blocking_issue_count >= 0),
  ruleset_version text not null default 'stage7.v1',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.document_validation_issues (
  id uuid primary key default public.app_uuid_v7(),
  report_id uuid not null references app.document_validation_reports(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  code text not null,
  severity text not null check (severity in ('error', 'warning', 'info')),
  path text not null,
  message text not null,
  suggested_fix text null,
  resolved boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.document_generation_jobs (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  workflow_run_id uuid null references app.workflow_runs(id) on delete set null,
  template_id uuid not null references app.document_templates(id) on delete restrict,
  template_version_id uuid not null references app.document_template_versions(id) on delete restrict,
  profile_id uuid null references app.legal_work_profiles(id) on delete set null,
  profile_snapshot_id uuid null references app.effective_profile_snapshots(id) on delete set null,
  document_type_id uuid null references app.document_types(id) on delete set null,
  approval_route_id uuid null references app.approval_routes(id) on delete set null,
  status text not null check (
    status in ('queued', 'preview_ready', 'waiting_approval', 'finalized', 'failed')
  ),
  input_payload jsonb not null default '{}'::jsonb,
  ai_section_codes jsonb not null default '[]'::jsonb,
  missing_field_codes jsonb not null default '[]'::jsonb,
  preview_document_id uuid null references app.documents(id) on delete set null,
  preview_document_version_id uuid null references app.document_versions(id) on delete set null,
  final_document_id uuid null references app.documents(id) on delete set null,
  final_document_version_id uuid null references app.document_versions(id) on delete set null,
  validation_report_id uuid null,
  error_code text null,
  created_by_user_id uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.document_generation_outputs (
  id uuid primary key default public.app_uuid_v7(),
  generation_job_id uuid not null references app.document_generation_jobs(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  artifact_id uuid null references app.run_artifacts(id) on delete set null,
  artifact_type text not null,
  document_id uuid null references app.documents(id) on delete set null,
  document_version_id uuid null references app.document_versions(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.approval_tasks (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  route_id uuid null references app.approval_routes(id) on delete set null,
  route_step_id uuid null references app.approval_route_steps(id) on delete set null,
  generation_job_id uuid null references app.document_generation_jobs(id) on delete set null,
  workflow_run_id uuid null references app.workflow_runs(id) on delete set null,
  title text not null,
  status text not null default 'pending' check (
    status in ('pending', 'approved', 'rejected', 'cancelled')
  ),
  approver_user_id uuid null references app.profiles(id) on delete set null,
  approver_role text null,
  due_at timestamptz null,
  decision_comment text null,
  created_by_user_id uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  decided_at timestamptz null
);

create table if not exists app.approval_task_events (
  id uuid primary key default public.app_uuid_v7(),
  approval_task_id uuid not null references app.approval_tasks(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  event_type text not null,
  actor_user_id uuid null references app.profiles(id) on delete set null,
  comment text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.profile_import_jobs (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  source_document_id uuid not null references app.documents(id) on delete restrict,
  source_document_version_id uuid not null references app.document_versions(id) on delete restrict,
  target_profile_id uuid null references app.legal_work_profiles(id) on delete set null,
  status text not null check (status in ('queued', 'analyzing', 'draft_ready', 'failed', 'applied')),
  inferred_profile_content jsonb null,
  inferred_template_title text null,
  error_code text null,
  created_by_user_id uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_app_legal_work_profiles_workspace
  on app.legal_work_profiles (workspace_id, profile_type, updated_at desc)
  where deleted_at is null;

create index if not exists idx_app_legal_work_profiles_owner
  on app.legal_work_profiles (owner_user_id, updated_at desc)
  where deleted_at is null;

create index if not exists idx_app_legal_work_profile_versions_profile
  on app.legal_work_profile_versions (profile_id, version desc);

create index if not exists idx_app_effective_profile_snapshots_user_workspace
  on app.effective_profile_snapshots (user_id, workspace_id, created_at desc);

create index if not exists idx_app_document_types_workspace
  on app.document_types (workspace_id, status, updated_at desc)
  where deleted_at is null;

create index if not exists idx_app_document_type_versions_type
  on app.document_type_versions (document_type_id, version desc);

create index if not exists idx_app_document_structures_version
  on app.document_structures (document_type_version_id, sort_order asc);

create index if not exists idx_app_clause_library_items_workspace
  on app.clause_library_items (workspace_id, status, updated_at desc)
  where deleted_at is null;

create index if not exists idx_app_clause_library_items_owner
  on app.clause_library_items (owner_user_id, updated_at desc)
  where deleted_at is null;

create index if not exists idx_app_phrase_rules_workspace
  on app.phrase_rules (workspace_id, rule_type, updated_at desc)
  where deleted_at is null;

create index if not exists idx_app_document_templates_workspace
  on app.document_templates (workspace_id, visibility, status, updated_at desc)
  where deleted_at is null;

create index if not exists idx_app_document_template_versions_template
  on app.document_template_versions (template_id, version desc);

create index if not exists idx_app_document_generation_jobs_workspace
  on app.document_generation_jobs (workspace_id, status, created_at desc);

create index if not exists idx_app_document_generation_jobs_run
  on app.document_generation_jobs (workflow_run_id, created_at desc);

create index if not exists idx_app_document_validation_reports_workspace
  on app.document_validation_reports (workspace_id, status, created_at desc);

create index if not exists idx_app_document_validation_issues_report
  on app.document_validation_issues (report_id, severity, created_at asc);

create index if not exists idx_app_approval_routes_workspace
  on app.approval_routes (workspace_id, status, updated_at desc);

create index if not exists idx_app_approval_tasks_workspace
  on app.approval_tasks (workspace_id, status, created_at desc);

create index if not exists idx_app_approval_tasks_approver
  on app.approval_tasks (approver_user_id, status, created_at desc);

create index if not exists idx_app_profile_import_jobs_workspace
  on app.profile_import_jobs (workspace_id, status, created_at desc);
