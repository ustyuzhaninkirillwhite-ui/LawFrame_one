import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const activepiecesBaseUrl =
  process.env.ACTIVEPIECES_BASE_URL ?? "http://127.0.0.1:8080";
const activepiecesEmail =
  process.env.ACTIVEPIECES_SERVICE_EMAIL ?? "lexframe-stage16@lexframe.test";
const activepiecesPassword =
  process.env.ACTIVEPIECES_SERVICE_PASSWORD ?? "Stage16Activepieces!123";
const lexframeDbName = process.env.STAGE16_DB_NAME ?? "stage16_runtime";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed\n${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    );
  }
  return result.stdout ?? "";
}

function psql(service, database, sql) {
  return run("docker", [
    "compose",
    "exec",
    "-T",
    service,
    "psql",
    "-U",
    "postgres",
    "-d",
    database,
    "-v",
    "ON_ERROR_STOP=1",
    "-At",
    "-F",
    "\t",
    "-c",
    sql,
  ]).trim();
}

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function request(path, init = {}, expectOk = true) {
  const response = await fetch(`${activepiecesBaseUrl.replace(/\/$/, "")}${path}`, init);
  if (expectOk && !response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`${path} returned ${response.status}: ${text.slice(0, 500)}`);
  }
  return response;
}

async function auth() {
  const signInBody = JSON.stringify({
    email: activepiecesEmail,
    password: activepiecesPassword,
  });
  let response = await request(
    "/api/v1/authentication/sign-in",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: signInBody,
    },
    false,
  );
  if (!response.ok) {
    await request("/api/v1/authentication/sign-up", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: activepiecesEmail,
        password: activepiecesPassword,
        firstName: "LexFrame",
        lastName: "Stage16",
        trackEvents: false,
        newsLetter: false,
      }),
    }, false);
    response = await request("/api/v1/authentication/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: signInBody,
    });
  }
  return response.json();
}

async function activepiecesApi(path, token, projectId) {
  const url = new URL(`${activepiecesBaseUrl.replace(/\/$/, "")}${path}`);
  if (projectId) {
    url.searchParams.set("projectId", projectId);
  }
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`${path} returned ${response.status}: ${text.slice(0, 500)}`);
  }
  return response.json();
}

function tableCount(table) {
  return Number(
    psql(
      "activepieces-postgres",
      "activepieces",
      `select count(*) from public.${table};`,
    ),
  );
}

function latestBindings() {
  const rows = psql(
    "postgres",
    lexframeDbName,
    `
      select
        coalesce(external_project_id, ''),
        coalesce(external_flow_id, ''),
        coalesce(activepieces_flow_version_id, ''),
        coalesce(status, ''),
        coalesce(last_compile_report_id::text, ''),
        coalesce(runtime_hash, '')
      from app.automation_runtime_bindings
      where runtime = 'activepieces'
        and external_flow_id is not null
      order by updated_at desc
      limit 10
    `,
  );
  if (!rows) {
    return [];
  }
  return rows.split(/\r?\n/).map((line) => {
    const [
      projectId,
      flowId,
      flowVersionId,
      status,
      compileReportId,
      runtimeHash,
    ] = line.split("\t");
    return {
      projectId,
      flowId,
      flowVersionId,
      status,
      compileReportId,
      runtimeHash,
    };
  });
}

function lexframeDuplicateFlowGroups() {
  const rows = psql(
    "activepieces-postgres",
    "activepieces",
    `
      with latest_versions as (
        select distinct on ("flowId")
          "flowId",
          "displayName",
          trigger
        from public.flow_version
        order by "flowId", created desc
      ),
      lexframe_flows as (
        select
          f."projectId",
          coalesce(
            nullif(f."externalId", ''),
            nullif(
              concat_ws(
                ':',
                'lexframe',
                v.trigger #>> '{settings,lexframe,workspaceId}',
                v.trigger #>> '{settings,lexframe,automationId}'
              ),
              'lexframe'
            )
          ) as target,
          v.trigger #>> '{settings,lexframe,workspaceId}' as workspace_id,
          v.trigger #>> '{settings,lexframe,automationId}' as automation_id,
          v.trigger #>> '{settings,lexframe,sourceWorkflowHash}' as source_workflow_hash,
          f.id,
          coalesce(f."externalId", '') as external_id,
          coalesce(v."displayName", '') as display_name
        from public.flow f
        join latest_versions v on v."flowId" = f.id
        where coalesce(f."externalId", '') like 'lexframe:%'
           or v.trigger #>> '{settings,lexframe,managedBy}' = 'lexframe'
      )
      select
        "projectId",
        target,
        coalesce(workspace_id, ''),
        coalesce(automation_id, ''),
        coalesce(source_workflow_hash, ''),
        count(*),
        json_agg(
          json_build_object(
            'flowId', id,
            'externalId', external_id,
            'displayName', display_name
          )
          order by id
        )
      from lexframe_flows
      where target is not null
      group by 1, 2, 3, 4, 5
      having count(*) > 1
      order by count(*) desc
    `,
  );
  if (!rows) {
    return [];
  }
  return rows.split(/\r?\n/).map((line) => {
    const [
      projectId,
      target,
      workspaceId,
      automationId,
      sourceWorkflowHash,
      count,
      flowsJson,
    ] = line.split("\t");
    return {
      projectId,
      target,
      workspaceId,
      automationId,
      sourceWorkflowHash,
      count: Number(count),
      flows: JSON.parse(flowsJson),
    };
  });
}

async function verifyBinding(binding, token) {
  const projectRows = Number(
    psql(
      "activepieces-postgres",
      "activepieces",
      `select count(*) from public.project where id = ${sqlLiteral(binding.projectId)};`,
    ),
  );
  const flowRows = Number(
    psql(
      "activepieces-postgres",
      "activepieces",
      `select count(*) from public.flow where id = ${sqlLiteral(binding.flowId)} and "projectId" = ${sqlLiteral(binding.projectId)};`,
    ),
  );
  const versionRows = Number(
    psql(
      "activepieces-postgres",
      "activepieces",
      `select count(*) from public.flow_version where "flowId" = ${sqlLiteral(binding.flowId)};`,
    ),
  );
  let flow = null;
  let apiError = null;
  try {
    flow = await activepiecesApi(
      `/api/v1/flows/${encodeURIComponent(binding.flowId)}`,
      token,
      binding.projectId,
    );
  } catch (error) {
    apiError = error instanceof Error ? error.message : String(error);
  }
  const apiVersionId = flow?.version?.id ?? flow?.publishedVersionId ?? null;
  const matches =
    projectRows > 0 &&
    flowRows > 0 &&
    versionRows > 0 &&
    flow?.id === binding.flowId &&
    flow?.projectId === binding.projectId &&
    Boolean(apiVersionId);
  return {
    ...binding,
    projectRows,
    flowRows,
    versionRows,
    apiVersionId,
    apiError,
    publishedVersionId: flow?.publishedVersionId ?? null,
    flowStatus: flow?.status ?? null,
    matches,
  };
}

const health = await request("/", { method: "GET" }, false);
const authSession = await auth();
const bindings = latestBindings();
const verified = [];
for (const binding of bindings) {
  verified.push(await verifyBinding(binding, authSession.token));
}
const duplicateFlowGroups = lexframeDuplicateFlowGroups();
const syncSuccessCount = Number(
  psql(
    "postgres",
    lexframeDbName,
    `
      select count(*)
      from app.automation_runtime_sync_events
      where event_type = 'runtime_sync'
        and status = 'completed'
    `,
  ),
);
const auditCount = Number(
  psql(
    "postgres",
    lexframeDbName,
    `
      select count(*)
      from audit.audit_events
      where action like 'workflow.runtime_sync%'
         or action like '%activepieces%'
    `,
  ),
);

const evidence = {
  activepieces: {
    image: "activepieces/activepieces:0.44.0",
    baseUrl: activepiecesBaseUrl,
    healthStatus: health.status,
    serviceProjectId: authSession.projectId,
    counts: {
      project: tableCount("project"),
      flow: tableCount("flow"),
      flow_version: tableCount("flow_version"),
      flow_run: tableCount("flow_run"),
    },
  },
  lexframe: {
    dbName: lexframeDbName,
    bindings,
    syncSuccessCount,
    auditCount,
  },
  verifiedBindings: verified,
  duplicateFlowGroups,
};

console.log(JSON.stringify(evidence, null, 2));

const hasVerifiedBinding = verified.some((item) => item.matches);
const hasFalseSuccess =
  syncSuccessCount > 0 &&
  !verified.some(
    (item) =>
      item.matches &&
      item.compileReportId &&
      item.runtimeHash,
  );
const hasDuplicateFlowGroups = duplicateFlowGroups.length > 0;

if (!hasVerifiedBinding || hasFalseSuccess || hasDuplicateFlowGroups) {
  console.error(
    "[stage16-activepieces-evidence] FAIL: no verified LexFrame runtime binding with matching Activepieces project, flow and flow_version.",
  );
  if (hasDuplicateFlowGroups) {
    console.error(
      `[stage16-activepieces-evidence] FAIL: duplicate LexFrame-managed Activepieces flows found: ${JSON.stringify(duplicateFlowGroups)}`,
    );
  }
  process.exit(1);
}

console.log("[stage16-activepieces-evidence] PASS");
