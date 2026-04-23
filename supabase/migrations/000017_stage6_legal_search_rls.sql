alter table app.legal_source_providers enable row level security;
alter table app.legal_sources enable row level security;
alter table app.legal_document_versions enable row level security;
alter table app.legal_source_access enable row level security;
alter table app.legal_import_jobs enable row level security;
alter table app.legal_extraction_jobs enable row level security;
alter table app.legal_document_texts enable row level security;
alter table app.legal_chunks enable row level security;
alter table app.rag_requests enable row level security;
alter table app.rag_context_items enable row level security;
alter table app.rag_outputs enable row level security;
alter table app.search_feedback enable row level security;

drop policy if exists legal_source_providers_select_authenticated on app.legal_source_providers;
create policy legal_source_providers_select_authenticated
  on app.legal_source_providers
  for select
  to authenticated
  using (true);

drop policy if exists legal_sources_select_reader on app.legal_sources;
create policy legal_sources_select_reader
  on app.legal_sources
  for select
  to authenticated
  using (
    visibility = 'public'
    or (
      workspace_id is not null
      and (
        public.has_workspace_permission(workspace_id, 'document.read')
        or public.has_workspace_permission(workspace_id, 'legal_search.use')
      )
    )
  );

drop policy if exists legal_sources_manage_workspace on app.legal_sources;
create policy legal_sources_manage_workspace
  on app.legal_sources
  for all
  to authenticated
  using (
    workspace_id is not null
    and public.has_workspace_permission(workspace_id, 'legal_sources.manage')
  )
  with check (
    workspace_id is not null
    and public.has_workspace_permission(workspace_id, 'legal_sources.manage')
  );

drop policy if exists legal_document_versions_select_reader on app.legal_document_versions;
create policy legal_document_versions_select_reader
  on app.legal_document_versions
  for select
  to authenticated
  using (
    workspace_id is null
    or public.has_workspace_permission(workspace_id, 'document.read')
    or public.has_workspace_permission(workspace_id, 'legal_search.use')
  );

drop policy if exists legal_document_versions_manage_workspace on app.legal_document_versions;
create policy legal_document_versions_manage_workspace
  on app.legal_document_versions
  for all
  to authenticated
  using (
    workspace_id is not null
    and public.has_workspace_permission(workspace_id, 'legal_sources.manage')
  )
  with check (
    workspace_id is not null
    and public.has_workspace_permission(workspace_id, 'legal_sources.manage')
  );

drop policy if exists legal_source_access_select_reader on app.legal_source_access;
create policy legal_source_access_select_reader
  on app.legal_source_access
  for select
  to authenticated
  using (
    workspace_id is null
    or public.has_workspace_permission(workspace_id, 'document.read')
    or public.has_workspace_permission(workspace_id, 'legal_search.use')
  );

drop policy if exists legal_source_access_manage_workspace on app.legal_source_access;
create policy legal_source_access_manage_workspace
  on app.legal_source_access
  for all
  to authenticated
  using (
    workspace_id is not null
    and public.has_workspace_permission(workspace_id, 'legal_sources.manage')
  )
  with check (
    workspace_id is not null
    and public.has_workspace_permission(workspace_id, 'legal_sources.manage')
  );

drop policy if exists legal_import_jobs_select_reader on app.legal_import_jobs;
create policy legal_import_jobs_select_reader
  on app.legal_import_jobs
  for select
  to authenticated
  using (
    workspace_id is null
    or public.has_workspace_permission(workspace_id, 'document.read')
    or public.has_workspace_permission(workspace_id, 'legal_search.use')
  );

drop policy if exists legal_import_jobs_manage_workspace on app.legal_import_jobs;
create policy legal_import_jobs_manage_workspace
  on app.legal_import_jobs
  for all
  to authenticated
  using (
    workspace_id is not null
    and public.has_workspace_permission(workspace_id, 'legal_sources.manage')
  )
  with check (
    workspace_id is not null
    and public.has_workspace_permission(workspace_id, 'legal_sources.manage')
  );

drop policy if exists legal_extraction_jobs_select_reader on app.legal_extraction_jobs;
create policy legal_extraction_jobs_select_reader
  on app.legal_extraction_jobs
  for select
  to authenticated
  using (
    workspace_id is null
    or public.has_workspace_permission(workspace_id, 'document.read')
    or public.has_workspace_permission(workspace_id, 'legal_search.use')
  );

drop policy if exists legal_extraction_jobs_manage_workspace on app.legal_extraction_jobs;
create policy legal_extraction_jobs_manage_workspace
  on app.legal_extraction_jobs
  for all
  to authenticated
  using (
    workspace_id is not null
    and public.has_workspace_permission(workspace_id, 'legal_sources.manage')
  )
  with check (
    workspace_id is not null
    and public.has_workspace_permission(workspace_id, 'legal_sources.manage')
  );

drop policy if exists legal_document_texts_select_reader on app.legal_document_texts;
create policy legal_document_texts_select_reader
  on app.legal_document_texts
  for select
  to authenticated
  using (
    workspace_id is null
    or public.has_workspace_permission(workspace_id, 'document.read')
    or public.has_workspace_permission(workspace_id, 'legal_search.use')
  );

drop policy if exists legal_document_texts_manage_workspace on app.legal_document_texts;
create policy legal_document_texts_manage_workspace
  on app.legal_document_texts
  for all
  to authenticated
  using (
    workspace_id is not null
    and public.has_workspace_permission(workspace_id, 'legal_sources.manage')
  )
  with check (
    workspace_id is not null
    and public.has_workspace_permission(workspace_id, 'legal_sources.manage')
  );

drop policy if exists legal_chunks_select_reader on app.legal_chunks;
create policy legal_chunks_select_reader
  on app.legal_chunks
  for select
  to authenticated
  using (
    workspace_id is null
    or public.has_workspace_permission(workspace_id, 'document.read')
    or public.has_workspace_permission(workspace_id, 'legal_search.use')
  );

drop policy if exists legal_chunks_manage_workspace on app.legal_chunks;
create policy legal_chunks_manage_workspace
  on app.legal_chunks
  for all
  to authenticated
  using (
    workspace_id is not null
    and public.has_workspace_permission(workspace_id, 'legal_sources.manage')
  )
  with check (
    workspace_id is not null
    and public.has_workspace_permission(workspace_id, 'legal_sources.manage')
  );

drop policy if exists rag_requests_select_workspace on app.rag_requests;
create policy rag_requests_select_workspace
  on app.rag_requests
  for select
  to authenticated
  using (
    public.has_workspace_permission(workspace_id, 'legal_rag.use')
    or public.has_workspace_permission(workspace_id, 'audit.read')
  );

drop policy if exists rag_requests_manage_workspace on app.rag_requests;
create policy rag_requests_manage_workspace
  on app.rag_requests
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'legal_rag.use'))
  with check (public.has_workspace_permission(workspace_id, 'legal_rag.use'));

drop policy if exists rag_context_items_select_workspace on app.rag_context_items;
create policy rag_context_items_select_workspace
  on app.rag_context_items
  for select
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'legal_rag.use'));

drop policy if exists rag_context_items_manage_workspace on app.rag_context_items;
create policy rag_context_items_manage_workspace
  on app.rag_context_items
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'legal_rag.use'))
  with check (public.has_workspace_permission(workspace_id, 'legal_rag.use'));

drop policy if exists rag_outputs_select_workspace on app.rag_outputs;
create policy rag_outputs_select_workspace
  on app.rag_outputs
  for select
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'legal_rag.use'));

drop policy if exists rag_outputs_manage_workspace on app.rag_outputs;
create policy rag_outputs_manage_workspace
  on app.rag_outputs
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'legal_rag.use'))
  with check (public.has_workspace_permission(workspace_id, 'legal_rag.use'));

drop policy if exists search_feedback_select_workspace on app.search_feedback;
create policy search_feedback_select_workspace
  on app.search_feedback
  for select
  to authenticated
  using (
    public.has_workspace_permission(workspace_id, 'legal_search.use')
    or public.has_workspace_permission(workspace_id, 'audit.read')
  );

drop policy if exists search_feedback_manage_workspace on app.search_feedback;
create policy search_feedback_manage_workspace
  on app.search_feedback
  for all
  to authenticated
  using (public.has_workspace_permission(workspace_id, 'legal_search.use'))
  with check (public.has_workspace_permission(workspace_id, 'legal_search.use'));

grant select on app.legal_source_providers to authenticated;
grant select, insert, update on app.legal_sources to authenticated;
grant select, insert, update on app.legal_document_versions to authenticated;
grant select, insert, update on app.legal_source_access to authenticated;
grant select, insert, update on app.legal_import_jobs to authenticated;
grant select, insert, update on app.legal_extraction_jobs to authenticated;
grant select, insert, update on app.legal_document_texts to authenticated;
grant select, insert, update on app.legal_chunks to authenticated;
grant select, insert, update on app.rag_requests to authenticated;
grant select, insert, update on app.rag_context_items to authenticated;
grant select, insert, update on app.rag_outputs to authenticated;
grant select, insert on app.search_feedback to authenticated;
