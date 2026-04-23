insert into app.permissions (code, label, description, scope, high_risk)
values
  (
    'legal_sources.manage',
    'Manage legal sources',
    'Create, retry, archive and manage legal sources and ingestion jobs.',
    'document',
    true
  ),
  (
    'legal_search.use',
    'Use legal search',
    'Run scoped legal search queries and open legal source results.',
    'module',
    false
  ),
  (
    'legal_rag.use',
    'Use legal RAG',
    'Run legal analysis with mandatory citations through the AI gateway.',
    'ai',
    true
  )
on conflict (code) do update
set
  label = excluded.label,
  description = excluded.description,
  scope = excluded.scope,
  high_risk = excluded.high_risk;

insert into app.role_permissions (role_code, permission_code)
select role_code, permission_code
from (
  values
    ('owner'::workspace_role, 'legal_sources.manage'),
    ('owner'::workspace_role, 'legal_search.use'),
    ('owner'::workspace_role, 'legal_rag.use'),
    ('admin'::workspace_role, 'legal_sources.manage'),
    ('admin'::workspace_role, 'legal_search.use'),
    ('admin'::workspace_role, 'legal_rag.use'),
    ('lawyer'::workspace_role, 'legal_sources.manage'),
    ('lawyer'::workspace_role, 'legal_search.use'),
    ('lawyer'::workspace_role, 'legal_rag.use'),
    ('assistant'::workspace_role, 'legal_search.use'),
    ('assistant'::workspace_role, 'legal_rag.use')
) as grants(role_code, permission_code)
where exists (select 1 from app.roles r where r.code = grants.role_code)
on conflict do nothing;

create table if not exists app.legal_source_providers (
  id uuid primary key default public.app_uuid_v7(),
  code text not null unique,
  name text not null,
  provider_type text not null check (
    provider_type in (
      'user_upload',
      'workspace_private',
      'product_curated',
      'official_feed',
      'external_paid',
      'manual_import'
    )
  ),
  jurisdiction text null,
  access_mode text not null check (
    access_mode in ('file_upload', 'api_import', 'seeded', 'manual')
  ),
  license_notes text null,
  terms_url text null,
  is_enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.legal_sources (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid null references app.workspaces(id) on delete cascade,
  document_id uuid null references app.documents(id) on delete set null,
  provider_id uuid not null references app.legal_source_providers(id) on delete restrict,
  source_type text not null check (
    source_type in (
      'court_decision',
      'statute',
      'regulation',
      'contract_template',
      'user_document',
      'internal_memo',
      'analysis_result'
    )
  ),
  jurisdiction text null,
  title text not null,
  canonical_url text null,
  external_id text null,
  license_status text not null default 'unknown' check (
    license_status in (
      'allowed',
      'restricted',
      'unknown',
      'requires_contract',
      'forbidden'
    )
  ),
  visibility text not null default 'workspace_private' check (
    visibility in (
      'public',
      'product_private',
      'workspace_private',
      'user_private',
      'restricted_provider'
    )
  ),
  classification data_classification not null,
  status text not null default 'draft' check (
    status in (
      'draft',
      'pending_processing',
      'processed',
      'indexed',
      'index_failed',
      'deprecated',
      'archived',
      'deleted'
    )
  ),
  duplicate_of_source_id uuid null references app.legal_sources(id) on delete set null,
  owner_workspace_id uuid null references app.workspaces(id) on delete set null,
  owner_user_id uuid null references app.profiles(id) on delete set null,
  created_by_user_id uuid null references app.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  last_used_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.legal_document_versions (
  id uuid primary key default public.app_uuid_v7(),
  source_id uuid not null references app.legal_sources(id) on delete cascade,
  workspace_id uuid null references app.workspaces(id) on delete cascade,
  document_version_id uuid null references app.document_versions(id) on delete set null,
  version_no integer not null check (version_no > 0),
  text_hash text null,
  metadata_hash text null,
  embedding_hash text null,
  storage_bucket text null,
  storage_path text null,
  mime_type text null,
  file_size bigint null check (file_size is null or file_size >= 0),
  language text null,
  effective_date date null,
  published_at timestamptz null,
  ingested_at timestamptz null,
  status text not null default 'draft' check (
    status in (
      'draft',
      'pending_processing',
      'processed',
      'indexed',
      'index_failed',
      'deprecated',
      'archived',
      'deleted'
    )
  ),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (source_id, version_no)
);

create table if not exists app.legal_source_access (
  id uuid primary key default public.app_uuid_v7(),
  source_id uuid not null references app.legal_sources(id) on delete cascade,
  workspace_id uuid null references app.workspaces(id) on delete cascade,
  user_id uuid null references app.profiles(id) on delete cascade,
  role_required text null,
  access_level text not null check (access_level in ('read', 'rag', 'manage')),
  expires_at timestamptz null,
  granted_by uuid null references app.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.legal_import_jobs (
  id uuid primary key default public.app_uuid_v7(),
  provider_id uuid not null references app.legal_source_providers(id) on delete restrict,
  workspace_id uuid null references app.workspaces(id) on delete cascade,
  source_id uuid null references app.legal_sources(id) on delete set null,
  document_id uuid null references app.documents(id) on delete set null,
  created_by_user_id uuid null references app.profiles(id) on delete set null,
  status text not null default 'queued' check (
    status in (
      'queued',
      'fetching',
      'stored',
      'extracting_text',
      'normalizing',
      'chunking',
      'embedding',
      'indexing',
      'completed',
      'failed',
      'partially_failed',
      'cancelled'
    )
  ),
  input_type text not null,
  input_ref text null,
  total_items integer not null default 0 check (total_items >= 0),
  processed_items integer not null default 0 check (processed_items >= 0),
  failed_items integer not null default 0 check (failed_items >= 0),
  error_summary text null,
  temporal_workflow_id text null,
  started_at timestamptz null,
  finished_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.legal_extraction_jobs (
  id uuid primary key default public.app_uuid_v7(),
  document_version_id uuid not null references app.legal_document_versions(id) on delete cascade,
  workspace_id uuid null references app.workspaces(id) on delete cascade,
  status text not null default 'queued' check (
    status in ('queued', 'running', 'completed', 'failed', 'requires_ocr')
  ),
  extractor text not null,
  attempt integer not null default 1 check (attempt > 0),
  error_code text null,
  error_message text null,
  text_hash text null,
  started_at timestamptz null,
  finished_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.legal_document_texts (
  document_version_id uuid primary key references app.legal_document_versions(id) on delete cascade,
  workspace_id uuid null references app.workspaces(id) on delete cascade,
  normalized_text text null,
  raw_text_ref text null,
  language text null,
  page_map jsonb not null default '[]'::jsonb,
  paragraph_map jsonb not null default '[]'::jsonb,
  text_hash text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.legal_chunks (
  id uuid primary key default public.app_uuid_v7(),
  source_id uuid not null references app.legal_sources(id) on delete cascade,
  document_version_id uuid not null references app.legal_document_versions(id) on delete cascade,
  workspace_id uuid null references app.workspaces(id) on delete cascade,
  chunk_no integer not null check (chunk_no >= 0),
  chunk_type text not null default 'unknown' check (
    chunk_type in (
      'facts',
      'claims',
      'court_reasoning',
      'holding',
      'procedural_history',
      'citations',
      'operative_part',
      'unknown'
    )
  ),
  text text not null,
  text_hash text not null,
  page_from integer null,
  page_to integer null,
  char_start integer null,
  char_end integer null,
  paragraph_ids jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  security_scope text not null default 'workspace_private' check (
    security_scope in (
      'public',
      'product_private',
      'workspace_private',
      'user_private',
      'restricted_provider'
    )
  ),
  embedding_model text null,
  embedding_hash text null,
  index_version text null,
  citation_label text null,
  indexed_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (document_version_id, chunk_no)
);

create table if not exists app.rag_requests (
  id uuid primary key default public.app_uuid_v7(),
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  user_id uuid not null references app.profiles(id) on delete cascade,
  task_type text not null,
  question text not null,
  query_hash text not null,
  selected_source_ids jsonb not null default '[]'::jsonb,
  selected_document_ids jsonb not null default '[]'::jsonb,
  ai_route text not null,
  data_classification data_classification not null,
  status text not null default 'queued' check (
    status in ('queued', 'running', 'completed', 'failed', 'blocked')
  ),
  error_code text null,
  error_message text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz null
);

create table if not exists app.rag_context_items (
  id uuid primary key default public.app_uuid_v7(),
  rag_request_id uuid not null references app.rag_requests(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  chunk_id uuid not null references app.legal_chunks(id) on delete cascade,
  source_id uuid not null references app.legal_sources(id) on delete cascade,
  document_version_id uuid not null references app.legal_document_versions(id) on delete cascade,
  rank integer not null check (rank >= 0),
  score numeric(12, 6) not null default 0,
  selection_reason text null,
  token_count integer not null default 0 check (token_count >= 0),
  citation_label text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.rag_outputs (
  id uuid primary key default public.app_uuid_v7(),
  rag_request_id uuid not null unique references app.rag_requests(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  schema_version text not null,
  output_json jsonb not null default '{}'::jsonb,
  validation_status text not null check (validation_status in ('valid', 'invalid', 'warning')),
  citation_validation_status text not null check (
    citation_validation_status in ('valid', 'invalid', 'warning')
  ),
  unsupported_count integer not null default 0 check (unsupported_count >= 0),
  risk_flags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.search_feedback (
  id uuid primary key default public.app_uuid_v7(),
  query_id text not null,
  result_id text not null,
  user_id uuid not null references app.profiles(id) on delete cascade,
  workspace_id uuid not null references app.workspaces(id) on delete cascade,
  feedback_type text not null check (
    feedback_type in (
      'useful',
      'irrelevant',
      'wrong_citation',
      'missing_source',
      'hallucination_suspected',
      'conflicting_sources'
    )
  ),
  comment text null,
  created_at timestamptz not null default timezone('utc', now())
);

insert into app.legal_source_providers (
  code,
  name,
  provider_type,
  jurisdiction,
  access_mode,
  license_notes,
  is_enabled
)
values
  (
    'user_upload',
    'User upload',
    'user_upload',
    'RU',
    'file_upload',
    'Workspace-scoped uploads managed by LexFrame documents.',
    true
  ),
  (
    'workspace_private',
    'Workspace private source',
    'workspace_private',
    'RU',
    'manual',
    'Manually curated private legal sources.',
    true
  ),
  (
    'product_curated',
    'Product curated source',
    'product_curated',
    'RU',
    'seeded',
    'Product-managed sources available for shared research use.',
    true
  )
on conflict (code) do update
set
  name = excluded.name,
  provider_type = excluded.provider_type,
  jurisdiction = excluded.jurisdiction,
  access_mode = excluded.access_mode,
  license_notes = excluded.license_notes,
  is_enabled = excluded.is_enabled,
  updated_at = timezone('utc', now());

create unique index if not exists idx_app_legal_sources_provider_external
  on app.legal_sources (provider_id, external_id)
  where external_id is not null;

create unique index if not exists idx_app_legal_document_versions_document_version
  on app.legal_document_versions (document_version_id)
  where document_version_id is not null;

create index if not exists idx_app_legal_sources_workspace_status
  on app.legal_sources (workspace_id, status, updated_at desc);

create index if not exists idx_app_legal_sources_visibility
  on app.legal_sources (visibility, source_type, updated_at desc);

create index if not exists idx_app_legal_import_jobs_workspace
  on app.legal_import_jobs (workspace_id, status, created_at desc);

create index if not exists idx_app_legal_extraction_jobs_document
  on app.legal_extraction_jobs (document_version_id, status, updated_at desc);

create index if not exists idx_app_legal_chunks_source
  on app.legal_chunks (source_id, document_version_id, chunk_no);

create index if not exists idx_app_rag_requests_workspace
  on app.rag_requests (workspace_id, status, created_at desc);

create index if not exists idx_app_rag_context_items_request
  on app.rag_context_items (rag_request_id, rank asc);

create index if not exists idx_app_search_feedback_workspace
  on app.search_feedback (workspace_id, created_at desc);
