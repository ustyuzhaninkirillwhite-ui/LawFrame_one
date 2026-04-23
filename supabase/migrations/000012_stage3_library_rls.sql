alter table app.legal_modules enable row level security;
alter table app.legal_module_versions enable row level security;
alter table app.automation_templates enable row level security;
alter table app.automation_template_versions enable row level security;
alter table app.installed_automations enable row level security;
alter table app.publication_requests enable row level security;

create policy legal_modules_select_authenticated
  on app.legal_modules
  for select
  to authenticated
  using (deleted_at is null);

create policy legal_module_versions_select_authenticated
  on app.legal_module_versions
  for select
  to authenticated
  using (
    exists (
      select 1
      from app.legal_modules lm
      where lm.id = module_id
        and lm.deleted_at is null
    )
  );

create policy automation_templates_select_visible
  on app.automation_templates
  for select
  to authenticated
  using (
    deleted_at is null
    and (
      scope in ('product', 'public')
      or (
        workspace_id is not null
        and public.is_workspace_member(workspace_id)
      )
    )
  );

create policy automation_templates_insert_editor
  on app.automation_templates
  for insert
  to authenticated
  with check (
    workspace_id is not null
    and public.has_workspace_permission(workspace_id, 'automation.edit')
  );

create policy automation_templates_update_editor
  on app.automation_templates
  for update
  to authenticated
  using (
    deleted_at is null
    and workspace_id is not null
    and public.has_workspace_permission(workspace_id, 'automation.edit')
  )
  with check (
    workspace_id is not null
    and public.has_workspace_permission(workspace_id, 'automation.edit')
  );

create policy automation_template_versions_select_visible
  on app.automation_template_versions
  for select
  to authenticated
  using (
    exists (
      select 1
      from app.automation_templates at
      where at.id = template_id
        and at.deleted_at is null
        and (
          at.scope in ('product', 'public')
          or (
            at.workspace_id is not null
            and public.is_workspace_member(at.workspace_id)
          )
        )
    )
  );

create policy automation_template_versions_insert_editor
  on app.automation_template_versions
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from app.automation_templates at
      where at.id = template_id
        and at.workspace_id is not null
        and public.has_workspace_permission(at.workspace_id, 'automation.edit')
    )
  );

create policy automation_template_versions_update_editor
  on app.automation_template_versions
  for update
  to authenticated
  using (
    exists (
      select 1
      from app.automation_templates at
      where at.id = template_id
        and at.workspace_id is not null
        and public.has_workspace_permission(at.workspace_id, 'automation.edit')
    )
  )
  with check (
    exists (
      select 1
      from app.automation_templates at
      where at.id = template_id
        and at.workspace_id is not null
        and public.has_workspace_permission(at.workspace_id, 'automation.edit')
    )
  );

create policy installed_automations_select_member
  on app.installed_automations
  for select
  to authenticated
  using (
    deleted_at is null
    and public.is_workspace_member(workspace_id)
  );

create policy installed_automations_insert_installer
  on app.installed_automations
  for insert
  to authenticated
  with check (
    public.has_workspace_permission(workspace_id, 'automation.install')
  );

create policy installed_automations_update_editor
  on app.installed_automations
  for update
  to authenticated
  using (
    deleted_at is null
    and public.has_workspace_permission(workspace_id, 'automation.edit')
  )
  with check (
    public.has_workspace_permission(workspace_id, 'automation.edit')
  );

create policy publication_requests_select_visible
  on app.publication_requests
  for select
  to authenticated
  using (
    public.is_workspace_member(workspace_id)
    or public.has_workspace_permission(workspace_id, 'moderation.review')
  );

create policy publication_requests_insert_submitter
  on app.publication_requests
  for insert
  to authenticated
  with check (
    public.has_workspace_permission(workspace_id, 'automation.submit_publication')
  );

create policy publication_requests_update_moderator
  on app.publication_requests
  for update
  to authenticated
  using (
    public.has_workspace_permission(workspace_id, 'moderation.review')
  )
  with check (
    public.has_workspace_permission(workspace_id, 'moderation.review')
  );

grant select on app.legal_modules, app.legal_module_versions to authenticated;
grant select, insert, update on app.automation_templates to authenticated;
grant select, insert, update on app.automation_template_versions to authenticated;
grant select, insert, update on app.installed_automations to authenticated;
grant select, insert, update on app.publication_requests to authenticated;
