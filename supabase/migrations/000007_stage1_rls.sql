create or replace function public.is_workspace_member(
  target_workspace_id uuid,
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = app, public, auth, pg_catalog
as $$
  select exists(
    select 1
    from app.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.auth_user_id = target_user_id
      and wm.status = 'active'
      and wm.deleted_at is null
  );
$$;

create or replace function public.has_workspace_permission(
  target_workspace_id uuid,
  required_permission text,
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = app, public, auth, pg_catalog
as $$
  select exists(
    select 1
    from app.workspace_members wm
    inner join app.role_permissions rp
      on rp.role_code = wm.role_code
    where wm.workspace_id = target_workspace_id
      and wm.auth_user_id = target_user_id
      and wm.status = 'active'
      and wm.deleted_at is null
      and rp.permission_code = required_permission
  );
$$;

grant execute on function public.is_workspace_member(uuid, uuid) to authenticated;
grant execute on function public.has_workspace_permission(uuid, text, uuid) to authenticated;

alter table app.roles enable row level security;
alter table app.permissions enable row level security;
alter table app.role_permissions enable row level security;
alter table app.profiles enable row level security;
alter table app.workspaces enable row level security;
alter table app.workspace_members enable row level security;
alter table app.workspace_invitations enable row level security;
alter table audit.audit_events enable row level security;

create policy roles_read_authenticated
  on app.roles
  for select
  to authenticated
  using (true);

create policy permissions_read_authenticated
  on app.permissions
  for select
  to authenticated
  using (true);

create policy role_permissions_read_authenticated
  on app.role_permissions
  for select
  to authenticated
  using (true);

create policy profiles_select_self
  on app.profiles
  for select
  to authenticated
  using (id = auth.uid() and deleted_at is null);

create policy profiles_update_self
  on app.profiles
  for update
  to authenticated
  using (id = auth.uid() and deleted_at is null)
  with check (id = auth.uid() and deleted_at is null);

create policy workspaces_select_member
  on app.workspaces
  for select
  to authenticated
  using (deleted_at is null and public.is_workspace_member(id));

create policy workspaces_update_manager
  on app.workspaces
  for update
  to authenticated
  using (
    deleted_at is null and public.has_workspace_permission(id, 'workspace.update')
  )
  with check (
    deleted_at is null and public.has_workspace_permission(id, 'workspace.update')
  );

create policy workspace_members_select_member
  on app.workspace_members
  for select
  to authenticated
  using (
    deleted_at is null and public.is_workspace_member(workspace_id)
  );

create policy workspace_members_insert_inviter
  on app.workspace_members
  for insert
  to authenticated
  with check (
    public.has_workspace_permission(workspace_id, 'workspace.invite')
  );

create policy workspace_members_update_role_manager
  on app.workspace_members
  for update
  to authenticated
  using (
    deleted_at is null and public.has_workspace_permission(workspace_id, 'workspace.member.update_role')
  )
  with check (
    public.has_workspace_permission(workspace_id, 'workspace.member.update_role')
  );

create policy workspace_members_delete_manager
  on app.workspace_members
  for delete
  to authenticated
  using (
    deleted_at is null and public.has_workspace_permission(workspace_id, 'workspace.member.remove')
  );

create policy workspace_invitations_manage
  on app.workspace_invitations
  for all
  to authenticated
  using (
    deleted_at is null and public.has_workspace_permission(workspace_id, 'workspace.invite')
  )
  with check (
    public.has_workspace_permission(workspace_id, 'workspace.invite')
  );

create policy audit_events_read
  on audit.audit_events
  for select
  to authenticated
  using (
    workspace_id is not null
    and public.has_workspace_permission(workspace_id, 'audit.read')
  );

grant select on app.roles, app.permissions, app.role_permissions to authenticated;
grant select, update on app.profiles to authenticated;
grant select, update on app.workspaces to authenticated;
grant select, insert, update, delete on app.workspace_members to authenticated;
grant select, insert, update, delete on app.workspace_invitations to authenticated;
grant select on audit.audit_events to authenticated;

create or replace view api.workspace_summaries as
select
  w.id,
  w.slug,
  w.name,
  w.status
from app.workspaces w
where w.deleted_at is null
  and public.is_workspace_member(w.id);

grant select on api.workspace_summaries to authenticated;
