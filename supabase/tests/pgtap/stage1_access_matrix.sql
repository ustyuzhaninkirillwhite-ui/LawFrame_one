begin;

select plan(17);

select ok(
  exists(
    select 1
    from pg_policy
    where polrelid = 'app.workspaces'::regclass
      and polname = 'workspaces_select_member'
  ),
  'workspaces select policy exists'
);
select ok(
  exists(
    select 1
    from pg_policy
    where polrelid = 'app.workspaces'::regclass
      and polname = 'workspaces_update_manager'
  ),
  'workspaces update policy exists'
);
select ok(
  exists(
    select 1
    from pg_policy
    where polrelid = 'app.workspace_members'::regclass
      and polname = 'workspace_members_select_member'
  ),
  'workspace members select policy exists'
);
select ok(
  exists(
    select 1
    from pg_policy
    where polrelid = 'app.workspace_members'::regclass
      and polname = 'workspace_members_insert_inviter'
  ),
  'workspace members insert policy exists'
);
select ok(
  exists(
    select 1
    from pg_policy
    where polrelid = 'app.workspace_members'::regclass
      and polname = 'workspace_members_update_role_manager'
  ),
  'workspace member role-update policy exists'
);
select ok(
  exists(
    select 1
    from pg_policy
    where polrelid = 'app.workspace_members'::regclass
      and polname = 'workspace_members_delete_manager'
  ),
  'workspace member delete policy exists'
);
select ok(
  exists(
    select 1
    from pg_policy
    where polrelid = 'app.workspace_invitations'::regclass
      and polname = 'workspace_invitations_manage'
  ),
  'workspace invitations policy exists'
);
select ok(
  exists(
    select 1
    from pg_policy
    where polrelid = 'audit.audit_events'::regclass
      and polname = 'audit_events_read'
  ),
  'audit read policy exists'
);

select ok(
  has_table_privilege('authenticated', 'app.roles', 'SELECT'),
  'authenticated role can read app.roles'
);
select ok(
  has_table_privilege('authenticated', 'app.permissions', 'SELECT'),
  'authenticated role can read app.permissions'
);
select ok(
  has_table_privilege('authenticated', 'app.role_permissions', 'SELECT'),
  'authenticated role can read app.role_permissions'
);

select ok(
  not has_schema_privilege('anon', 'app', 'USAGE'),
  'anon cannot use app schema'
);
select ok(
  not has_schema_privilege('anon', 'audit', 'USAGE'),
  'anon cannot use audit schema'
);
select ok(
  not has_schema_privilege('authenticated', 'private', 'USAGE'),
  'authenticated cannot use private schema'
);
select ok(
  has_schema_privilege('authenticated', 'api', 'USAGE'),
  'authenticated can use api schema'
);

select ok(
  exists(
    select 1
    from pg_views
    where schemaname = 'api'
      and viewname = 'workspace_summaries'
  ),
  'api.workspace_summaries view exists'
);
select ok(
  has_table_privilege('authenticated', 'api.workspace_summaries', 'SELECT'),
  'authenticated role can read api.workspace_summaries'
);

select * from finish();

rollback;
