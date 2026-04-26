-- Stage 16 live-audit seed manifest.
-- Role mapping: LexFrame currently uses `lawyer` as the editor-equivalent role required by the Stage 16 ТЗ.

insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at)
values
  ('16000000-0000-4000-8000-000000000001', 'stage16.owner@lexframe.test', '{"full_name":"Stage16 Owner"}', timezone('utc', now())),
  ('16000000-0000-4000-8000-000000000002', 'stage16.admin@lexframe.test', '{"full_name":"Stage16 Admin"}', timezone('utc', now())),
  ('16000000-0000-4000-8000-000000000003', 'stage16.lawyer@lexframe.test', '{"full_name":"Stage16 Lawyer Editor"}', timezone('utc', now())),
  ('16000000-0000-4000-8000-000000000004', 'stage16.viewer@lexframe.test', '{"full_name":"Stage16 Viewer"}', timezone('utc', now())),
  ('16000000-0000-4000-8000-000000000005', 'stage16.security@lexframe.test', '{"full_name":"Stage16 Security Admin"}', timezone('utc', now())),
  ('16000000-0000-4000-8000-000000000006', 'stage16.owner-b@lexframe.test', '{"full_name":"Stage16 Owner B"}', timezone('utc', now()))
on conflict (id) do update
set
  email = excluded.email,
  raw_user_meta_data = excluded.raw_user_meta_data,
  email_confirmed_at = excluded.email_confirmed_at,
  updated_at = timezone('utc', now());

insert into app.workspaces (id, slug, name, status, created_by_user_id)
values
  ('16000000-0000-4000-8000-00000000100a', 'stage16-live-a', 'Stage 16 Live Workspace A', 'active', '16000000-0000-4000-8000-000000000001'),
  ('16000000-0000-4000-8000-00000000100b', 'stage16-live-b', 'Stage 16 Live Workspace B', 'active', '16000000-0000-4000-8000-000000000006')
on conflict (id) do update
set
  slug = excluded.slug,
  name = excluded.name,
  status = excluded.status,
  updated_at = timezone('utc', now());

insert into app.profiles (id, email, full_name, default_workspace_id, onboarding_status, locale, timezone)
values
  ('16000000-0000-4000-8000-000000000001', 'stage16.owner@lexframe.test', 'Stage16 Owner', '16000000-0000-4000-8000-00000000100a', 'ready', 'ru', 'Europe/Berlin'),
  ('16000000-0000-4000-8000-000000000002', 'stage16.admin@lexframe.test', 'Stage16 Admin', '16000000-0000-4000-8000-00000000100a', 'ready', 'ru', 'Europe/Berlin'),
  ('16000000-0000-4000-8000-000000000003', 'stage16.lawyer@lexframe.test', 'Stage16 Lawyer Editor', '16000000-0000-4000-8000-00000000100a', 'ready', 'ru', 'Europe/Berlin'),
  ('16000000-0000-4000-8000-000000000004', 'stage16.viewer@lexframe.test', 'Stage16 Viewer', '16000000-0000-4000-8000-00000000100a', 'ready', 'ru', 'Europe/Berlin'),
  ('16000000-0000-4000-8000-000000000005', 'stage16.security@lexframe.test', 'Stage16 Security Admin', '16000000-0000-4000-8000-00000000100a', 'ready', 'ru', 'Europe/Berlin'),
  ('16000000-0000-4000-8000-000000000006', 'stage16.owner-b@lexframe.test', 'Stage16 Owner B', '16000000-0000-4000-8000-00000000100b', 'ready', 'ru', 'Europe/Berlin')
on conflict (id) do update
set
  email = excluded.email,
  full_name = excluded.full_name,
  default_workspace_id = excluded.default_workspace_id,
  onboarding_status = excluded.onboarding_status,
  updated_at = timezone('utc', now());

insert into app.workspace_members (workspace_id, auth_user_id, role_code, status)
values
  ('16000000-0000-4000-8000-00000000100a', '16000000-0000-4000-8000-000000000001', 'owner', 'active'),
  ('16000000-0000-4000-8000-00000000100a', '16000000-0000-4000-8000-000000000002', 'admin', 'active'),
  ('16000000-0000-4000-8000-00000000100a', '16000000-0000-4000-8000-000000000003', 'lawyer', 'active'),
  ('16000000-0000-4000-8000-00000000100a', '16000000-0000-4000-8000-000000000004', 'viewer', 'active'),
  ('16000000-0000-4000-8000-00000000100a', '16000000-0000-4000-8000-000000000005', 'security_admin', 'active'),
  ('16000000-0000-4000-8000-00000000100b', '16000000-0000-4000-8000-000000000006', 'owner', 'active')
on conflict (workspace_id, auth_user_id) do update
set
  role_code = excluded.role_code,
  status = excluded.status,
  updated_at = timezone('utc', now());

insert into app.documents (
  id,
  workspace_id,
  owner_id,
  title,
  description,
  kind,
  status,
  classification,
  source,
  tags,
  created_by_user_id,
  updated_by_user_id
)
values
  ('16000000-0000-4000-8000-000000002001', '16000000-0000-4000-8000-00000000100a', '16000000-0000-4000-8000-000000000003', 'Stage16 Public sample', 'Public Stage 16 audit document.', 'case_material', 'ready', 'public', 'system_import', array['stage16','public'], '16000000-0000-4000-8000-000000000001', '16000000-0000-4000-8000-000000000001'),
  ('16000000-0000-4000-8000-000000002002', '16000000-0000-4000-8000-00000000100a', '16000000-0000-4000-8000-000000000003', 'Stage16 Internal sample', 'Internal Stage 16 audit document.', 'case_material', 'ready', 'internal', 'system_import', array['stage16','internal'], '16000000-0000-4000-8000-000000000001', '16000000-0000-4000-8000-000000000001'),
  ('16000000-0000-4000-8000-000000002003', '16000000-0000-4000-8000-00000000100a', '16000000-0000-4000-8000-000000000003', 'Stage16 Confidential sample', 'Confidential Stage 16 audit document.', 'case_material', 'ready', 'confidential', 'system_import', array['stage16','confidential'], '16000000-0000-4000-8000-000000000001', '16000000-0000-4000-8000-000000000001'),
  ('16000000-0000-4000-8000-000000002004', '16000000-0000-4000-8000-00000000100a', '16000000-0000-4000-8000-000000000003', 'Stage16 Legal-sensitive sample', 'Legal-sensitive Stage 16 audit document.', 'case_material', 'ready', 'legal_secret', 'system_import', array['stage16','legal-sensitive'], '16000000-0000-4000-8000-000000000001', '16000000-0000-4000-8000-000000000001'),
  ('16000000-0000-4000-8000-00000000200b', '16000000-0000-4000-8000-00000000100b', '16000000-0000-4000-8000-000000000006', 'Stage16 Workspace B confidential', 'Cross-workspace isolation fixture.', 'case_material', 'ready', 'confidential', 'system_import', array['stage16','workspace-b'], '16000000-0000-4000-8000-000000000006', '16000000-0000-4000-8000-000000000006')
on conflict (id) do update
set
  title = excluded.title,
  description = excluded.description,
  classification = excluded.classification,
  tags = excluded.tags,
  updated_at = timezone('utc', now());

insert into app.document_versions (
  id,
  document_id,
  workspace_id,
  version_no,
  status,
  original_filename,
  normalized_filename,
  mime_type,
  size_bytes,
  sha256,
  storage_bucket,
  storage_path,
  scan_status,
  preview_status,
  extraction_status,
  created_by_user_id,
  completed_at
)
select
  ('16000000-0000-4000-8000-000000003' || lpad(row_number() over (order by d.id)::text, 3, '0'))::uuid,
  d.id,
  d.workspace_id,
  1,
  'ready',
  d.id::text || '.txt',
  d.id::text || '.txt',
  'text/plain',
  128,
  md5(d.id::text),
  'documents-private',
  'stage16/' || d.id::text || '.txt',
  'clean',
  'ready',
  'ready',
  d.created_by_user_id,
  timezone('utc', now())
from app.documents d
where d.id in (
  '16000000-0000-4000-8000-000000002001',
  '16000000-0000-4000-8000-000000002002',
  '16000000-0000-4000-8000-000000002003',
  '16000000-0000-4000-8000-000000002004',
  '16000000-0000-4000-8000-00000000200b'
)
on conflict (document_id, version_no) do update
set
  status = excluded.status,
  completed_at = excluded.completed_at,
  updated_at = timezone('utc', now());

update app.documents d
set current_version_id = v.id
from app.document_versions v
where v.document_id = d.id
  and v.version_no = 1
  and d.id in (
    '16000000-0000-4000-8000-000000002001',
    '16000000-0000-4000-8000-000000002002',
    '16000000-0000-4000-8000-000000002003',
    '16000000-0000-4000-8000-000000002004',
    '16000000-0000-4000-8000-00000000200b'
  );

insert into app.legal_work_profiles (id, workspace_id, owner_user_id, profile_type, name, description, status, created_by_user_id, updated_by_user_id)
values
  ('16000000-0000-4000-8000-000000004001', '16000000-0000-4000-8000-00000000100a', null, 'workspace', 'Stage16 Workspace Legal Profile', 'Live audit legal profile fixture.', 'active', '16000000-0000-4000-8000-000000000001', '16000000-0000-4000-8000-000000000001')
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description,
  status = excluded.status,
  updated_at = timezone('utc', now());

insert into app.legal_work_profile_versions (id, profile_id, workspace_id, version, schema_version, status, content, content_hash, created_by_user_id, published_by_user_id, published_at)
values
  ('16000000-0000-4000-8000-000000004101', '16000000-0000-4000-8000-000000004001', '16000000-0000-4000-8000-00000000100a', 1, 'stage16-live', 'published', '{"classification":"legal-sensitive","purpose":"stage16-live-audit"}', 'stage16-profile-v1', '16000000-0000-4000-8000-000000000001', '16000000-0000-4000-8000-000000000001', timezone('utc', now()))
on conflict (profile_id, version) do update
set
  status = excluded.status,
  content = excluded.content,
  content_hash = excluded.content_hash,
  published_at = excluded.published_at;

update app.legal_work_profiles
set current_version_id = '16000000-0000-4000-8000-000000004101'
where id = '16000000-0000-4000-8000-000000004001';

insert into app.document_templates (
  id,
  workspace_id,
  owner_user_id,
  source_document_id,
  source_document_version_id,
  title,
  description,
  visibility,
  status,
  created_by_user_id,
  updated_by_user_id
)
select
  '16000000-0000-4000-8000-000000005001',
  '16000000-0000-4000-8000-00000000100a',
  null,
  d.id,
  d.current_version_id,
  'Stage16 Live Template',
  'Template fixture for Canvas live audit.',
  'workspace',
  'published',
  '16000000-0000-4000-8000-000000000001',
  '16000000-0000-4000-8000-000000000001'
from app.documents d
where d.id = '16000000-0000-4000-8000-000000002002'
on conflict (id) do update
set
  title = excluded.title,
  description = excluded.description,
  status = excluded.status,
  updated_at = timezone('utc', now());

insert into app.document_template_versions (id, template_id, workspace_id, version, status, source_document_version_id, placeholders, mappings, created_by_user_id, published_at)
select
  '16000000-0000-4000-8000-000000005101',
  '16000000-0000-4000-8000-000000005001',
  '16000000-0000-4000-8000-00000000100a',
  1,
  'published',
  d.current_version_id,
  '[{"key":"client_name","type":"string"},{"key":"deadline","type":"date"}]',
  '[]',
  '16000000-0000-4000-8000-000000000001',
  timezone('utc', now())
from app.documents d
where d.id = '16000000-0000-4000-8000-000000002002'
on conflict (template_id, version) do update
set
  status = excluded.status,
  placeholders = excluded.placeholders,
  mappings = excluded.mappings,
  published_at = excluded.published_at;

update app.document_templates
set active_version_id = '16000000-0000-4000-8000-000000005101'
where id = '16000000-0000-4000-8000-000000005001';

insert into app.legal_modules (id, code, title, category, description, risk_level, current_status)
values
  ('16000000-0000-4000-8000-000000006001', 'stage16.audit.legal_action', 'Stage16 Legal Action', 'legal_action', 'Legal action module for live Canvas audit.', 'medium', 'published'),
  ('16000000-0000-4000-8000-000000006002', 'stage16.audit.ai_action', 'Stage16 AI Action', 'ai_action', 'AI action routed through LexFrame AI Gateway.', 'high', 'published'),
  ('16000000-0000-4000-8000-000000006003', 'stage16.audit.document_input', 'Stage16 Document Input', 'document_input', 'Document/data input module.', 'low', 'published'),
  ('16000000-0000-4000-8000-000000006004', 'stage16.audit.condition_router', 'Stage16 Condition Router', 'condition', 'No-code condition/router module.', 'low', 'published'),
  ('16000000-0000-4000-8000-000000006005', 'stage16.audit.loop_batch', 'Stage16 Loop Batch', 'loop', 'Loop/batch module for array processing.', 'medium', 'published'),
  ('16000000-0000-4000-8000-000000006006', 'stage16.audit.human_approval', 'Stage16 Human Approval', 'approval', 'Human approval gate module.', 'medium', 'published'),
  ('16000000-0000-4000-8000-000000006007', 'stage16.audit.delivery', 'Stage16 Delivery', 'delivery', 'External delivery module requiring approval.', 'critical', 'published'),
  ('16000000-0000-4000-8000-000000006008', 'stage16.audit.storage_artifact', 'Stage16 Storage Artifact', 'storage', 'Storage/artifact module.', 'low', 'published'),
  ('16000000-0000-4000-8000-000000006009', 'stage16.audit.deprecated', 'Stage16 Deprecated Module', 'legal_action', 'Deprecated module fixture.', 'medium', 'deprecated'),
  ('16000000-0000-4000-8000-000000006010', 'stage16.audit.forbidden', 'Stage16 Forbidden Module', 'delivery', 'Forbidden module fixture.', 'critical', 'retired'),
  ('16000000-0000-4000-8000-000000006011', 'stage16.audit.runtime_missing', 'Stage16 Runtime Missing Module', 'legal_action', 'Runtime missing module fixture.', 'high', 'published')
on conflict (code) do update
set
  title = excluded.title,
  category = excluded.category,
  description = excluded.description,
  risk_level = excluded.risk_level,
  current_status = excluded.current_status,
  updated_at = timezone('utc', now());

insert into app.legal_module_versions (
  module_id,
  version,
  status,
  input_schema,
  output_schema,
  requirements,
  runtime_mapping,
  examples,
  validation_status
)
select
  id,
  '1.0.0',
  case current_status when 'deprecated' then 'deprecated' when 'retired' then 'retired' else 'published' end,
  '[{"key":"input","type":"string","required":true}]',
  '[{"key":"result","type":"string","classification":"internal"}]',
  jsonb_build_array(jsonb_build_object('kind', 'stage16-live-audit', 'module_code', code)),
  jsonb_build_object('runtime', 'activepieces', 'piece', '@lexframe/' || replace(code, 'stage16.audit.', 'stage16-')),
  '[]',
  'valid'
from app.legal_modules
where code like 'stage16.audit.%'
on conflict (module_id, version) do update
set
  status = excluded.status,
  input_schema = excluded.input_schema,
  output_schema = excluded.output_schema,
  requirements = excluded.requirements,
  runtime_mapping = excluded.runtime_mapping,
  validation_status = excluded.validation_status;

insert into app.activepieces_piece_registry (
  piece_name,
  piece_version,
  display_name,
  source,
  actions,
  triggers,
  props_schema,
  status
)
values
  ('@lexframe/stage16-legal-action', '1.0.0', 'Stage16 Legal Action Piece', 'lexframe_private', '[{"name":"run"}]', '[]', '{}', 'active'),
  ('@lexframe/stage16-ai-action', '1.0.0', 'Stage16 AI Gateway Piece', 'lexframe_private', '[{"name":"ask_gateway"}]', '[]', '{}', 'active'),
  ('@lexframe/stage16-delivery', '1.0.0', 'Stage16 Delivery Piece', 'lexframe_private', '[{"name":"send_with_approval"}]', '[]', '{}', 'active'),
  ('@lexframe/stage16-runtime-missing', '1.0.0', 'Stage16 Missing Piece', 'lexframe_private', '[]', '[]', '{}', 'missing')
on conflict (piece_name, piece_version) do update
set
  display_name = excluded.display_name,
  actions = excluded.actions,
  triggers = excluded.triggers,
  props_schema = excluded.props_schema,
  status = excluded.status;

insert into app.legal_module_runtime_mappings (
  module_version_id,
  runtime,
  activepieces_piece_name,
  activepieces_piece_version,
  activepieces_action_name,
  props_mapping,
  input_transformer,
  output_transformer,
  supports_dry_run,
  supports_test_step,
  required_connection_types,
  required_permissions,
  data_policy,
  status
)
select
  mv.id,
  'activepieces',
  case m.code
    when 'stage16.audit.ai_action' then '@lexframe/stage16-ai-action'
    when 'stage16.audit.delivery' then '@lexframe/stage16-delivery'
    when 'stage16.audit.runtime_missing' then '@lexframe/stage16-runtime-missing'
    else '@lexframe/stage16-legal-action'
  end,
  '1.0.0',
  case m.code
    when 'stage16.audit.ai_action' then 'ask_gateway'
    when 'stage16.audit.delivery' then 'send_with_approval'
    else 'run'
  end,
  '{}',
  '{}',
  '{}',
  true,
  true,
  case when m.code = 'stage16.audit.delivery' then '[{"type":"delivery_sandbox"}]'::jsonb else '[]'::jsonb end,
  '[]'::jsonb,
  jsonb_build_object('classification', 'stage16-live-audit', 'external_delivery_requires_approval', m.code = 'stage16.audit.delivery'),
  case
    when m.code = 'stage16.audit.forbidden' then 'blocked'
    when m.code = 'stage16.audit.runtime_missing' then 'missing'
    when m.current_status = 'deprecated' then 'deprecated'
    else 'active'
  end
from app.legal_modules m
join app.legal_module_versions mv on mv.module_id = m.id and mv.version = '1.0.0'
where m.code like 'stage16.audit.%'
on conflict (module_version_id, runtime) do update
set
  activepieces_piece_name = excluded.activepieces_piece_name,
  activepieces_piece_version = excluded.activepieces_piece_version,
  activepieces_action_name = excluded.activepieces_action_name,
  required_connection_types = excluded.required_connection_types,
  data_policy = excluded.data_policy,
  status = excluded.status,
  updated_at = timezone('utc', now());

insert into app.automation_templates (
  id,
  workspace_id,
  code,
  title,
  category,
  description,
  scope,
  status,
  readiness,
  required_permissions,
  module_codes,
  compatibility_status,
  runtime_sync_state,
  available,
  created_by_user_id,
  updated_by_user_id
)
values
  ('16000000-0000-4000-8000-000000007001', '16000000-0000-4000-8000-00000000100a', 'stage16-live-canvas-template', 'Stage16 Live Canvas Template', 'stage16', 'Template fixture for Stage 16 live Canvas audit.', 'workspace', 'ready', 'production_ready', array['canvas.view','canvas.edit'], array['stage16.audit.legal_action'], 'compatible', 'not_requested', true, '16000000-0000-4000-8000-000000000001', '16000000-0000-4000-8000-000000000001')
on conflict (code) do update
set
  title = excluded.title,
  description = excluded.description,
  status = excluded.status,
  readiness = excluded.readiness,
  required_permissions = excluded.required_permissions,
  module_codes = excluded.module_codes,
  updated_at = timezone('utc', now());

insert into app.automation_template_versions (
  id,
  template_id,
  version,
  status,
  workflow,
  requirements,
  module_codes,
  required_inputs,
  validation_status,
  validation_issues,
  created_by_user_id,
  published_at
)
values
  (
    '16000000-0000-4000-8000-000000007101',
    '16000000-0000-4000-8000-000000007001',
    '1.0.0',
    'published',
    '{"schema_version":"2.0","metadata":{"name":"Stage16 Empty Canvas Fixture"},"inputs":[],"outputs":[],"nodes":[],"edges":[]}'::jsonb,
    '[]',
    array['stage16.audit.legal_action'],
    '{}',
    'valid',
    '[]',
    '16000000-0000-4000-8000-000000000001',
    timezone('utc', now())
  )
on conflict (template_id, version) do update
set
  status = excluded.status,
  workflow = excluded.workflow,
  validation_status = excluded.validation_status,
  published_at = excluded.published_at;

insert into app.installed_automations (
  id,
  workspace_id,
  template_id,
  source_template_version_id,
  title,
  version,
  workflow_state,
  builder_state,
  sync_state,
  compatibility_status,
  available,
  required_inputs,
  requirements,
  missing_connections,
  next_gate,
  workflow,
  created_by_user_id
)
values
  (
    '16000000-0000-4000-8000-000000008001',
    '16000000-0000-4000-8000-00000000100a',
    '16000000-0000-4000-8000-000000007001',
    '16000000-0000-4000-8000-000000007101',
    'Stage16 Live Canvas Automation A',
    '1.0.0',
    'draft',
    'ready',
    'not_requested',
    'compatible',
    true,
    '{}',
    '[]',
    '{}',
    'canvas',
    '{"schema_version":"2.0","metadata":{"name":"Stage16 Empty Canvas Fixture"},"inputs":[],"outputs":[],"nodes":[],"edges":[]}'::jsonb,
    '16000000-0000-4000-8000-000000000001'
  )
on conflict (id) do update
set
  title = excluded.title,
  workflow_state = excluded.workflow_state,
  builder_state = excluded.builder_state,
  sync_state = excluded.sync_state,
  compatibility_status = excluded.compatibility_status,
  workflow = excluded.workflow,
  updated_at = timezone('utc', now());

insert into app.runtime_connections (
  id,
  workspace_id,
  code,
  provider,
  display_name,
  external_connection_name,
  scope,
  status,
  metadata,
  last_checked_at,
  created_by_user_id
)
values
  ('16000000-0000-4000-8000-000000009001', '16000000-0000-4000-8000-00000000100a', 'email_provider', 'delivery_sandbox', 'Stage16 Connected Delivery', 'stage16-connected-delivery', 'workspace', 'connected', '{"sink":"delivery-sandbox","secret_ref":"vault://stage16/connected-delivery"}', timezone('utc', now()), '16000000-0000-4000-8000-000000000001'),
  ('16000000-0000-4000-8000-000000009002', '16000000-0000-4000-8000-00000000100a', 'stage16-missing-delivery', 'delivery_sandbox', 'Stage16 Missing Delivery', null, 'workspace', 'missing', '{"sink":"delivery-sandbox","reason":"missing"}', timezone('utc', now()), '16000000-0000-4000-8000-000000000001'),
  ('16000000-0000-4000-8000-000000009003', '16000000-0000-4000-8000-00000000100a', 'stage16-revoked-delivery', 'delivery_sandbox', 'Stage16 Revoked Delivery', 'stage16-revoked-delivery', 'workspace', 'revoked', '{"sink":"delivery-sandbox","reason":"revoked"}', timezone('utc', now()), '16000000-0000-4000-8000-000000000001'),
  ('16000000-0000-4000-8000-000000009004', '16000000-0000-4000-8000-00000000100a', 'stage16-forbidden-delivery', 'delivery_sandbox', 'Stage16 Forbidden Delivery', 'stage16-forbidden-delivery', 'workspace', 'error', '{"sink":"delivery-sandbox","reason":"forbidden","policy_blocked":true}', timezone('utc', now()), '16000000-0000-4000-8000-000000000001')
on conflict (workspace_id, code) do update
set
  provider = excluded.provider,
  display_name = excluded.display_name,
  external_connection_name = excluded.external_connection_name,
  status = excluded.status,
  metadata = excluded.metadata,
  last_checked_at = excluded.last_checked_at,
  updated_at = timezone('utc', now());

-- Stage 16 live acceptance must prove Activepieces runtime artifacts by
-- running sync against the controlled Activepieces instance. Do not seed a
-- synthetic "synced" runtime binding: it can mask missing AP flow/version rows.
