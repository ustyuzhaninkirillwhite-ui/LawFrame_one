alter table app.workflow_run_inputs enable row level security;
alter table app.run_step_events enable row level security;
alter table app.approval_decisions enable row level security;
alter table app.delivery_requests enable row level security;
alter table app.delivery_attempts enable row level security;
alter table app.delivery_events enable row level security;
alter table app.domain_outbox_events enable row level security;
alter table app.notifications enable row level security;

drop policy if exists workflow_run_inputs_select_member on app.workflow_run_inputs;
create policy workflow_run_inputs_select_member
  on app.workflow_run_inputs
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists workflow_run_inputs_manage_runner on app.workflow_run_inputs;
create policy workflow_run_inputs_manage_runner
  on app.workflow_run_inputs
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'automation.run'))
  with check (public.has_workspace_permission(workspace_id, 'automation.run'));

drop policy if exists run_step_events_select_member on app.run_step_events;
create policy run_step_events_select_member
  on app.run_step_events
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists run_step_events_manage_runner on app.run_step_events;
create policy run_step_events_manage_runner
  on app.run_step_events
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'automation.run'))
  with check (public.has_workspace_permission(workspace_id, 'automation.run'));

drop policy if exists approval_decisions_select_member on app.approval_decisions;
create policy approval_decisions_select_member
  on app.approval_decisions
  for select
  to authenticated
  using (
    public.has_workspace_permission(workspace_id, 'approval.task.read')
    or public.has_workspace_permission(workspace_id, 'automation.run')
  );

drop policy if exists approval_decisions_manage_decider on app.approval_decisions;
create policy approval_decisions_manage_decider
  on app.approval_decisions
  for all
  to authenticated
  using (
    public.has_workspace_permission(workspace_id, 'approval.task.decide')
    or public.has_workspace_permission(workspace_id, 'automation.run')
  )
  with check (
    public.has_workspace_permission(workspace_id, 'approval.task.decide')
    or public.has_workspace_permission(workspace_id, 'automation.run')
  );

drop policy if exists delivery_requests_select_member on app.delivery_requests;
create policy delivery_requests_select_member
  on app.delivery_requests
  for select
  to authenticated
  using (
    public.has_workspace_permission(workspace_id, 'automation.read')
    or public.has_workspace_permission(workspace_id, 'approval.task.read')
  );

drop policy if exists delivery_requests_manage_runner on app.delivery_requests;
create policy delivery_requests_manage_runner
  on app.delivery_requests
  for all
  to authenticated
  using (
    public.has_workspace_permission(workspace_id, 'automation.run')
    or public.has_workspace_permission(workspace_id, 'approval.task.decide')
  )
  with check (
    public.has_workspace_permission(workspace_id, 'automation.run')
    or public.has_workspace_permission(workspace_id, 'approval.task.decide')
  );

drop policy if exists delivery_attempts_select_member on app.delivery_attempts;
create policy delivery_attempts_select_member
  on app.delivery_attempts
  for select
  to authenticated
  using (
    public.has_workspace_permission(workspace_id, 'automation.read')
    or public.has_workspace_permission(workspace_id, 'approval.task.read')
  );

drop policy if exists delivery_attempts_manage_runner on app.delivery_attempts;
create policy delivery_attempts_manage_runner
  on app.delivery_attempts
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'automation.run'))
  with check (public.has_workspace_permission(workspace_id, 'automation.run'));

drop policy if exists delivery_events_select_member on app.delivery_events;
create policy delivery_events_select_member
  on app.delivery_events
  for select
  to authenticated
  using (
    public.has_workspace_permission(workspace_id, 'automation.read')
    or public.has_workspace_permission(workspace_id, 'approval.task.read')
  );

drop policy if exists delivery_events_manage_runner on app.delivery_events;
create policy delivery_events_manage_runner
  on app.delivery_events
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'automation.run'))
  with check (public.has_workspace_permission(workspace_id, 'automation.run'));

drop policy if exists domain_outbox_events_select_auditor on app.domain_outbox_events;
create policy domain_outbox_events_select_auditor
  on app.domain_outbox_events
  for select
  to authenticated
  using (
    workspace_id is null
    or public.has_workspace_permission(workspace_id, 'audit.read')
    or public.has_workspace_permission(workspace_id, 'automation.run')
  );

drop policy if exists domain_outbox_events_manage_runner on app.domain_outbox_events;
create policy domain_outbox_events_manage_runner
  on app.domain_outbox_events
  for all
  to authenticated
  using (
    workspace_id is null
    or public.has_workspace_permission(workspace_id, 'automation.run')
  )
  with check (
    workspace_id is null
    or public.has_workspace_permission(workspace_id, 'automation.run')
  );

drop policy if exists notifications_select_member on app.notifications;
create policy notifications_select_member
  on app.notifications
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists notifications_manage_member on app.notifications;
create policy notifications_manage_member
  on app.notifications
  for all
  to authenticated
  using (
    public.is_workspace_member(workspace_id)
    or public.has_workspace_permission(workspace_id, 'automation.run')
  )
  with check (
    public.is_workspace_member(workspace_id)
    or public.has_workspace_permission(workspace_id, 'automation.run')
  );

grant select, insert, update on app.workflow_run_inputs to authenticated;
grant select, insert, update on app.run_step_events to authenticated;
grant select, insert, update on app.approval_decisions to authenticated;
grant select, insert, update on app.delivery_requests to authenticated;
grant select, insert, update on app.delivery_attempts to authenticated;
grant select, insert, update on app.delivery_events to authenticated;
grant select, insert, update on app.domain_outbox_events to authenticated;
grant select, insert, update on app.notifications to authenticated;
