alter table app.legal_work_profiles enable row level security;
alter table app.legal_work_profile_versions enable row level security;
alter table app.profile_inheritance_rules enable row level security;
alter table app.effective_profile_snapshots enable row level security;
alter table app.document_types enable row level security;
alter table app.document_type_versions enable row level security;
alter table app.document_structures enable row level security;
alter table app.clause_library_items enable row level security;
alter table app.phrase_rules enable row level security;
alter table app.document_templates enable row level security;
alter table app.document_template_versions enable row level security;
alter table app.document_generation_jobs enable row level security;
alter table app.document_generation_outputs enable row level security;
alter table app.document_validation_reports enable row level security;
alter table app.document_validation_issues enable row level security;
alter table app.approval_routes enable row level security;
alter table app.approval_route_steps enable row level security;
alter table app.approval_tasks enable row level security;
alter table app.approval_task_events enable row level security;
alter table app.profile_import_jobs enable row level security;

drop policy if exists legal_work_profiles_select_member on app.legal_work_profiles;
create policy legal_work_profiles_select_member
  on app.legal_work_profiles
  for select
  to authenticated
  using (
    profile_type = 'system'
    or owner_user_id = (select auth.uid())
    or (
      workspace_id is not null
      and public.has_workspace_permission(workspace_id, 'profile.read')
    )
  );

drop policy if exists legal_work_profiles_manage_member on app.legal_work_profiles;
create policy legal_work_profiles_manage_member
  on app.legal_work_profiles
  for all
  to authenticated
  using (
    owner_user_id = (select auth.uid())
    or (
      workspace_id is not null
      and (
        public.has_workspace_permission(workspace_id, 'profile.update')
        or public.has_workspace_permission(workspace_id, 'profile.publish')
        or public.has_workspace_permission(workspace_id, 'profile.override_personal')
      )
    )
  )
  with check (
    owner_user_id = (select auth.uid())
    or (
      workspace_id is not null
      and (
        public.has_workspace_permission(workspace_id, 'profile.update')
        or public.has_workspace_permission(workspace_id, 'profile.publish')
        or public.has_workspace_permission(workspace_id, 'profile.override_personal')
      )
    )
  );

drop policy if exists legal_work_profile_versions_select_member on app.legal_work_profile_versions;
create policy legal_work_profile_versions_select_member
  on app.legal_work_profile_versions
  for select
  to authenticated
  using (
    workspace_id is null
    or public.has_workspace_permission(workspace_id, 'profile.read')
    or exists (
      select 1
      from app.legal_work_profiles p
      where p.id = profile_id
        and p.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists legal_work_profile_versions_manage_member on app.legal_work_profile_versions;
create policy legal_work_profile_versions_manage_member
  on app.legal_work_profile_versions
  for all
  to authenticated
  using (
    workspace_id is null
    or public.has_workspace_permission(workspace_id, 'profile.update')
    or public.has_workspace_permission(workspace_id, 'profile.publish')
    or exists (
      select 1
      from app.legal_work_profiles p
      where p.id = profile_id
        and p.owner_user_id = (select auth.uid())
    )
  )
  with check (
    workspace_id is null
    or public.has_workspace_permission(workspace_id, 'profile.update')
    or public.has_workspace_permission(workspace_id, 'profile.publish')
    or exists (
      select 1
      from app.legal_work_profiles p
      where p.id = profile_id
        and p.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists profile_inheritance_rules_manage_member on app.profile_inheritance_rules;
create policy profile_inheritance_rules_manage_member
  on app.profile_inheritance_rules
  for all
  to authenticated
  using (
    user_id = (select auth.uid())
    or (
      workspace_id is not null
      and public.has_workspace_permission(workspace_id, 'profile.update')
    )
  )
  with check (
    user_id = (select auth.uid())
    or (
      workspace_id is not null
      and public.has_workspace_permission(workspace_id, 'profile.update')
    )
  );

drop policy if exists effective_profile_snapshots_select_member on app.effective_profile_snapshots;
create policy effective_profile_snapshots_select_member
  on app.effective_profile_snapshots
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (
      workspace_id is not null
      and (
        public.has_workspace_permission(workspace_id, 'profile.read')
        or public.has_workspace_permission(workspace_id, 'automation.run')
      )
    )
  );

drop policy if exists effective_profile_snapshots_manage_member on app.effective_profile_snapshots;
create policy effective_profile_snapshots_manage_member
  on app.effective_profile_snapshots
  for all
  to authenticated
  using (
    user_id = (select auth.uid())
    or (
      workspace_id is not null
      and public.has_workspace_permission(workspace_id, 'profile.update')
    )
  )
  with check (
    user_id = (select auth.uid())
    or (
      workspace_id is not null
      and public.has_workspace_permission(workspace_id, 'profile.update')
    )
  );

drop policy if exists document_types_select_member on app.document_types;
create policy document_types_select_member
  on app.document_types
  for select
  to authenticated
  using (
    workspace_id is null
    or public.has_workspace_permission(workspace_id, 'document.template.read')
    or public.has_workspace_permission(workspace_id, 'document.read')
  );

drop policy if exists document_types_manage_member on app.document_types;
create policy document_types_manage_member
  on app.document_types
  for all
  to authenticated
  using (
    workspace_id is not null
    and (
      public.has_workspace_permission(workspace_id, 'document.template.manage')
      or public.has_workspace_permission(workspace_id, 'document.template.publish')
    )
  )
  with check (
    workspace_id is not null
    and (
      public.has_workspace_permission(workspace_id, 'document.template.manage')
      or public.has_workspace_permission(workspace_id, 'document.template.publish')
    )
  );

drop policy if exists document_type_versions_select_member on app.document_type_versions;
create policy document_type_versions_select_member
  on app.document_type_versions
  for select
  to authenticated
  using (
    workspace_id is null
    or public.has_workspace_permission(workspace_id, 'document.template.read')
    or public.has_workspace_permission(workspace_id, 'document.read')
  );

drop policy if exists document_type_versions_manage_member on app.document_type_versions;
create policy document_type_versions_manage_member
  on app.document_type_versions
  for all
  to authenticated
  using (
    workspace_id is not null
    and public.has_workspace_permission(workspace_id, 'document.template.manage')
  )
  with check (
    workspace_id is not null
    and public.has_workspace_permission(workspace_id, 'document.template.manage')
  );

drop policy if exists document_structures_select_member on app.document_structures;
create policy document_structures_select_member
  on app.document_structures
  for select
  to authenticated
  using (
    workspace_id is null
    or public.has_workspace_permission(workspace_id, 'document.template.read')
    or public.has_workspace_permission(workspace_id, 'document.read')
  );

drop policy if exists document_structures_manage_member on app.document_structures;
create policy document_structures_manage_member
  on app.document_structures
  for all
  to authenticated
  using (
    workspace_id is not null
    and public.has_workspace_permission(workspace_id, 'document.template.manage')
  )
  with check (
    workspace_id is not null
    and public.has_workspace_permission(workspace_id, 'document.template.manage')
  );

drop policy if exists clause_library_items_select_member on app.clause_library_items;
create policy clause_library_items_select_member
  on app.clause_library_items
  for select
  to authenticated
  using (
    scope = 'system'
    or owner_user_id = (select auth.uid())
    or (
      workspace_id is not null
      and public.has_workspace_permission(workspace_id, 'profile.read')
    )
  );

drop policy if exists clause_library_items_manage_member on app.clause_library_items;
create policy clause_library_items_manage_member
  on app.clause_library_items
  for all
  to authenticated
  using (
    owner_user_id = (select auth.uid())
    or (
      workspace_id is not null
      and public.has_workspace_permission(workspace_id, 'profile.update')
    )
  )
  with check (
    owner_user_id = (select auth.uid())
    or (
      workspace_id is not null
      and public.has_workspace_permission(workspace_id, 'profile.update')
    )
  );

drop policy if exists phrase_rules_select_member on app.phrase_rules;
create policy phrase_rules_select_member
  on app.phrase_rules
  for select
  to authenticated
  using (
    owner_user_id = (select auth.uid())
    or workspace_id is null
    or public.has_workspace_permission(workspace_id, 'profile.read')
  );

drop policy if exists phrase_rules_manage_member on app.phrase_rules;
create policy phrase_rules_manage_member
  on app.phrase_rules
  for all
  to authenticated
  using (
    owner_user_id = (select auth.uid())
    or (
      workspace_id is not null
      and public.has_workspace_permission(workspace_id, 'profile.update')
    )
  )
  with check (
    owner_user_id = (select auth.uid())
    or (
      workspace_id is not null
      and public.has_workspace_permission(workspace_id, 'profile.update')
    )
  );

drop policy if exists document_templates_select_member on app.document_templates;
create policy document_templates_select_member
  on app.document_templates
  for select
  to authenticated
  using (
    visibility in ('system', 'public')
    or owner_user_id = (select auth.uid())
    or (
      workspace_id is not null
      and public.has_workspace_permission(workspace_id, 'document.template.read')
    )
  );

drop policy if exists document_templates_manage_member on app.document_templates;
create policy document_templates_manage_member
  on app.document_templates
  for all
  to authenticated
  using (
    owner_user_id = (select auth.uid())
    or (
      workspace_id is not null
      and (
        public.has_workspace_permission(workspace_id, 'document.template.manage')
        or public.has_workspace_permission(workspace_id, 'document.template.publish')
      )
    )
  )
  with check (
    owner_user_id = (select auth.uid())
    or (
      workspace_id is not null
      and (
        public.has_workspace_permission(workspace_id, 'document.template.manage')
        or public.has_workspace_permission(workspace_id, 'document.template.publish')
      )
    )
  );

drop policy if exists document_template_versions_select_member on app.document_template_versions;
create policy document_template_versions_select_member
  on app.document_template_versions
  for select
  to authenticated
  using (
    workspace_id is null
    or public.has_workspace_permission(workspace_id, 'document.template.read')
  );

drop policy if exists document_template_versions_manage_member on app.document_template_versions;
create policy document_template_versions_manage_member
  on app.document_template_versions
  for all
  to authenticated
  using (
    workspace_id is null
    or public.has_workspace_permission(workspace_id, 'document.template.manage')
    or public.has_workspace_permission(workspace_id, 'document.template.publish')
  )
  with check (
    workspace_id is null
    or public.has_workspace_permission(workspace_id, 'document.template.manage')
    or public.has_workspace_permission(workspace_id, 'document.template.publish')
  );

drop policy if exists approval_routes_select_member on app.approval_routes;
create policy approval_routes_select_member
  on app.approval_routes
  for select
  to authenticated
  using (
    public.has_workspace_permission(workspace_id, 'approval.task.read')
    or public.has_workspace_permission(workspace_id, 'approval.task.decide')
    or public.has_workspace_permission(workspace_id, 'approval.route.manage')
  );

drop policy if exists approval_routes_manage_member on app.approval_routes;
create policy approval_routes_manage_member
  on app.approval_routes
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'approval.route.manage'))
  with check (public.has_workspace_permission(workspace_id, 'approval.route.manage'));

drop policy if exists approval_route_steps_select_member on app.approval_route_steps;
create policy approval_route_steps_select_member
  on app.approval_route_steps
  for select
  to authenticated
  using (
    public.has_workspace_permission(workspace_id, 'approval.task.read')
    or public.has_workspace_permission(workspace_id, 'approval.task.decide')
    or public.has_workspace_permission(workspace_id, 'approval.route.manage')
  );

drop policy if exists approval_route_steps_manage_member on app.approval_route_steps;
create policy approval_route_steps_manage_member
  on app.approval_route_steps
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'approval.route.manage'))
  with check (public.has_workspace_permission(workspace_id, 'approval.route.manage'));

drop policy if exists document_generation_jobs_select_member on app.document_generation_jobs;
create policy document_generation_jobs_select_member
  on app.document_generation_jobs
  for select
  to authenticated
  using (
    public.has_workspace_permission(workspace_id, 'document.generate')
    or public.has_workspace_permission(workspace_id, 'document.read')
    or public.has_workspace_permission(workspace_id, 'approval.task.read')
  );

drop policy if exists document_generation_jobs_manage_member on app.document_generation_jobs;
create policy document_generation_jobs_manage_member
  on app.document_generation_jobs
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'document.generate'))
  with check (public.has_workspace_permission(workspace_id, 'document.generate'));

drop policy if exists document_generation_outputs_select_member on app.document_generation_outputs;
create policy document_generation_outputs_select_member
  on app.document_generation_outputs
  for select
  to authenticated
  using (
    public.has_workspace_permission(workspace_id, 'document.generate')
    or public.has_workspace_permission(workspace_id, 'document.read')
  );

drop policy if exists document_generation_outputs_manage_member on app.document_generation_outputs;
create policy document_generation_outputs_manage_member
  on app.document_generation_outputs
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'document.generate'))
  with check (public.has_workspace_permission(workspace_id, 'document.generate'));

drop policy if exists document_validation_reports_select_member on app.document_validation_reports;
create policy document_validation_reports_select_member
  on app.document_validation_reports
  for select
  to authenticated
  using (
    public.has_workspace_permission(workspace_id, 'document.validation.read')
    or public.has_workspace_permission(workspace_id, 'document.read')
    or public.has_workspace_permission(workspace_id, 'document.generate')
  );

drop policy if exists document_validation_reports_manage_member on app.document_validation_reports;
create policy document_validation_reports_manage_member
  on app.document_validation_reports
  for all
  to authenticated
  using (
    public.has_workspace_permission(workspace_id, 'document.validation.resolve')
    or public.has_workspace_permission(workspace_id, 'document.generate')
  )
  with check (
    public.has_workspace_permission(workspace_id, 'document.validation.resolve')
    or public.has_workspace_permission(workspace_id, 'document.generate')
  );

drop policy if exists document_validation_issues_select_member on app.document_validation_issues;
create policy document_validation_issues_select_member
  on app.document_validation_issues
  for select
  to authenticated
  using (
    public.has_workspace_permission(workspace_id, 'document.validation.read')
    or public.has_workspace_permission(workspace_id, 'document.generate')
  );

drop policy if exists document_validation_issues_manage_member on app.document_validation_issues;
create policy document_validation_issues_manage_member
  on app.document_validation_issues
  for all
  to authenticated
  using (
    public.has_workspace_permission(workspace_id, 'document.validation.resolve')
    or public.has_workspace_permission(workspace_id, 'document.generate')
  )
  with check (
    public.has_workspace_permission(workspace_id, 'document.validation.resolve')
    or public.has_workspace_permission(workspace_id, 'document.generate')
  );

drop policy if exists approval_tasks_select_member on app.approval_tasks;
create policy approval_tasks_select_member
  on app.approval_tasks
  for select
  to authenticated
  using (
    approver_user_id = (select auth.uid())
    or public.has_workspace_permission(workspace_id, 'approval.task.read')
    or public.has_workspace_permission(workspace_id, 'approval.task.decide')
  );

drop policy if exists approval_tasks_manage_member on app.approval_tasks;
create policy approval_tasks_manage_member
  on app.approval_tasks
  for all
  to authenticated
  using (
    approver_user_id = (select auth.uid())
    or public.has_workspace_permission(workspace_id, 'approval.task.decide')
    or public.has_workspace_permission(workspace_id, 'document.generate')
  )
  with check (
    approver_user_id = (select auth.uid())
    or public.has_workspace_permission(workspace_id, 'approval.task.decide')
    or public.has_workspace_permission(workspace_id, 'document.generate')
  );

drop policy if exists approval_task_events_select_member on app.approval_task_events;
create policy approval_task_events_select_member
  on app.approval_task_events
  for select
  to authenticated
  using (
    public.has_workspace_permission(workspace_id, 'approval.task.read')
    or public.has_workspace_permission(workspace_id, 'approval.task.decide')
  );

drop policy if exists approval_task_events_manage_member on app.approval_task_events;
create policy approval_task_events_manage_member
  on app.approval_task_events
  for all
  to authenticated
  using (
    public.has_workspace_permission(workspace_id, 'approval.task.decide')
    or public.has_workspace_permission(workspace_id, 'document.generate')
  )
  with check (
    public.has_workspace_permission(workspace_id, 'approval.task.decide')
    or public.has_workspace_permission(workspace_id, 'document.generate')
  );

drop policy if exists profile_import_jobs_select_member on app.profile_import_jobs;
create policy profile_import_jobs_select_member
  on app.profile_import_jobs
  for select
  to authenticated
  using (
    public.has_workspace_permission(workspace_id, 'profile.read')
    or public.has_workspace_permission(workspace_id, 'document.read')
  );

drop policy if exists profile_import_jobs_manage_member on app.profile_import_jobs;
create policy profile_import_jobs_manage_member
  on app.profile_import_jobs
  for all
  to authenticated
  using (
    public.has_workspace_permission(workspace_id, 'profile.update')
    or public.has_workspace_permission(workspace_id, 'document.read')
  )
  with check (
    public.has_workspace_permission(workspace_id, 'profile.update')
    or public.has_workspace_permission(workspace_id, 'document.read')
  );

grant select, insert, update, delete on app.legal_work_profiles to authenticated;
grant select, insert, update, delete on app.legal_work_profile_versions to authenticated;
grant select, insert, update, delete on app.profile_inheritance_rules to authenticated;
grant select, insert, update, delete on app.effective_profile_snapshots to authenticated;
grant select, insert, update, delete on app.document_types to authenticated;
grant select, insert, update, delete on app.document_type_versions to authenticated;
grant select, insert, update, delete on app.document_structures to authenticated;
grant select, insert, update, delete on app.clause_library_items to authenticated;
grant select, insert, update, delete on app.phrase_rules to authenticated;
grant select, insert, update, delete on app.document_templates to authenticated;
grant select, insert, update, delete on app.document_template_versions to authenticated;
grant select, insert, update, delete on app.document_generation_jobs to authenticated;
grant select, insert, update, delete on app.document_generation_outputs to authenticated;
grant select, insert, update, delete on app.document_validation_reports to authenticated;
grant select, insert, update, delete on app.document_validation_issues to authenticated;
grant select, insert, update, delete on app.approval_routes to authenticated;
grant select, insert, update, delete on app.approval_route_steps to authenticated;
grant select, insert, update, delete on app.approval_tasks to authenticated;
grant select, insert, update, delete on app.approval_task_events to authenticated;
grant select, insert, update, delete on app.profile_import_jobs to authenticated;
