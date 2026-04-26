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

if (!hasVerifiedBinding || hasFalseSuccess) {
  console.error(
    "[stage16-activepieces-evidence] FAIL: no verified LexFrame runtime binding with matching Activepieces project, flow and flow_version.",
  );
  process.exit(1);
}

console.log("[stage16-activepieces-evidence] PASS");
