insert into storage.buckets (id, name, public)
values
  ('documents-private', 'documents-private', false),
  ('previews-private', 'previews-private', false),
  ('document-previews-private', 'document-previews-private', false),
  ('artifacts-private', 'artifacts-private', false),
  ('quarantine-private', 'quarantine-private', false),
  ('templates-private', 'templates-private', false),
  ('templates-public', 'templates-public', true),
  ('exports-private', 'exports-private', false)
on conflict (id) do update
set public = excluded.public;

alter table app.documents enable row level security;
alter table app.document_versions enable row level security;
alter table app.document_storage_objects enable row level security;
alter table app.document_relations enable row level security;
alter table app.run_artifacts enable row level security;
alter table app.document_processing_jobs enable row level security;
alter table app.document_text_chunks enable row level security;

drop policy if exists documents_select_reader on app.documents;
create policy documents_select_reader
  on app.documents
  for select
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'document.read'));

drop policy if exists documents_insert_uploader on app.documents;
create policy documents_insert_uploader
  on app.documents
  for insert
  to authenticated
  with check (public.has_workspace_permission(workspace_id, 'document.upload'));

drop policy if exists documents_update_manager on app.documents;
create policy documents_update_manager
  on app.documents
  for update
  to authenticated
  using (
    public.has_workspace_permission(workspace_id, 'document.upload')
    or public.has_workspace_permission(workspace_id, 'document.delete')
    or public.has_workspace_permission(workspace_id, 'document.restore')
    or public.has_workspace_permission(workspace_id, 'document.template.manage')
  )
  with check (
    public.has_workspace_permission(workspace_id, 'document.upload')
    or public.has_workspace_permission(workspace_id, 'document.delete')
    or public.has_workspace_permission(workspace_id, 'document.restore')
    or public.has_workspace_permission(workspace_id, 'document.template.manage')
  );

drop policy if exists document_versions_select_reader on app.document_versions;
create policy document_versions_select_reader
  on app.document_versions
  for select
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'document.read'));

drop policy if exists document_versions_insert_uploader on app.document_versions;
create policy document_versions_insert_uploader
  on app.document_versions
  for insert
  to authenticated
  with check (public.has_workspace_permission(workspace_id, 'document.upload'));

drop policy if exists document_versions_update_uploader on app.document_versions;
create policy document_versions_update_uploader
  on app.document_versions
  for update
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'document.upload'))
  with check (public.has_workspace_permission(workspace_id, 'document.upload'));

drop policy if exists document_storage_objects_select_reader on app.document_storage_objects;
create policy document_storage_objects_select_reader
  on app.document_storage_objects
  for select
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'document.read'));

drop policy if exists document_storage_objects_insert_uploader on app.document_storage_objects;
create policy document_storage_objects_insert_uploader
  on app.document_storage_objects
  for insert
  to authenticated
  with check (public.has_workspace_permission(workspace_id, 'document.upload'));

drop policy if exists document_storage_objects_update_uploader on app.document_storage_objects;
create policy document_storage_objects_update_uploader
  on app.document_storage_objects
  for update
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'document.upload'))
  with check (public.has_workspace_permission(workspace_id, 'document.upload'));

drop policy if exists document_relations_select_reader on app.document_relations;
create policy document_relations_select_reader
  on app.document_relations
  for select
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'document.read'));

drop policy if exists document_relations_insert_uploader on app.document_relations;
create policy document_relations_insert_uploader
  on app.document_relations
  for insert
  to authenticated
  with check (public.has_workspace_permission(workspace_id, 'document.upload'));

drop policy if exists run_artifacts_select_reader on app.run_artifacts;
create policy run_artifacts_select_reader
  on app.run_artifacts
  for select
  to authenticated
  using (
    public.has_workspace_permission(workspace_id, 'automation.read')
    or public.has_workspace_permission(workspace_id, 'document.read')
  );

drop policy if exists run_artifacts_insert_runner on app.run_artifacts;
create policy run_artifacts_insert_runner
  on app.run_artifacts
  for insert
  to authenticated
  with check (
    public.has_workspace_permission(workspace_id, 'automation.run')
    and public.has_workspace_permission(workspace_id, 'document.upload')
  );

drop policy if exists document_processing_jobs_select_reader on app.document_processing_jobs;
create policy document_processing_jobs_select_reader
  on app.document_processing_jobs
  for select
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'document.read'));

drop policy if exists document_processing_jobs_insert_uploader on app.document_processing_jobs;
create policy document_processing_jobs_insert_uploader
  on app.document_processing_jobs
  for insert
  to authenticated
  with check (public.has_workspace_permission(workspace_id, 'document.upload'));

drop policy if exists document_processing_jobs_update_uploader on app.document_processing_jobs;
create policy document_processing_jobs_update_uploader
  on app.document_processing_jobs
  for update
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'document.upload'))
  with check (public.has_workspace_permission(workspace_id, 'document.upload'));

drop policy if exists document_text_chunks_select_reader on app.document_text_chunks;
create policy document_text_chunks_select_reader
  on app.document_text_chunks
  for select
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'document.read'));

drop policy if exists document_text_chunks_insert_uploader on app.document_text_chunks;
create policy document_text_chunks_insert_uploader
  on app.document_text_chunks
  for insert
  to authenticated
  with check (public.has_workspace_permission(workspace_id, 'document.upload'));

grant select, insert, update, delete on app.documents to authenticated;
grant select, insert, update on app.document_versions to authenticated;
grant select, insert, update on app.document_storage_objects to authenticated;
grant select, insert on app.document_relations to authenticated;
grant select, insert on app.run_artifacts to authenticated;
grant select, insert, update on app.document_processing_jobs to authenticated;
grant select, insert on app.document_text_chunks to authenticated;

grant select, insert on storage.objects to authenticated;

drop policy if exists stage2_documents_upload on storage.objects;
create policy stage2_documents_upload
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id in (
      'documents-private',
      'previews-private',
      'document-previews-private',
      'artifacts-private',
      'quarantine-private',
      'templates-private',
      'templates-public',
      'exports-private'
    )
    and exists (
      select 1
      from app.document_versions dv
      join app.documents d
        on d.id = dv.document_id
      where dv.storage_bucket = bucket_id
        and dv.storage_path = name
        and d.deleted_at is null
        and public.has_workspace_permission(d.workspace_id, 'document.upload')
    )
  );

drop policy if exists stage2_documents_read on storage.objects;
create policy stage2_documents_read
  on storage.objects
  for select
  to authenticated
  using (
    exists (
      select 1
      from app.document_versions dv
      join app.documents d
        on d.id = dv.document_id
      where dv.storage_bucket = bucket_id
        and dv.storage_path = name
        and d.deleted_at is null
        and dv.scan_status <> 'infected'
        and public.has_workspace_permission(d.workspace_id, 'document.read')
    )
    or exists (
      select 1
      from app.document_storage_objects dso
      join app.document_versions dv
        on dv.id = dso.document_version_id
      join app.documents d
        on d.id = dso.document_id
      where dso.bucket = bucket_id
        and dso.object_path = name
        and d.deleted_at is null
        and dv.scan_status <> 'infected'
        and public.has_workspace_permission(d.workspace_id, 'document.read')
    )
  );
