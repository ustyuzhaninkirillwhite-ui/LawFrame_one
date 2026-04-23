begin;

select plan(28);

select has_table('app', 'legal_work_profiles', 'legal work profiles table exists');
select has_table('app', 'legal_work_profile_versions', 'legal work profile versions table exists');
select has_table('app', 'effective_profile_snapshots', 'effective profile snapshots table exists');
select has_table('app', 'document_types', 'document types table exists');
select has_table('app', 'document_templates', 'document templates table exists');
select has_table('app', 'document_generation_jobs', 'document generation jobs table exists');
select has_table('app', 'document_validation_reports', 'document validation reports table exists');
select has_table('app', 'approval_routes', 'approval routes table exists');
select has_table('app', 'approval_tasks', 'approval tasks table exists');
select has_table('app', 'profile_import_jobs', 'profile import jobs table exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'app.legal_work_profiles'::regclass),
  'legal_work_profiles RLS is enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'app.document_templates'::regclass),
  'document_templates RLS is enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'app.approval_tasks'::regclass),
  'approval_tasks RLS is enabled'
);

select ok(
  exists(select 1 from pg_policy where polrelid = 'app.legal_work_profiles'::regclass and polname = 'legal_work_profiles_select_member'),
  'profile select policy exists'
);
select ok(
  exists(select 1 from pg_policy where polrelid = 'app.document_templates'::regclass and polname = 'document_templates_manage_member'),
  'template manage policy exists'
);
select ok(
  exists(select 1 from pg_policy where polrelid = 'app.approval_tasks'::regclass and polname = 'approval_tasks_select_member'),
  'approval task select policy exists'
);

select ok(
  exists(select 1 from pg_indexes where schemaname = 'app' and indexname = 'idx_app_legal_work_profiles_workspace'),
  'legal work profiles workspace index exists'
);
select ok(
  exists(select 1 from pg_indexes where schemaname = 'app' and indexname = 'idx_app_document_templates_workspace'),
  'document templates workspace index exists'
);
select ok(
  exists(select 1 from pg_indexes where schemaname = 'app' and indexname = 'idx_app_approval_tasks_workspace'),
  'approval tasks workspace index exists'
);

select results_eq(
  $$ select count(*)::int from app.permissions where code in (
    'profile.publish',
    'profile.override_personal',
    'document.template.read',
    'document.template.publish',
    'document.template.map_fields',
    'document.validation.read',
    'document.validation.resolve',
    'approval.route.manage',
    'approval.task.read',
    'approval.task.decide'
  ) $$,
  $$ values (10) $$,
  'stage 7 permissions are seeded'
);

select ok(
  exists(select 1 from app.role_permissions where role_code = 'owner' and permission_code = 'approval.route.manage'),
  'owner receives approval.route.manage'
);
select ok(
  exists(select 1 from app.role_permissions where role_code = 'lawyer' and permission_code = 'approval.task.decide'),
  'lawyer receives approval.task.decide'
);
select ok(
  exists(select 1 from app.role_permissions where role_code = 'assistant' and permission_code = 'approval.task.read'),
  'assistant receives approval.task.read'
);

select col_type_is('app', 'workflow_runs', 'effective_profile_snapshot_id', 'uuid', 'workflow runs stores effective profile snapshot id');
select col_type_is('app', 'workflow_runs', 'document_template_version_id', 'uuid', 'workflow runs stores document template version id');
select col_type_is('app', 'workflow_runs', 'approval_route_id', 'uuid', 'workflow runs stores approval route id');

select col_is_pk('app', 'legal_work_profiles', 'id', 'legal_work_profiles has primary key');
select col_is_pk('app', 'document_templates', 'id', 'document_templates has primary key');
select col_is_pk('app', 'document_generation_jobs', 'id', 'document_generation_jobs has primary key');
select col_is_pk('app', 'approval_routes', 'id', 'approval_routes has primary key');
select col_is_pk('app', 'approval_tasks', 'id', 'approval_tasks has primary key');

select ok(
  has_table_privilege('authenticated', 'app.legal_work_profiles', 'SELECT'),
  'authenticated can read legal work profiles'
);
select ok(
  has_table_privilege('authenticated', 'app.document_generation_jobs', 'INSERT'),
  'authenticated can insert generation jobs'
);
select ok(
  has_table_privilege('authenticated', 'app.approval_tasks', 'UPDATE'),
  'authenticated can update approval tasks'
);

select * from finish();

rollback;
