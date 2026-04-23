begin;

select plan(24);

select has_table('app', 'legal_source_providers', 'legal source providers table exists');
select has_table('app', 'legal_sources', 'legal sources table exists');
select has_table('app', 'legal_document_versions', 'legal document versions table exists');
select has_table('app', 'legal_chunks', 'legal chunks table exists');
select has_table('app', 'rag_requests', 'rag requests table exists');
select has_table('app', 'rag_outputs', 'rag outputs table exists');
select has_table('app', 'search_feedback', 'search feedback table exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'app.legal_sources'::regclass),
  'legal_sources RLS is enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'app.legal_chunks'::regclass),
  'legal_chunks RLS is enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'app.rag_requests'::regclass),
  'rag_requests RLS is enabled'
);

select ok(
  exists(select 1 from pg_policy where polrelid = 'app.legal_sources'::regclass and polname = 'legal_sources_select_reader'),
  'legal sources select policy exists'
);
select ok(
  exists(select 1 from pg_policy where polrelid = 'app.legal_chunks'::regclass and polname = 'legal_chunks_manage_workspace'),
  'legal chunks manage policy exists'
);
select ok(
  exists(select 1 from pg_policy where polrelid = 'app.rag_requests'::regclass and polname = 'rag_requests_manage_workspace'),
  'rag requests manage policy exists'
);
select ok(
  exists(select 1 from pg_policy where polrelid = 'app.search_feedback'::regclass and polname = 'search_feedback_manage_workspace'),
  'search feedback manage policy exists'
);

select ok(
  has_table_privilege('authenticated', 'app.legal_sources', 'SELECT'),
  'authenticated can read legal sources'
);
select ok(
  has_table_privilege('authenticated', 'app.legal_sources', 'INSERT'),
  'authenticated can insert legal sources'
);
select ok(
  has_table_privilege('authenticated', 'app.rag_requests', 'INSERT'),
  'authenticated can insert rag requests'
);

select results_eq(
  $$ select count(*)::int from app.permissions where code in (
    'legal_sources.manage',
    'legal_search.use',
    'legal_rag.use'
  ) $$,
  $$ values (3) $$,
  'stage 6 permissions are seeded'
);

select ok(
  exists(select 1 from app.role_permissions where permission_code = 'legal_sources.manage' and role_code = 'owner'),
  'owner receives legal_sources.manage'
);
select ok(
  exists(select 1 from app.role_permissions where permission_code = 'legal_search.use' and role_code = 'assistant'),
  'assistant receives legal_search.use'
);
select ok(
  exists(select 1 from app.role_permissions where permission_code = 'legal_rag.use' and role_code = 'lawyer'),
  'lawyer receives legal_rag.use'
);

select ok(
  exists(select 1 from pg_indexes where schemaname = 'app' and indexname = 'idx_app_legal_sources_workspace_status'),
  'legal sources workspace index exists'
);
select ok(
  exists(select 1 from pg_indexes where schemaname = 'app' and indexname = 'idx_app_legal_chunks_source'),
  'legal chunks source index exists'
);
select ok(
  exists(select 1 from pg_indexes where schemaname = 'app' and indexname = 'idx_app_rag_requests_workspace'),
  'rag requests workspace index exists'
);

select col_is_pk('app', 'legal_sources', 'id', 'legal_sources has primary key');
select col_is_pk('app', 'legal_document_versions', 'id', 'legal_document_versions has primary key');
select col_is_pk('app', 'rag_requests', 'id', 'rag_requests has primary key');
select col_type_is('app', 'rag_requests', 'ai_route', 'text', 'rag requests stores ai route');

select * from finish();

rollback;
