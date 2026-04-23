begin;

select plan(20);

select has_table('app', 'activepieces_project_bindings', 'runtime project bindings table exists');
select has_table('app', 'activepieces_user_bindings', 'runtime user bindings table exists');
select has_table('app', 'automation_runtime_bindings', 'automation runtime bindings table exists');
select has_table('app', 'workflow_runs', 'app.workflow_runs exists');
select has_table('app', 'workflow_run_steps', 'app.workflow_run_steps exists');
select has_table('app', 'runtime_connections', 'runtime connections table exists');
select has_table('app', 'activepieces_callback_receipts', 'callback receipts table exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'app.workflow_runs'::regclass),
  'app.workflow_runs RLS is enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'app.runtime_connections'::regclass),
  'app.runtime_connections RLS is enabled'
);

select ok(
  exists(select 1 from pg_policy where polrelid = 'app.workflow_runs'::regclass and polname = 'workflow_runs_manage_runner'),
  'workflow run manage policy exists'
);
select ok(
  exists(select 1 from pg_policy where polrelid = 'app.runtime_connections'::regclass and polname = 'runtime_connections_manage_workspace'),
  'runtime connections policy exists'
);

select ok(
  has_table_privilege('authenticated', 'app.workflow_runs', 'SELECT'),
  'authenticated can read workflow runs'
);
select ok(
  has_table_privilege('authenticated', 'app.runtime_connections', 'INSERT'),
  'authenticated can insert runtime connections'
);

select ok(
  exists(select 1 from pg_indexes where schemaname = 'app' and indexname = 'idx_app_workflow_runs_workspace'),
  'workflow runs index exists'
);
select ok(
  exists(select 1 from pg_indexes where schemaname = 'app' and indexname = 'idx_app_runtime_connections_workspace'),
  'runtime connections index exists'
);

select results_eq(
  $$ select count(*)::int from app.permissions where code in (
    'automation.approve_external',
    'connections.manage'
  ) $$,
  $$ values (2) $$,
  'stage 4 permissions are seeded'
);

select ok(
  exists(select 1 from app.role_permissions where permission_code = 'connections.manage' and role_code = 'owner'),
  'owner receives connections.manage'
);
select ok(
  exists(select 1 from app.role_permissions where permission_code = 'automation.approve_external' and role_code = 'lawyer'),
  'lawyer receives automation.approve_external'
);

select col_is_pk('app', 'workflow_runs', 'id', 'workflow_runs has primary key');
select col_is_pk('app', 'workflow_run_steps', 'id', 'workflow_run_steps has primary key');
select col_is_pk('app', 'runtime_connections', 'id', 'runtime_connections has primary key');

select col_type_is('app', 'installed_automations', 'runtime_project_id', 'text', 'installed automations stores runtime project id');
select col_type_is('app', 'installed_automations', 'runtime_flow_id', 'text', 'installed automations stores runtime flow id');

select * from finish();

rollback;
