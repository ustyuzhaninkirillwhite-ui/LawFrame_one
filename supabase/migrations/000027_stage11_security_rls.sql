create table if not exists app.data_access_profiles (
  table_name text primary key,
  owner_column text null,
  workspace_column text null,
  visibility_column text null,
  contains_personal_data boolean not null default false,
  contains_legal_secret boolean not null default false,
  allow_direct_client_read boolean not null default false,
  allow_direct_client_write boolean not null default false,
  requires_backend_only boolean not null default false,
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.is_session_owner(target_session_id text)
returns boolean
language sql
stable
security definer
set search_path = app, public, auth, pg_catalog
as $$
  select exists(
    select 1
    from app.user_sessions s
    where s.id = target_session_id
      and s.user_id = auth.uid()
  );
$$;

grant execute on function public.is_session_owner(text) to authenticated;

alter table app.user_sessions enable row level security;
alter table app.workspace_security_settings enable row level security;
alter table app.reauth_challenges enable row level security;
alter table app.session_risk_signals enable row level security;
alter table app.data_access_profiles enable row level security;

create policy user_sessions_select_owner_or_security_admin
  on app.user_sessions
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or (
      workspace_id is not null
      and public.has_workspace_permission(workspace_id, 'session.read')
    )
  );

create policy user_sessions_update_security_admin
  on app.user_sessions
  for update
  to authenticated
  using (
    workspace_id is not null
    and public.has_workspace_permission(workspace_id, 'session.revoke')
  )
  with check (
    workspace_id is not null
    and public.has_workspace_permission(workspace_id, 'session.revoke')
  );

create policy workspace_security_settings_select_security_admin
  on app.workspace_security_settings
  for select
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'workspace.security.read'));

create policy workspace_security_settings_update_security_admin
  on app.workspace_security_settings
  for update
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'workspace.security.manage'))
  with check (public.has_workspace_permission(workspace_id, 'workspace.security.manage'));

create policy reauth_challenges_select_owner
  on app.reauth_challenges
  for select
  to authenticated
  using (user_id = auth.uid());

create policy reauth_challenges_insert_owner
  on app.reauth_challenges
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy reauth_challenges_update_owner
  on app.reauth_challenges
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy session_risk_signals_select_security_admin
  on app.session_risk_signals
  for select
  to authenticated
  using (
    workspace_id is not null
    and public.has_workspace_permission(workspace_id, 'session.read')
  );

create policy data_access_profiles_select_security_admin
  on app.data_access_profiles
  for select
  to authenticated
  using (true);

grant select, update on app.user_sessions to authenticated;
grant select, update on app.workspace_security_settings to authenticated;
grant select, insert, update on app.reauth_challenges to authenticated;
grant select on app.session_risk_signals to authenticated;
grant select on app.data_access_profiles to authenticated;

create index if not exists idx_app_data_access_profiles_client_read
  on app.data_access_profiles (allow_direct_client_read, requires_backend_only);
