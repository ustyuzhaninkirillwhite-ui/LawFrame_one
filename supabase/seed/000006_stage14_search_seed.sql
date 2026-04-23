insert into app.workspaces (id, slug, name, status)
values (
  '00000000-0000-4000-8000-000000014900',
  'stage14-foreign-workspace',
  'Stage 14 Foreign Workspace',
  'active'
)
on conflict (slug) do update
set
  name = excluded.name,
  status = excluded.status,
  updated_at = timezone('utc', now());

insert into app.legal_source_providers (
  id,
  code,
  name,
  provider_type,
  jurisdiction,
  access_mode,
  license_notes,
  is_enabled
)
values (
  '00000000-0000-4000-8000-000000014001',
  'stage14_smoke_provider',
  'Stage 14 smoke provider',
  'manual_import',
  'RU',
  'seeded',
  'Deterministic Stage 14 search/RAG smoke corpus.',
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

insert into app.legal_sources (
  id,
  workspace_id,
  provider_id,
  source_type,
  jurisdiction,
  title,
  canonical_url,
  external_id,
  license_status,
  visibility,
  classification,
  status,
  owner_workspace_id,
  metadata
)
values
  (
    '00000000-0000-4000-8000-000000014101',
    null,
    '00000000-0000-4000-8000-000000014001',
    'court_decision',
    'RU',
    'Stage14 Public Estoppel Decision',
    'https://lexframe.local/stage14/public-estoppel',
    'stage14-public-estoppel',
    'allowed',
    'public',
    'public',
    'indexed',
    null,
    '{"court":"Stage 14 Public Court","caseNumber":"S14-PUBLIC-ESTOPPEL","decisionDate":"2026-04-01","categories":["stage14","estoppel"]}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000014102',
    null,
    '00000000-0000-4000-8000-000000014001',
    'internal_memo',
    'RU',
    'Stage14 Product Private Arbitration Note',
    'https://lexframe.local/stage14/product-private-arbitration',
    'stage14-product-private-arbitration',
    'allowed',
    'product_private',
    'internal',
    'indexed',
    null,
    '{"court":"Stage 14 Product Court","caseNumber":"S14-PRIVATE-ARBITRATION","decisionDate":"2026-04-02","categories":["stage14","private"]}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000014103',
    '00000000-0000-4000-8000-000000014900',
    '00000000-0000-4000-8000-000000014001',
    'internal_memo',
    'RU',
    'Stage14 Foreign Workspace Secret Source',
    'https://lexframe.local/stage14/foreign-secret',
    'stage14-foreign-secret',
    'allowed',
    'workspace_private',
    'confidential',
    'indexed',
    '00000000-0000-4000-8000-000000014900',
    '{"court":"Stage 14 Foreign Court","caseNumber":"S14-FOREIGN-SECRET","decisionDate":"2026-04-03","categories":["stage14","foreign"]}'::jsonb
  )
on conflict (id) do update
set
  title = excluded.title,
  canonical_url = excluded.canonical_url,
  external_id = excluded.external_id,
  license_status = excluded.license_status,
  visibility = excluded.visibility,
  classification = excluded.classification,
  status = excluded.status,
  owner_workspace_id = excluded.owner_workspace_id,
  metadata = excluded.metadata,
  updated_at = timezone('utc', now());

insert into app.legal_document_versions (
  id,
  source_id,
  workspace_id,
  version_no,
  text_hash,
  metadata_hash,
  embedding_hash,
  language,
  effective_date,
  published_at,
  ingested_at,
  status
)
values
  (
    '00000000-0000-4000-8000-000000014201',
    '00000000-0000-4000-8000-000000014101',
    null,
    1,
    'sha256:stage14-public-estoppel',
    'sha256:stage14-public-estoppel-meta',
    'sha256:stage14-public-estoppel-embedding',
    'ru',
    '2026-04-01',
    '2026-04-01T10:00:00Z',
    timezone('utc', now()),
    'indexed'
  ),
  (
    '00000000-0000-4000-8000-000000014202',
    '00000000-0000-4000-8000-000000014102',
    null,
    1,
    'sha256:stage14-private-arbitration',
    'sha256:stage14-private-arbitration-meta',
    'sha256:stage14-private-arbitration-embedding',
    'ru',
    '2026-04-02',
    '2026-04-02T10:00:00Z',
    timezone('utc', now()),
    'indexed'
  ),
  (
    '00000000-0000-4000-8000-000000014203',
    '00000000-0000-4000-8000-000000014103',
    '00000000-0000-4000-8000-000000014900',
    1,
    'sha256:stage14-foreign-secret',
    'sha256:stage14-foreign-secret-meta',
    'sha256:stage14-foreign-secret-embedding',
    'ru',
    '2026-04-03',
    '2026-04-03T10:00:00Z',
    timezone('utc', now()),
    'indexed'
  )
on conflict (source_id, version_no) do update
set
  text_hash = excluded.text_hash,
  metadata_hash = excluded.metadata_hash,
  embedding_hash = excluded.embedding_hash,
  status = excluded.status,
  updated_at = timezone('utc', now());

insert into app.legal_chunks (
  id,
  source_id,
  document_version_id,
  workspace_id,
  chunk_no,
  chunk_type,
  text,
  text_hash,
  page_from,
  page_to,
  char_start,
  char_end,
  metadata,
  security_scope,
  embedding_model,
  embedding_hash,
  index_version,
  citation_label,
  indexed_at
)
values
  (
    '00000000-0000-4000-8000-000000014301',
    '00000000-0000-4000-8000-000000014101',
    '00000000-0000-4000-8000-000000014201',
    null,
    0,
    'holding',
    'Stage14 estoppel public source: the court held that a party who accepted performance without objection is barred from contradicting that conduct in later pleadings.',
    'sha256:stage14-public-estoppel-chunk',
    2,
    2,
    0,
    160,
    '{"court":"Stage 14 Public Court","caseNumber":"S14-PUBLIC-ESTOPPEL"}'::jsonb,
    'public',
    'stage14-deterministic-embedding',
    'sha256:stage14-public-estoppel-embedding',
    'stage14',
    'S14 Public Estoppel, p.2',
    timezone('utc', now())
  ),
  (
    '00000000-0000-4000-8000-000000014302',
    '00000000-0000-4000-8000-000000014102',
    '00000000-0000-4000-8000-000000014202',
    null,
    0,
    'court_reasoning',
    'Stage14 private arbitration source: product-private arbitration materials require citation labels and source identifiers before a workflow may reuse them.',
    'sha256:stage14-private-arbitration-chunk',
    4,
    4,
    0,
    170,
    '{"court":"Stage 14 Product Court","caseNumber":"S14-PRIVATE-ARBITRATION"}'::jsonb,
    'product_private',
    'stage14-deterministic-embedding',
    'sha256:stage14-private-arbitration-embedding',
    'stage14',
    'S14 Private Arbitration, p.4',
    timezone('utc', now())
  ),
  (
    '00000000-0000-4000-8000-000000014303',
    '00000000-0000-4000-8000-000000014103',
    '00000000-0000-4000-8000-000000014203',
    '00000000-0000-4000-8000-000000014900',
    0,
    'facts',
    'foreign-only-stage14 confidential workspace source must never leak to another workspace search or RAG context.',
    'sha256:stage14-foreign-secret-chunk',
    1,
    1,
    0,
    110,
    '{"court":"Stage 14 Foreign Court","caseNumber":"S14-FOREIGN-SECRET"}'::jsonb,
    'workspace_private',
    'stage14-deterministic-embedding',
    'sha256:stage14-foreign-secret-embedding',
    'stage14',
    'S14 Foreign Secret, p.1',
    timezone('utc', now())
  )
on conflict (document_version_id, chunk_no) do update
set
  text = excluded.text,
  text_hash = excluded.text_hash,
  metadata = excluded.metadata,
  security_scope = excluded.security_scope,
  embedding_model = excluded.embedding_model,
  embedding_hash = excluded.embedding_hash,
  index_version = excluded.index_version,
  citation_label = excluded.citation_label,
  indexed_at = excluded.indexed_at,
  updated_at = timezone('utc', now());
