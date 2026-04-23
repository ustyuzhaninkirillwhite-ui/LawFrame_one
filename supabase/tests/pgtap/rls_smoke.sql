begin;

select plan(18);

select has_schema('app', 'app schema exists');
select has_schema('api', 'api schema exists');
select has_schema('audit', 'audit schema exists');
select has_schema('private', 'private schema exists');

select has_table('app', 'profiles', 'profiles table exists');
select has_table('app', 'workspaces', 'workspaces table exists');
select has_table('app', 'workspace_members', 'workspace_members table exists');
select has_table('app', 'workspace_invitations', 'workspace_invitations table exists');
select has_table('audit', 'audit_events', 'audit_events table exists');

select col_is_pk('app', 'profiles', 'id', 'profiles.id is primary key');
select col_is_pk('app', 'workspaces', 'id', 'workspaces.id is primary key');

select ok(
  (select relrowsecurity from pg_class where oid = 'app.profiles'::regclass),
  'profiles RLS is enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'app.workspaces'::regclass),
  'workspaces RLS is enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'app.workspace_members'::regclass),
  'workspace_members RLS is enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'app.workspace_invitations'::regclass),
  'workspace_invitations RLS is enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'audit.audit_events'::regclass),
  'audit_events RLS is enabled'
);

select has_function('public', 'is_workspace_member', array['uuid', 'uuid'], 'workspace membership helper exists');
select has_function('public', 'has_workspace_permission', array['uuid', 'text', 'uuid'], 'workspace permission helper exists');

select * from finish();

rollback;
