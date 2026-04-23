create or replace function public.is_workspace_member(target_workspace_id uuid, target_user_id uuid)
returns boolean
language sql
stable
as $$
  select exists(
    select 1
    from workspace_members
    where workspace_id = target_workspace_id
      and auth_user_id = target_user_id
  );
$$;

create or replace function public.has_workspace_permission(
  target_workspace_id uuid,
  target_user_id uuid,
  required_role workspace_role
)
returns boolean
language sql
stable
as $$
  select exists(
    select 1
    from workspace_members
    where workspace_id = target_workspace_id
      and auth_user_id = target_user_id
      and role = required_role
  );
$$;

