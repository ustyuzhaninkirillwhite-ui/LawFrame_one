begin;

select plan(28);

select has_type('public', 'document_kind', 'document_kind enum exists');
select has_type('public', 'document_status', 'document_status enum exists');
select has_type('public', 'document_source', 'document_source enum exists');
select has_type('public', 'document_object_role', 'document_object_role enum exists');
select has_type('public', 'document_job_type', 'document_job_type enum exists');
select has_type('public', 'document_job_status', 'document_job_status enum exists');

select has_table('app', 'documents', 'app.documents exists');
select has_table('app', 'document_versions', 'app.document_versions exists');
select has_table('app', 'document_storage_objects', 'app.document_storage_objects exists');
select has_table('app', 'document_relations', 'app.document_relations exists');
select has_table('app', 'run_artifacts', 'app.run_artifacts exists');
select has_table('app', 'document_processing_jobs', 'app.document_processing_jobs exists');
select has_table('app', 'document_text_chunks', 'app.document_text_chunks exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'app.documents'::regclass),
  'app.documents RLS is enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'app.document_versions'::regclass),
  'app.document_versions RLS is enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'app.document_storage_objects'::regclass),
  'app.document_storage_objects RLS is enabled'
);

select ok(
  exists(select 1 from pg_policy where polrelid = 'app.documents'::regclass and polname = 'documents_select_reader'),
  'documents select policy exists'
);
select ok(
  exists(select 1 from pg_policy where polrelid = 'app.document_versions'::regclass and polname = 'document_versions_insert_uploader'),
  'document versions insert policy exists'
);
select ok(
  exists(select 1 from pg_policy where polrelid = 'app.document_storage_objects'::regclass and polname = 'document_storage_objects_select_reader'),
  'document storage objects select policy exists'
);
select ok(
  exists(select 1 from pg_policy where polrelid = 'app.run_artifacts'::regclass and polname = 'run_artifacts_select_reader'),
  'run artifacts select policy exists'
);
select ok(
  exists(select 1 from pg_policy where polrelid = 'app.document_processing_jobs'::regclass and polname = 'document_processing_jobs_update_uploader'),
  'document processing jobs update policy exists'
);
select ok(
  exists(select 1 from pg_policy where polrelid = 'storage.objects'::regclass and polname = 'stage2_documents_upload'),
  'storage upload policy exists'
);
select ok(
  exists(select 1 from pg_policy where polrelid = 'storage.objects'::regclass and polname = 'stage2_documents_read'),
  'storage read policy exists'
);

select ok(
  has_table_privilege('authenticated', 'app.documents', 'SELECT'),
  'authenticated can read app.documents'
);
select ok(
  has_table_privilege('authenticated', 'app.documents', 'INSERT'),
  'authenticated can insert app.documents'
);
select ok(
  has_table_privilege('authenticated', 'storage.objects', 'INSERT'),
  'authenticated can insert storage.objects'
);
select ok(
  has_table_privilege('authenticated', 'storage.objects', 'SELECT'),
  'authenticated can read storage.objects'
);

select ok(
  exists(select 1 from storage.buckets where id = 'documents-private' and public = false),
  'documents-private bucket exists and stays private'
);
select ok(
  exists(select 1 from storage.buckets where id = 'previews-private' and public = false),
  'previews-private bucket exists and stays private'
);
select ok(
  exists(select 1 from pg_indexes where schemaname = 'app' and indexname = 'idx_app_document_versions_document'),
  'document version lookup index exists'
);

select * from finish();

rollback;
