insert into app.permissions (code, label, description, scope, high_risk)
values
  ('module.manage', 'Manage legal modules', 'Create, version, publish, and deprecate legal modules.', 'module', true),
  ('automation.fork', 'Fork automations', 'Fork installed automations or templates into workspace drafts.', 'automation', true),
  ('automation.update_source', 'Update automation source', 'Apply source template updates to installed automations.', 'automation', true),
  ('automation.submit_publication', 'Submit publication', 'Submit workspace templates for moderation.', 'automation', true),
  ('moderation.review', 'Review publication', 'Approve, reject, or request changes for publication requests.', 'moderation', true)
on conflict (code) do update
set
  label = excluded.label,
  description = excluded.description,
  scope = excluded.scope,
  high_risk = excluded.high_risk;

insert into app.role_permissions (role_code, permission_code)
values
  ('owner', 'module.manage'),
  ('owner', 'automation.fork'),
  ('owner', 'automation.update_source'),
  ('owner', 'automation.submit_publication'),
  ('owner', 'moderation.review'),
  ('admin', 'module.manage'),
  ('admin', 'automation.fork'),
  ('admin', 'automation.update_source'),
  ('admin', 'automation.submit_publication'),
  ('admin', 'moderation.review'),
  ('lawyer', 'automation.fork'),
  ('lawyer', 'automation.update_source'),
  ('lawyer', 'automation.submit_publication'),
  ('security_admin', 'moderation.review')
on conflict (role_code, permission_code) do nothing;

insert into app.legal_modules (
  id,
  code,
  title,
  category,
  description,
  risk_level,
  current_status
)
values
  ('11111111-1111-4111-8111-111111111111', 'legal.case-search', 'Case law search', 'research', 'Search and summarize relevant case law.', 'low', 'published'),
  ('11111111-1111-4111-8111-111111111112', 'legal.material-analysis', 'Material analysis', 'research', 'Analyze uploaded legal materials and produce a fact digest.', 'medium', 'published'),
  ('11111111-1111-4111-8111-111111111113', 'document.pretrial-draft', 'Pre-trial claim draft', 'drafting', 'Compose a pre-trial claim package from facts and practice.', 'high', 'published'),
  ('11111111-1111-4111-8111-111111111114', 'document.template-apply', 'Template apply', 'drafting', 'Apply a workspace template to structured inputs.', 'medium', 'published'),
  ('11111111-1111-4111-8111-111111111115', 'delivery.email-draft', 'Delivery email draft', 'delivery', 'Prepare an external delivery email draft.', 'high', 'published'),
  ('11111111-1111-4111-8111-111111111116', 'workflow.internal-approval', 'Internal approval', 'workflow', 'Send a draft into an internal approval step.', 'medium', 'published'),
  ('11111111-1111-4111-8111-111111111117', 'document.structure-check', 'Structure check', 'review', 'Validate structure against internal and court rules.', 'medium', 'published'),
  ('11111111-1111-4111-8111-111111111118', 'document.claim-draft', 'Claim draft', 'drafting', 'Prepare a statement of claim.', 'high', 'published'),
  ('11111111-1111-4111-8111-111111111119', 'library.publication-submit', 'Publication submit', 'library', 'Prepare a template for moderation.', 'medium', 'published')
on conflict (code) do update
set
  title = excluded.title,
  category = excluded.category,
  description = excluded.description,
  risk_level = excluded.risk_level,
  current_status = excluded.current_status,
  updated_at = timezone('utc', now());

insert into app.legal_module_versions (
  id,
  module_id,
  version,
  status,
  input_schema,
  output_schema,
  requirements,
  runtime_mapping,
  examples,
  validation_status,
  validation_issues,
  created_by_user_id,
  published_at
)
values
  (
    '22222222-2222-4222-8222-222222222221',
    '11111111-1111-4111-8111-111111111111',
    'v1',
    'published',
    '[{"code":"claim_brief","label":"Claim brief","schema":{"type":"string","minLength":20}}]'::jsonb,
    '[{"code":"practice_digest","label":"Practice digest","schema":{"type":"object"}}]'::jsonb,
    '[]'::jsonb,
    '{"target":"activepieces","piece":"legal-core.case-search","action":"search_practice"}'::jsonb,
    '["Find similar commercial dispute decisions."]'::jsonb,
    'valid',
    '[]'::jsonb,
    null,
    timezone('utc', now())
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    '11111111-1111-4111-8111-111111111112',
    'v1',
    'published',
    '[{"code":"source_documents","label":"Source documents","schema":{"type":"array"}}]'::jsonb,
    '[{"code":"fact_digest","label":"Fact digest","schema":{"type":"object"}}]'::jsonb,
    '[]'::jsonb,
    '{"target":"activepieces","piece":"legal-core.material-analysis","action":"analyze_materials"}'::jsonb,
    '["Summarize uploaded client materials."]'::jsonb,
    'valid',
    '[]'::jsonb,
    null,
    timezone('utc', now())
  ),
  (
    '22222222-2222-4222-8222-222222222223',
    '11111111-1111-4111-8111-111111111113',
    'v1',
    'published',
    '[{"code":"fact_digest","label":"Fact digest","schema":{"type":"object"}},{"code":"practice_digest","label":"Practice digest","schema":{"type":"object"}},{"code":"claim_template","label":"Claim template","schema":{"type":"object"}}]'::jsonb,
    '[{"code":"pretrial_claim_draft","label":"Pre-trial claim draft","schema":{"type":"object"}}]'::jsonb,
    '[{"code":"approval.external-delivery","label":"External delivery approval","kind":"approval","description":"External delivery requires manual approval.","status":"ready","optional":false,"sourceDocumentId":null}]'::jsonb,
    '{"target":"activepieces","piece":"legal-core.pretrial","action":"compose_pretrial_claim"}'::jsonb,
    '["Draft a pre-trial claim package for a supplier dispute."]'::jsonb,
    'valid',
    '[]'::jsonb,
    null,
    timezone('utc', now())
  )
on conflict (module_id, version) do update
set
  status = excluded.status,
  input_schema = excluded.input_schema,
  output_schema = excluded.output_schema,
  requirements = excluded.requirements,
  runtime_mapping = excluded.runtime_mapping,
  examples = excluded.examples,
  validation_status = excluded.validation_status,
  validation_issues = excluded.validation_issues,
  published_at = excluded.published_at;

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
  publication_status,
  compatibility_status,
  runtime_sync_state,
  available,
  disabled_reason,
  source_template_id,
  created_by_user_id,
  updated_by_user_id
)
values
  (
    '33333333-3333-4333-8333-333333333331',
    null,
    'claim.pretrial-package',
    'Pre-trial claim package',
    'dispute_pretrial',
    'Compose a pre-trial claim package with research, drafting and delivery preparation.',
    'product',
    'ready',
    'contract_ready',
    array['automation.install', 'document.read']::text[],
    array['legal.case-search', 'legal.material-analysis', 'document.pretrial-draft', 'delivery.email-draft']::text[],
    'not_requested',
    'runtime_sync_pending',
    'pending',
    true,
    null,
    null,
    null,
    null
  ),
  (
    '33333333-3333-4333-8333-333333333332',
    null,
    'public.contract-review',
    'Public contract review starter',
    'public_library',
    'Approved public starter template for contract review workflows.',
    'public',
    'ready',
    'frontend_ready',
    array['automation.install']::text[],
    array['legal.material-analysis', 'document.structure-check', 'workflow.internal-approval']::text[],
    'approved',
    'compatible',
    'synced',
    true,
    null,
    null,
    null,
    null
  )
on conflict (code) do update
set
  title = excluded.title,
  category = excluded.category,
  description = excluded.description,
  scope = excluded.scope,
  status = excluded.status,
  readiness = excluded.readiness,
  required_permissions = excluded.required_permissions,
  module_codes = excluded.module_codes,
  publication_status = excluded.publication_status,
  compatibility_status = excluded.compatibility_status,
  runtime_sync_state = excluded.runtime_sync_state,
  available = excluded.available,
  disabled_reason = excluded.disabled_reason,
  updated_at = timezone('utc', now());

insert into app.automation_template_versions (
  id,
  template_id,
  version,
  status,
  publication_status,
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
    '44444444-4444-4444-8444-444444444441',
    '33333333-3333-4333-8333-333333333331',
    'v1',
    'published',
    'not_requested',
    '{"id":"pretrial-claim-flow","version":"v1","steps":[{"id":"case-search","moduleCode":"legal.case-search","dependencies":[]},{"id":"materials-analysis","moduleCode":"legal.material-analysis","dependencies":[]},{"id":"claim-draft","moduleCode":"document.pretrial-draft","dependencies":["case-search","materials-analysis"]},{"id":"delivery-draft","moduleCode":"delivery.email-draft","dependencies":["claim-draft"],"requiresApproval":true}]}'::jsonb,
    '[{"code":"approval.external-delivery","label":"External delivery approval","kind":"approval","description":"External delivery requires manual approval.","status":"ready","optional":false,"sourceDocumentId":null}]'::jsonb,
    array['legal.case-search', 'legal.material-analysis', 'document.pretrial-draft', 'delivery.email-draft']::text[],
    array['claim_brief', 'source_documents', 'claim_template']::text[],
    'valid',
    '[]'::jsonb,
    null,
    timezone('utc', now())
  ),
  (
    '44444444-4444-4444-8444-444444444442',
    '33333333-3333-4333-8333-333333333332',
    'v1',
    'published',
    'approved',
    '{"id":"public-contract-review","version":"v1","steps":[{"id":"material-analysis","moduleCode":"legal.material-analysis","dependencies":[]},{"id":"structure-check","moduleCode":"document.structure-check","dependencies":["material-analysis"]},{"id":"internal-approval","moduleCode":"workflow.internal-approval","dependencies":["structure-check"]}]}'::jsonb,
    '[]'::jsonb,
    array['legal.material-analysis', 'document.structure-check', 'workflow.internal-approval']::text[],
    array['source_documents']::text[],
    'valid',
    '[]'::jsonb,
    null,
    timezone('utc', now())
  )
on conflict (template_id, version) do update
set
  status = excluded.status,
  publication_status = excluded.publication_status,
  workflow = excluded.workflow,
  requirements = excluded.requirements,
  module_codes = excluded.module_codes,
  required_inputs = excluded.required_inputs,
  validation_status = excluded.validation_status,
  validation_issues = excluded.validation_issues,
  published_at = excluded.published_at;
