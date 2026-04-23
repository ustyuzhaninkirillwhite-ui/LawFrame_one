begin;

select plan(24);

select has_table('app', 'legal_modules', 'app.legal_modules exists');
select has_table('app', 'legal_module_versions', 'app.legal_module_versions exists');
select has_table('app', 'automation_templates', 'app.automation_templates exists');
select has_table('app', 'automation_template_versions', 'app.automation_template_versions exists');
select has_table('app', 'installed_automations', 'app.installed_automations exists');
select has_table('app', 'publication_requests', 'app.publication_requests exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'app.automation_templates'::regclass),
  'app.automation_templates RLS is enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'app.installed_automations'::regclass),
  'app.installed_automations RLS is enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'app.publication_requests'::regclass),
  'app.publication_requests RLS is enabled'
);

select ok(
  exists(select 1 from pg_policy where polrelid = 'app.automation_templates'::regclass and polname = 'automation_templates_select_visible'),
  'template select policy exists'
);
select ok(
  exists(select 1 from pg_policy where polrelid = 'app.automation_template_versions'::regclass and polname = 'automation_template_versions_insert_editor'),
  'template version insert policy exists'
);
select ok(
  exists(select 1 from pg_policy where polrelid = 'app.installed_automations'::regclass and polname = 'installed_automations_insert_installer'),
  'installed automation insert policy exists'
);
select ok(
  exists(select 1 from pg_policy where polrelid = 'app.publication_requests'::regclass and polname = 'publication_requests_update_moderator'),
  'publication moderation policy exists'
);

select ok(
  has_table_privilege('authenticated', 'app.automation_templates', 'SELECT'),
  'authenticated can read automation templates'
);
select ok(
  has_table_privilege('authenticated', 'app.installed_automations', 'INSERT'),
  'authenticated can insert installed automations'
);
select ok(
  has_table_privilege('authenticated', 'app.publication_requests', 'UPDATE'),
  'authenticated can update publication requests'
);

select ok(
  exists(select 1 from pg_indexes where schemaname = 'app' and indexname = 'idx_app_automation_templates_search'),
  'template search index exists'
);
select ok(
  exists(select 1 from pg_indexes where schemaname = 'app' and indexname = 'idx_app_automation_templates_title_trgm'),
  'template trigram title index exists'
);
select ok(
  exists(select 1 from pg_indexes where schemaname = 'app' and indexname = 'idx_app_installed_automations_workspace'),
  'installed automation workspace index exists'
);

select results_eq(
  $$ select count(*)::int from app.permissions where code in (
    'module.manage',
    'automation.fork',
    'automation.update_source',
    'automation.submit_publication',
    'moderation.review'
  ) $$,
  $$ values (5) $$,
  'stage 3 permissions are seeded'
);

select ok(
  exists(select 1 from app.automation_templates where code = 'claim.pretrial-package'),
  'product template seed exists'
);
select ok(
  exists(select 1 from app.automation_templates where code = 'public.contract-review'),
  'public template seed exists'
);
select ok(
  exists(select 1 from app.legal_modules where code = 'legal.case-search'),
  'legal module seed exists'
);

select col_is_pk('app', 'legal_modules', 'id', 'legal_modules has primary key');
select col_is_pk('app', 'automation_templates', 'id', 'automation_templates has primary key');
select col_is_pk('app', 'installed_automations', 'id', 'installed_automations has primary key');

select * from finish();

rollback;
