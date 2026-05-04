import { spawnSync } from "node:child_process";

const productContainer =
  process.env.STAGE17_PRODUCT_POSTGRES_CONTAINER ??
  "lexframe-stage17-lexframe-product-postgres-1";
const activepiecesContainer =
  process.env.STAGE17_ACTIVEPIECES_POSTGRES_CONTAINER ??
  "lexframe-stage17-activepieces-postgres-1";

const productSql = String.raw`
do $$
declare
  v_workspace_id uuid := '16000000-0000-4000-8000-00000000100a';
  v_actor_id uuid := '16000000-0000-4000-8000-000000000001';
  v_automation_id uuid := '16000000-0000-4000-8000-000000008001';
  v_template_version_id uuid := '16000000-0000-4000-8000-000000007101';
  v_external_project_id text := 'lex_ws_' || v_workspace_id::text;
  v_external_user_id text := 'lex_user_' || v_actor_id::text;
  v_ap_project_id text := 'lfstg17project0000001';
  v_ap_user_id text := 'lfstg17user000001';
  v_ap_flow_id text := 'lfstg17flow0000000001';
  v_ap_flow_version_id text := 'lfstg17flowver0000001';
  v_sync_hash text := 'stage17-canvas-seed-v1';
begin
  update app.installed_automations
  set
    workflow_state = 'execution_ready',
    builder_state = 'ready',
    sync_state = 'synced',
    compatibility_status = 'compatible',
    runtime_project_id = v_ap_project_id,
    runtime_flow_id = v_ap_flow_id,
    sync_hash = v_sync_hash,
    last_synced_at = timezone('utc', now()),
    next_gate = 'ready',
    workflow = jsonb_build_object(
      'version', 'stage17',
      'source', 'stage17_provision_canvas',
      'trigger', jsonb_build_object('type', 'manual'),
      'runtime', jsonb_build_object(
        'provider', 'activepieces',
        'projectId', v_ap_project_id,
        'flowId', v_ap_flow_id,
        'flowVersionId', v_ap_flow_version_id
      )
    ),
    updated_at = timezone('utc', now())
  where id = v_automation_id
    and workspace_id = v_workspace_id;

  insert into app.activepieces_project_bindings (
    workspace_id,
    external_project_id,
    display_name,
    status,
    last_synced_at,
    created_by_user_id,
    project_id,
    ap_project_id,
    last_read_back_at,
    last_session_trace_id
  )
  values (
    v_workspace_id,
    v_external_project_id,
    'Stage 17 Activepieces Canvas',
    'provisioned',
    timezone('utc', now()),
    v_actor_id,
    'project_claim_001',
    v_ap_project_id,
    timezone('utc', now()),
    'stage17-provision-canvas'
  )
  on conflict (workspace_id) do update
  set
    external_project_id = excluded.external_project_id,
    display_name = excluded.display_name,
    status = 'provisioned',
    last_synced_at = timezone('utc', now()),
    project_id = excluded.project_id,
    ap_project_id = excluded.ap_project_id,
    last_read_back_at = timezone('utc', now()),
    last_session_trace_id = excluded.last_session_trace_id,
    updated_at = timezone('utc', now());

  insert into app.activepieces_user_bindings (
    workspace_id,
    auth_user_id,
    external_user_id,
    role,
    last_token_issued_at,
    ap_user_id,
    last_login_at,
    last_read_back_at,
    last_session_trace_id
  )
  values (
    v_workspace_id,
    v_actor_id,
    v_external_user_id,
    'ADMIN',
    timezone('utc', now()),
    v_ap_user_id,
    timezone('utc', now()),
    timezone('utc', now()),
    'stage17-provision-canvas'
  )
  on conflict (workspace_id, auth_user_id) do update
  set
    external_user_id = excluded.external_user_id,
    role = 'ADMIN',
    last_token_issued_at = timezone('utc', now()),
    ap_user_id = excluded.ap_user_id,
    last_login_at = timezone('utc', now()),
    last_read_back_at = timezone('utc', now()),
    last_session_trace_id = excluded.last_session_trace_id,
    updated_at = timezone('utc', now());

  insert into app.automation_runtime_bindings (
    installed_automation_id,
    workspace_id,
    source_template_version_id,
    external_project_id,
    external_flow_id,
    sync_hash,
    projection_version,
    projection,
    status,
    last_synced_at,
    activepieces_flow_version_id,
    source_workflow_hash,
    runtime_hash,
    last_synced_hash,
    last_checked_at,
    last_synced_workflow_hash,
    last_synced_mapping_hash,
    active,
    activepieces_read_back_status,
    last_read_back_at,
    last_session_trace_id
  )
  values (
    v_automation_id,
    v_workspace_id,
    v_template_version_id,
    v_ap_project_id,
    v_ap_flow_id,
    v_sync_hash,
    'stage17',
    jsonb_build_object(
      'runtime', 'activepieces',
      'projectId', v_ap_project_id,
      'flowId', v_ap_flow_id,
      'flowVersionId', v_ap_flow_version_id,
      'redacted', true
    ),
    'synced',
    timezone('utc', now()),
    v_ap_flow_version_id,
    v_sync_hash,
    v_sync_hash,
    v_sync_hash,
    timezone('utc', now()),
    v_sync_hash,
    v_sync_hash,
    true,
    'succeeded',
    timezone('utc', now()),
    'stage17-provision-canvas'
  )
  on conflict (installed_automation_id) do update
  set
    external_project_id = excluded.external_project_id,
    external_flow_id = excluded.external_flow_id,
    sync_hash = excluded.sync_hash,
    projection_version = excluded.projection_version,
    projection = excluded.projection,
    status = 'synced',
    last_synced_at = timezone('utc', now()),
    activepieces_flow_version_id = excluded.activepieces_flow_version_id,
    source_workflow_hash = excluded.source_workflow_hash,
    runtime_hash = excluded.runtime_hash,
    last_synced_hash = excluded.last_synced_hash,
    last_checked_at = timezone('utc', now()),
    last_synced_workflow_hash = excluded.last_synced_workflow_hash,
    last_synced_mapping_hash = excluded.last_synced_mapping_hash,
    active = true,
    activepieces_read_back_status = 'succeeded',
    last_read_back_at = timezone('utc', now()),
    last_session_trace_id = excluded.last_session_trace_id,
    updated_at = timezone('utc', now());

  insert into app.activepieces_flow_bindings (
    workspace_id,
    automation_id,
    runtime_binding_id,
    ap_project_id,
    ap_flow_id,
    ap_flow_version_id,
    piece_version_pin,
    source_workflow_hash,
    runtime_hash,
    last_synced_hash,
    sync_status,
    last_synced_at,
    last_read_back_at
  )
  select
    workspace_id,
    installed_automation_id,
    id,
    v_ap_project_id,
    v_ap_flow_id,
    v_ap_flow_version_id,
    '0.0.5',
    v_sync_hash,
    v_sync_hash,
    v_sync_hash,
    'synced',
    timezone('utc', now()),
    timezone('utc', now())
  from app.automation_runtime_bindings
  where installed_automation_id = v_automation_id
    and workspace_id = v_workspace_id
  on conflict (workspace_id, automation_id) do update
  set
    runtime_binding_id = excluded.runtime_binding_id,
    ap_project_id = excluded.ap_project_id,
    ap_flow_id = excluded.ap_flow_id,
    ap_flow_version_id = excluded.ap_flow_version_id,
    piece_version_pin = excluded.piece_version_pin,
    source_workflow_hash = excluded.source_workflow_hash,
    runtime_hash = excluded.runtime_hash,
    last_synced_hash = excluded.last_synced_hash,
    sync_status = 'synced',
    last_synced_at = timezone('utc', now()),
    last_read_back_at = timezone('utc', now()),
    updated_at = timezone('utc', now());
end $$;
`;

const activepiecesSql = String.raw`
do $$
declare
  v_platform_id text := 'lfstg17platform000001';
  v_identity_id text := 'lfstg17identity01';
  v_user_id text := 'lfstg17user000001';
  v_project_id text := 'lfstg17project0000001';
  v_flow_id text := 'lfstg17flow0000000001';
  v_flow_version_id text := 'lfstg17flowver0000001';
  v_now text := to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  update "user"
  set "platformId" = null,
      updated = now()
  where id = v_user_id
    and "platformId" is not null
    and "platformId" <> v_platform_id;

  delete from flow_version
  where id in ('lfstg17flowver01')
     or "flowId" in ('lfstg17flow00001');

  delete from flow
  where id in ('lfstg17flow00001');

  delete from project_plan
  where "projectId" in ('lfstg17project01')
     or ("projectId" <> v_project_id and "projectId" in (
       select id
       from project
       where "externalId" = 'lex_ws_16000000-0000-4000-8000-00000000100a'
     ));

  delete from project
  where id in ('lfstg17project01')
     or ("externalId" = 'lex_ws_16000000-0000-4000-8000-00000000100a'
       and id <> v_project_id);

  delete from platform
  where id in ('lfstg17platform01')
     or ("ownerId" = v_user_id and id <> v_platform_id);

  insert into user_identity (
    id,
    email,
    password,
    "trackEvents",
    "newsLetter",
    verified,
    "firstName",
    "lastName",
    "tokenVersion",
    provider
  )
  values (
    v_identity_id,
    'stage17.owner@lexframe.test',
    'managed-by-lexframe-jwt',
    false,
    false,
    true,
    'LexFrame',
    'Stage17',
    'stage17',
    'EMAIL'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    verified = true,
    updated = now();

  insert into "user" (
    id,
    status,
    "externalId",
    "platformId",
    "platformRole",
    "identityId"
  )
  values (
    v_user_id,
    'ACTIVE',
    'lex_user_16000000-0000-4000-8000-000000000001',
    null,
    'ADMIN',
    v_identity_id
  )
  on conflict (id) do update
  set
    status = 'ACTIVE',
    "externalId" = excluded."externalId",
    "platformRole" = 'ADMIN',
    "identityId" = excluded."identityId",
    updated = now();

  insert into platform (
    id,
    "ownerId",
    name,
    "primaryColor",
    "logoIconUrl",
    "fullLogoUrl",
    "favIconUrl",
    "showPoweredBy",
    "cloudAuthEnabled",
    "embeddingEnabled",
    "filteredPieceNames",
    "filteredPieceBehavior",
    "environmentsEnabled",
    "defaultLocale",
    "allowedAuthDomains",
    "enforceAllowedAuthDomains",
    "ssoEnabled",
    "emailAuthEnabled",
    "federatedAuthProviders",
    "auditLogEnabled",
    "customDomainsEnabled",
    "customAppearanceEnabled",
    "manageProjectsEnabled",
    "managePiecesEnabled",
    "manageTemplatesEnabled",
    "apiKeysEnabled",
    "projectRolesEnabled",
    "flowIssuesEnabled",
    "alertsEnabled",
    "analyticsEnabled",
    "licenseKey",
    smtp,
    "pinnedPieces",
    "globalConnectionsEnabled",
    "customRolesEnabled",
    "copilotSettings"
  )
  values (
    v_platform_id,
    v_user_id,
    'LexFrame Stage 17',
    '#1688fe',
    '',
    '',
    '',
    false,
    false,
    true,
    array[
      '@activepieces/piece-manual-trigger',
      '@lexframe/piece-ai-gateway'
    ]::varchar[],
    'ALLOWED',
    false,
    'ru',
    array[]::varchar[],
    false,
    false,
    false,
    '{}'::jsonb,
    true,
    false,
    true,
    true,
    false,
    false,
    true,
    false,
    true,
    true,
    false,
    null,
    null,
    array['@activepieces/piece-manual-trigger']::varchar[],
    false,
    false,
    '{"providers":{}}'::jsonb
  )
  on conflict (id) do update
  set
    "ownerId" = excluded."ownerId",
    name = excluded.name,
    "embeddingEnabled" = true,
    "filteredPieceNames" = excluded."filteredPieceNames",
    "filteredPieceBehavior" = 'ALLOWED',
    "defaultLocale" = 'ru',
    "copilotSettings" = excluded."copilotSettings",
    updated = now();

  delete from piece_metadata
  where name = '@activepieces/piece-manual-trigger'
    and version = '0.0.5';

  insert into piece_metadata (
    id,
    name,
    "displayName",
    "logoUrl",
    description,
    version,
    "minimumSupportedRelease",
    "maximumSupportedRelease",
    actions,
    triggers,
    "projectId",
    auth,
    "pieceType",
    "packageType",
    "archiveId",
    "platformId",
    categories,
    authors,
    "projectUsage"
  )
  values (
    'lfstg17piece000000001',
    '@activepieces/piece-manual-trigger',
    'Manual Trigger',
    'https://cdn.activepieces.com/pieces/new-core/manual-trigger.svg',
    'Trigger this flow manually.',
    '0.0.5',
    '0.0.0',
    '999.999.999',
    '{}'::json,
    json_build_object(
      'manual_trigger', json_build_object(
        'name', 'manual_trigger',
        'displayName', 'Manual Trigger',
        'description', 'Trigger this flow manually.',
        'props', '{}'::json,
        'type', 'MANUAL',
        'sampleData', '{}'::json,
        'testStrategy', 'SIMULATION'
      )
    ),
    null,
    null,
    'OFFICIAL',
    'REGISTRY',
    null,
    null,
    array['CORE']::varchar[],
    array['LexFrame Stage17']::varchar[],
    0
  );

  update "user"
  set "platformId" = v_platform_id,
      updated = now()
  where id = v_user_id;

  insert into project (
    id,
    "ownerId",
    "displayName",
    "notifyStatus",
    "platformId",
    "externalId",
    "releasesEnabled"
  )
  values (
    v_project_id,
    v_user_id,
    'LexFrame Stage 17 Canvas',
    'ALWAYS',
    v_platform_id,
    'lex_ws_16000000-0000-4000-8000-00000000100a',
    false
  )
  on conflict (id) do update
  set
    "ownerId" = excluded."ownerId",
    "displayName" = excluded."displayName",
    "notifyStatus" = 'ALWAYS',
    "platformId" = excluded."platformId",
    "externalId" = excluded."externalId",
    updated = now();

  insert into project_plan (
    id,
    "projectId",
    name,
    "stripeCustomerId",
    "stripeSubscriptionId",
    tasks,
    "subscriptionStartDatetime"
  )
  values (
    'lfstg17plan00001',
    v_project_id,
    'FREE',
    '',
    '',
    100000,
    now()
  )
  on conflict (id) do update
  set
    "projectId" = excluded."projectId",
    name = excluded.name,
    tasks = excluded.tasks,
    updated = now();

  insert into flow (
    id,
    "projectId",
    "folderId",
    status,
    schedule,
    "publishedVersionId",
    "externalId"
  )
  values (
    v_flow_id,
    v_project_id,
    null,
    'DISABLED',
    null,
    null,
    '16000000-0000-4000-8000-000000008001'
  )
  on conflict (id) do update
  set
    "projectId" = excluded."projectId",
    status = 'DISABLED',
    "externalId" = excluded."externalId",
    updated = now();

  insert into flow_version (
    id,
    "flowId",
    "displayName",
    trigger,
    valid,
    state,
    "updatedBy",
    "schemaVersion"
  )
  values (
    v_flow_version_id,
    v_flow_id,
    'Stage 17 LexFrame AI Gateway flow',
    jsonb_build_object(
      'name', 'trigger',
      'valid', true,
      'displayName', 'Manual Trigger',
      'type', 'PIECE_TRIGGER',
      'settings', jsonb_build_object(
        'pieceName', '@activepieces/piece-manual-trigger',
        'pieceVersion', '0.0.5',
        'pieceType', 'OFFICIAL',
        'packageType', 'REGISTRY',
        'triggerName', 'manual_trigger',
        'input', '{}'::jsonb,
        'inputUiInfo', '{}'::jsonb
      ),
      'lastUpdatedDate', v_now
    ),
    true,
    'DRAFT',
    v_user_id,
    '20'
  )
  on conflict (id) do update
  set
    "displayName" = excluded."displayName",
    trigger = excluded.trigger,
    valid = true,
    state = 'DRAFT',
    "updatedBy" = excluded."updatedBy",
    "schemaVersion" = excluded."schemaVersion",
    updated = now();
end $$;
`;

runPsql({
  container: productContainer,
  user: "postgres",
  database: "stage17_runtime",
  sql: productSql,
});

runPsql({
  container: activepiecesContainer,
  user: "activepieces",
  database: "activepieces",
  sql: activepiecesSql,
});

console.log(
  "[stage17:provision-canvas] provisioned product bindings and Activepieces read-back rows",
);

function runPsql({ container, user, database, sql }) {
  const result = spawnSync(
    "docker",
    ["exec", "-i", container, "psql", "-U", user, "-d", database, "-v", "ON_ERROR_STOP=1"],
    {
      input: sql,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    },
  );

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
