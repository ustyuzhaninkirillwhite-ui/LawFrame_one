alter table app.activepieces_project_bindings enable row level security;
alter table app.activepieces_user_bindings enable row level security;
alter table app.activepieces_embed_sessions enable row level security;
alter table app.automation_runtime_bindings enable row level security;
alter table app.automation_sync_jobs enable row level security;
alter table app.automation_compile_errors enable row level security;
alter table app.workflow_runs enable row level security;
alter table app.workflow_run_steps enable row level security;
alter table app.activepieces_run_bindings enable row level security;
alter table app.runtime_connections enable row level security;
alter table app.activepieces_callback_receipts enable row level security;

create policy activepieces_project_bindings_select_member
  on app.activepieces_project_bindings
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy activepieces_project_bindings_manage_sync
  on app.activepieces_project_bindings
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'activepieces.sync_flow'))
  with check (public.has_workspace_permission(workspace_id, 'activepieces.sync_flow'));

create policy activepieces_user_bindings_select_member
  on app.activepieces_user_bindings
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy activepieces_user_bindings_manage_builder
  on app.activepieces_user_bindings
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'activepieces.open_builder'))
  with check (public.has_workspace_permission(workspace_id, 'activepieces.open_builder'));

create policy activepieces_embed_sessions_select_member
  on app.activepieces_embed_sessions
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy activepieces_embed_sessions_manage_builder
  on app.activepieces_embed_sessions
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'activepieces.open_builder'))
  with check (public.has_workspace_permission(workspace_id, 'activepieces.open_builder'));

create policy automation_runtime_bindings_select_member
  on app.automation_runtime_bindings
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy automation_runtime_bindings_manage_sync
  on app.automation_runtime_bindings
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'activepieces.sync_flow'))
  with check (public.has_workspace_permission(workspace_id, 'activepieces.sync_flow'));

create policy automation_sync_jobs_select_member
  on app.automation_sync_jobs
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy automation_sync_jobs_manage_sync
  on app.automation_sync_jobs
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'activepieces.sync_flow'))
  with check (public.has_workspace_permission(workspace_id, 'activepieces.sync_flow'));

create policy automation_compile_errors_select_member
  on app.automation_compile_errors
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy automation_compile_errors_manage_sync
  on app.automation_compile_errors
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'activepieces.sync_flow'))
  with check (public.has_workspace_permission(workspace_id, 'activepieces.sync_flow'));

create policy workflow_runs_select_member
  on app.workflow_runs
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy workflow_runs_manage_runner
  on app.workflow_runs
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'automation.run'))
  with check (public.has_workspace_permission(workspace_id, 'automation.run'));

create policy workflow_run_steps_select_member
  on app.workflow_run_steps
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy workflow_run_steps_manage_runner
  on app.workflow_run_steps
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'automation.run'))
  with check (public.has_workspace_permission(workspace_id, 'automation.run'));

create policy activepieces_run_bindings_select_member
  on app.activepieces_run_bindings
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy activepieces_run_bindings_manage_runner
  on app.activepieces_run_bindings
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'automation.run'))
  with check (public.has_workspace_permission(workspace_id, 'automation.run'));

create policy runtime_connections_select_member
  on app.runtime_connections
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy runtime_connections_manage_workspace
  on app.runtime_connections
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'connections.manage'))
  with check (public.has_workspace_permission(workspace_id, 'connections.manage'));

create policy activepieces_callback_receipts_select_member
  on app.activepieces_callback_receipts
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy activepieces_callback_receipts_manage_runner
  on app.activepieces_callback_receipts
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'automation.run'))
  with check (public.has_workspace_permission(workspace_id, 'automation.run'));

grant select, insert, update on app.activepieces_project_bindings to authenticated;
grant select, insert, update on app.activepieces_user_bindings to authenticated;
grant select, insert, update on app.activepieces_embed_sessions to authenticated;
grant select, insert, update on app.automation_runtime_bindings to authenticated;
grant select, insert, update on app.automation_sync_jobs to authenticated;
grant select, insert, update on app.automation_compile_errors to authenticated;
grant select, insert, update on app.workflow_runs to authenticated;
grant select, insert, update on app.workflow_run_steps to authenticated;
grant select, insert, update on app.activepieces_run_bindings to authenticated;
grant select, insert, update on app.runtime_connections to authenticated;
grant select, insert, update on app.activepieces_callback_receipts to authenticated;
