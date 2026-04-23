alter table app.event_definitions enable row level security;
alter table app.product_event_outbox enable row level security;
alter table app.product_event_quarantine enable row level security;
alter table app.recommendation_candidates enable row level security;
alter table app.recommendation_instances enable row level security;
alter table app.recommendation_feedback enable row level security;
alter table app.recommendation_suppressions enable row level security;
alter table app.process_case_snapshots enable row level security;
alter table app.recommendation_quality_snapshots enable row level security;

drop policy if exists event_definitions_select_admin on app.event_definitions;
create policy event_definitions_select_admin
  on app.event_definitions
  for select
  to authenticated
  using (false);

drop policy if exists product_event_outbox_select_admin on app.product_event_outbox;
create policy product_event_outbox_select_admin
  on app.product_event_outbox
  for select
  to authenticated
  using (
    public.has_workspace_permission(workspace_id, 'audit.read')
    or public.has_workspace_permission(workspace_id, 'recommendation.manage')
  );

drop policy if exists product_event_outbox_manage_runner on app.product_event_outbox;
create policy product_event_outbox_manage_runner
  on app.product_event_outbox
  for all
  to authenticated
  using (
    public.has_workspace_permission(workspace_id, 'automation.run')
    or public.has_workspace_permission(workspace_id, 'recommendation.manage')
  )
  with check (
    public.has_workspace_permission(workspace_id, 'automation.run')
    or public.has_workspace_permission(workspace_id, 'recommendation.manage')
  );

drop policy if exists product_event_quarantine_select_admin on app.product_event_quarantine;
create policy product_event_quarantine_select_admin
  on app.product_event_quarantine
  for select
  to authenticated
  using (
    public.has_workspace_permission(workspace_id, 'audit.read')
    or public.has_workspace_permission(workspace_id, 'recommendation.manage')
  );

drop policy if exists product_event_quarantine_manage_admin on app.product_event_quarantine;
create policy product_event_quarantine_manage_admin
  on app.product_event_quarantine
  for all
  to authenticated
  using (
    public.has_workspace_permission(workspace_id, 'recommendation.manage')
    or public.has_workspace_permission(workspace_id, 'automation.run')
  )
  with check (
    public.has_workspace_permission(workspace_id, 'recommendation.manage')
    or public.has_workspace_permission(workspace_id, 'automation.run')
  );

drop policy if exists recommendation_candidates_select_member on app.recommendation_candidates;
create policy recommendation_candidates_select_member
  on app.recommendation_candidates
  for select
  to authenticated
  using (
    (
      scope = 'personal'
      and owner_user_id = (select auth.uid())
      and public.has_workspace_permission(workspace_id, 'recommendation.read')
    )
    or (
      scope = 'team'
      and public.has_workspace_permission(workspace_id, 'recommendation.manage')
    )
  );

drop policy if exists recommendation_candidates_manage_admin on app.recommendation_candidates;
create policy recommendation_candidates_manage_admin
  on app.recommendation_candidates
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'recommendation.manage'))
  with check (public.has_workspace_permission(workspace_id, 'recommendation.manage'));

drop policy if exists recommendation_instances_select_member on app.recommendation_instances;
create policy recommendation_instances_select_member
  on app.recommendation_instances
  for select
  to authenticated
  using (
    (
      scope = 'personal'
      and owner_user_id = (select auth.uid())
      and public.has_workspace_permission(workspace_id, 'recommendation.read')
    )
    or (
      scope = 'team'
      and public.has_workspace_permission(workspace_id, 'recommendation.manage')
    )
  );

drop policy if exists recommendation_instances_manage_member on app.recommendation_instances;
create policy recommendation_instances_manage_member
  on app.recommendation_instances
  for all
  to authenticated
  using (
    (
      scope = 'personal'
      and owner_user_id = (select auth.uid())
      and (
        public.has_workspace_permission(workspace_id, 'recommendation.read')
        or public.has_workspace_permission(workspace_id, 'recommendation.accept')
      )
    )
    or (
      scope = 'team'
      and public.has_workspace_permission(workspace_id, 'recommendation.manage')
    )
  )
  with check (
    (
      scope = 'personal'
      and owner_user_id = (select auth.uid())
      and (
        public.has_workspace_permission(workspace_id, 'recommendation.read')
        or public.has_workspace_permission(workspace_id, 'recommendation.accept')
      )
    )
    or (
      scope = 'team'
      and public.has_workspace_permission(workspace_id, 'recommendation.manage')
    )
  );

drop policy if exists recommendation_feedback_select_member on app.recommendation_feedback;
create policy recommendation_feedback_select_member
  on app.recommendation_feedback
  for select
  to authenticated
  using (
    exists (
      select 1
      from app.recommendation_candidates c
      where c.id = recommendation_id
        and (
          (
            c.scope = 'personal'
            and c.owner_user_id = (select auth.uid())
            and public.has_workspace_permission(c.workspace_id, 'recommendation.read')
          )
          or (
            c.scope = 'team'
            and public.has_workspace_permission(c.workspace_id, 'recommendation.manage')
          )
        )
    )
  );

drop policy if exists recommendation_feedback_manage_member on app.recommendation_feedback;
create policy recommendation_feedback_manage_member
  on app.recommendation_feedback
  for all
  to authenticated
  using (
    actor_user_id = (select auth.uid())
    or public.has_workspace_permission(workspace_id, 'recommendation.manage')
  )
  with check (
    actor_user_id = (select auth.uid())
    or public.has_workspace_permission(workspace_id, 'recommendation.manage')
  );

drop policy if exists recommendation_suppressions_select_admin on app.recommendation_suppressions;
create policy recommendation_suppressions_select_admin
  on app.recommendation_suppressions
  for select
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'recommendation.manage'));

drop policy if exists recommendation_suppressions_manage_admin on app.recommendation_suppressions;
create policy recommendation_suppressions_manage_admin
  on app.recommendation_suppressions
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'recommendation.manage'))
  with check (public.has_workspace_permission(workspace_id, 'recommendation.manage'));

drop policy if exists process_case_snapshots_select_admin on app.process_case_snapshots;
create policy process_case_snapshots_select_admin
  on app.process_case_snapshots
  for select
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'recommendation.manage'));

drop policy if exists process_case_snapshots_manage_admin on app.process_case_snapshots;
create policy process_case_snapshots_manage_admin
  on app.process_case_snapshots
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'recommendation.manage'))
  with check (public.has_workspace_permission(workspace_id, 'recommendation.manage'));

drop policy if exists recommendation_quality_snapshots_select_admin on app.recommendation_quality_snapshots;
create policy recommendation_quality_snapshots_select_admin
  on app.recommendation_quality_snapshots
  for select
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'recommendation.manage'));

drop policy if exists recommendation_quality_snapshots_manage_admin on app.recommendation_quality_snapshots;
create policy recommendation_quality_snapshots_manage_admin
  on app.recommendation_quality_snapshots
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'recommendation.manage'))
  with check (public.has_workspace_permission(workspace_id, 'recommendation.manage'));

grant select, insert, update on app.product_event_outbox to authenticated;
grant select, insert, update on app.product_event_quarantine to authenticated;
grant select, insert, update, delete on app.recommendation_candidates to authenticated;
grant select, insert, update, delete on app.recommendation_instances to authenticated;
grant select, insert, update on app.recommendation_feedback to authenticated;
grant select, insert, update, delete on app.recommendation_suppressions to authenticated;
grant select, insert, update, delete on app.process_case_snapshots to authenticated;
grant select, insert, update, delete on app.recommendation_quality_snapshots to authenticated;
