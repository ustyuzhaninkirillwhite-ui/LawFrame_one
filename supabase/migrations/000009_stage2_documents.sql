do $$
begin
  if not exists (select 1 from pg_type where typname = 'document_kind') then
    create type public.document_kind as enum (
      'case_material',
      'evidence',
      'legal_source',
      'document_template',
      'generated_document',
      'draft_document',
      'delivery_attachment',
      'profile_clause',
      'other'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'document_status') then
    create type public.document_status as enum (
      'upload_pending',
      'uploaded',
      'processing',
      'ready',
      'failed',
      'archived',
      'soft_deleted',
      'hard_delete_pending'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'document_source') then
    create type public.document_source as enum (
      'user_upload',
      'automation_result',
      'activepieces_artifact',
      'ai_generated',
      'template_library',
      'profile_library',
      'system_import'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'document_object_role') then
    create type public.document_object_role as enum (
      'original',
      'preview_pdf',
      'thumbnail',
      'extracted_text',
      'redacted_copy'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'document_job_type') then
    create type public.document_job_type as enum (
      'virus_scan',
      'metadata_extract',
      'text_extract',
      'preview_generate',
      'thumbnail_generate',
      'index_prepare'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'document_job_status') then
    create type public.document_job_status as enum (
      'queued',
      'running',
      'completed',
      'failed',
      'skipped'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'document_scan_status') then
    create type public.document_scan_status as enum (
      'not_started',
      'queued',
      'clean',
      'infected',
      'manual_review_required',
      'not_configured'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'document_preview_status') then
    create type public.document_preview_status as enum (
      'not_started',
      'queued',
      'ready',
      'failed'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'document_extraction_status') then
    create type public.document_extraction_status as enum (
      'not_started',
      'queued',
      'ready',
      'failed',
      'requires_ocr'
    );
  end if;
end
$$;

create table if not exists app.documents (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  owner_id uuid not null references app.profiles(id) on delete restrict,
  title text not null,
  description text null,
  kind public.document_kind not null,
  status public.document_status not null default 'upload_pending',
  classification data_classification not null,
  source public.document_source not null,
  current_version_id uuid null,
  tags text[] not null default '{}'::text[],
  created_by_user_id uuid not null references app.profiles(id) on delete restrict,
  updated_by_user_id uuid not null references app.profiles(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz null,
  deleted_at timestamptz null
);

create table if not exists app.document_versions (
  id uuid primary key default public.app_uuid_v7(),
  document_id uuid not null references app.documents(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  version_no integer not null check (version_no > 0),
  status public.document_status not null default 'upload_pending',
  original_filename text not null,
  normalized_filename text not null,
  mime_type text not null,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  sha256 text null,
  storage_bucket text not null check (
    storage_bucket in (
      'documents-private',
      'previews-private',
      'document-previews-private',
      'artifacts-private',
      'quarantine-private',
      'templates-private',
      'templates-public',
      'exports-private'
    )
  ),
  storage_path text not null,
  scan_status public.document_scan_status not null default 'not_started',
  preview_status public.document_preview_status not null default 'not_started',
  extraction_status public.document_extraction_status not null default 'not_started',
  created_by_user_id uuid not null references app.profiles(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz null,
  deleted_at timestamptz null,
  unique (document_id, version_no),
  unique (storage_bucket, storage_path)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'app_documents_current_version_fk'
  ) then
    alter table app.documents
      add constraint app_documents_current_version_fk
      foreign key (current_version_id)
      references app.document_versions(id)
      on delete set null;
  end if;
end
$$;

create table if not exists app.document_storage_objects (
  id uuid primary key default public.app_uuid_v7(),
  document_id uuid not null references app.documents(id) on delete cascade,
  document_version_id uuid not null references app.document_versions(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  bucket text not null check (
    bucket in (
      'documents-private',
      'previews-private',
      'document-previews-private',
      'artifacts-private',
      'quarantine-private',
      'templates-private',
      'templates-public',
      'exports-private'
    )
  ),
  object_path text not null,
  object_role public.document_object_role not null,
  mime_type text not null,
  size_bytes bigint null check (size_bytes is null or size_bytes >= 0),
  status text not null check (
    status in ('private_bucket', 'signed_url_only', 'quarantined', 'draft')
  ),
  created_at timestamptz not null default timezone('utc', now()),
  unique (bucket, object_path)
);

create table if not exists app.document_relations (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  source_document_id uuid not null references app.documents(id) on delete cascade,
  relation_type text not null,
  target_entity_type text not null,
  target_entity_id text not null,
  created_by_user_id uuid not null references app.profiles(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.run_artifacts (
  id uuid primary key default public.app_uuid_v7(),
  workflow_run_id text not null,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  document_id uuid not null references app.documents(id) on delete cascade,
  document_version_id uuid not null references app.document_versions(id) on delete cascade,
  artifact_type text not null,
  title text not null,
  mime_type text not null,
  source public.document_source not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.document_processing_jobs (
  id uuid primary key default public.app_uuid_v7(),
  document_id uuid not null references app.documents(id) on delete cascade,
  document_version_id uuid not null references app.document_versions(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  job_type public.document_job_type not null,
  status public.document_job_status not null default 'queued',
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts > 0),
  last_error text null,
  idempotency_key text not null unique,
  available_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.document_text_chunks (
  id uuid primary key default public.app_uuid_v7(),
  document_id uuid not null references app.documents(id) on delete cascade,
  document_version_id uuid not null references app.document_versions(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null,
  token_count integer not null default 0 check (token_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (document_version_id, chunk_index)
);

create index if not exists idx_app_documents_workspace_status
  on app.documents (workspace_id, status, updated_at desc)
  where deleted_at is null;

create index if not exists idx_app_documents_workspace_kind
  on app.documents (workspace_id, kind, updated_at desc)
  where deleted_at is null;

create index if not exists idx_app_documents_tags_gin
  on app.documents using gin (tags);

create index if not exists idx_app_document_versions_document
  on app.document_versions (document_id, version_no desc)
  where deleted_at is null;

create index if not exists idx_app_document_versions_workspace_status
  on app.document_versions (workspace_id, status, created_at desc)
  where deleted_at is null;

create index if not exists idx_app_document_storage_objects_document
  on app.document_storage_objects (document_id, document_version_id, object_role);

create index if not exists idx_app_document_relations_target
  on app.document_relations (target_entity_type, target_entity_id);

create index if not exists idx_app_run_artifacts_run
  on app.run_artifacts (workflow_run_id, created_at desc);

create index if not exists idx_app_document_processing_jobs_lookup
  on app.document_processing_jobs (document_version_id, status, available_at);

create index if not exists idx_app_document_text_chunks_document
  on app.document_text_chunks (document_id, document_version_id);
