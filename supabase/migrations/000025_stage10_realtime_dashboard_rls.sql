alter table app.live_events enable row level security;
alter table app.realtime_topic_acl enable row level security;
alter table app.notification_preferences enable row level security;
alter table app.device_tokens enable row level security;

drop policy if exists notifications_select_member on app.notifications;
create policy notifications_select_member
  on app.notifications
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or (
      user_id is null
      and public.has_workspace_permission(workspace_id, 'dashboard.view')
    )
  );

drop policy if exists notifications_manage_member on app.notifications;
create policy notifications_manage_member
  on app.notifications
  for all
  to authenticated
  using (
    user_id = auth.uid()
    or public.has_workspace_permission(workspace_id, 'automation.run')
  )
  with check (
    (
      user_id is null
      and public.has_workspace_permission(workspace_id, 'automation.run')
    )
    or user_id = auth.uid()
  );

drop policy if exists live_events_select_member on app.live_events;
create policy live_events_select_member
  on app.live_events
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or (
      workspace_id is not null
      and public.has_workspace_permission(workspace_id, 'dashboard.view')
    )
  );

drop policy if exists realtime_topic_acl_select_member on app.realtime_topic_acl;
create policy realtime_topic_acl_select_member
  on app.realtime_topic_acl
  for select
  to authenticated
  using (public.can_receive_realtime_topic(topic));

drop policy if exists notification_preferences_select_owner on app.notification_preferences;
create policy notification_preferences_select_owner
  on app.notification_preferences
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists notification_preferences_manage_owner on app.notification_preferences;
create policy notification_preferences_manage_owner
  on app.notification_preferences
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists device_tokens_select_owner on app.device_tokens;
create policy device_tokens_select_owner
  on app.device_tokens
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists device_tokens_manage_owner on app.device_tokens;
create policy device_tokens_manage_owner
  on app.device_tokens
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select on app.live_events to authenticated;
grant select on app.realtime_topic_acl to authenticated;
grant select, insert, update on app.notification_preferences to authenticated;
grant select, insert, update, delete on app.device_tokens to authenticated;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'realtime'
      and table_name = 'messages'
  ) then
    execute 'alter table realtime.messages enable row level security';

    if exists (
      select 1
      from pg_policy
      where polrelid = 'realtime.messages'::regclass
        and polname = 'realtime_messages_select_authorized_topics'
    ) then
      execute 'drop policy realtime_messages_select_authorized_topics on realtime.messages';
    end if;

    execute $policy$
      create policy realtime_messages_select_authorized_topics
        on realtime.messages
        for select
        to authenticated
        using (public.can_receive_realtime_topic(realtime.topic()))
    $policy$;
  end if;
end $$;
