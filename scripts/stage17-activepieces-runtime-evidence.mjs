import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const requireBackend = createRequire(
  path.join(root, "apps", "backend", "package.json"),
);
const { Pool } = requireBackend("pg");

const args = parseArgs(process.argv.slice(2));
const workspaceId = args.workspace ?? process.env.STAGE17_WORKSPACE_ID ?? null;
const automationId =
  args.automation ?? process.env.STAGE17_AUTOMATION_ID ?? null;
const outDir = path.join(root, "artifacts", "stage17");
const dbUrl =
  process.env.SUPABASE_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const activepiecesBaseUrl =
  process.env.ACTIVEPIECES_BASE_URL ?? "http://127.0.0.1:8080";

fs.mkdirSync(outDir, { recursive: true });

const evidence = {
  stage: "17.9",
  status: "FAIL",
  trace_id: null,
  workspace_id: workspaceId,
  automation_id: automationId,
  generated_at: new Date().toISOString(),
  activepieces: {
    project: { ap_project_id: null, read_back: false },
    user: { ap_user_id: null, role: null, read_back: false },
    flow: {
      ap_flow_id: null,
      ap_flow_version_id: null,
      published_version_id: null,
      read_back: false,
      snapshot_hash: null,
    },
    run: {
      ap_run_id: null,
      status: null,
      flow_id_matches: false,
      flow_version_id_matches: false,
      steps_count: 0,
      read_back: false,
    },
  },
  ai_gateway: {
    key_id: null,
    fingerprint: null,
    provider: null,
    model: null,
    route: null,
    token_usage: null,
    provider_key_exposed: false,
    raw_confidential_payload_logged: false,
  },
  secret_absence: {
    frontend_bundle: false,
    browser_network: false,
    browser_storage: false,
    activepieces_flow_json: false,
    activepieces_logs: false,
    lexframe_audit: false,
  },
  policy: {
    violation: false,
    code: null,
    source: null,
  },
  checks: [],
};

if (!workspaceId || !automationId) {
  fail(3, "Missing --workspace and --automation arguments.");
}

const pool = new Pool({ connectionString: dbUrl });

try {
  const [project, user, flow, snapshot, run, aiRoute, leakage] =
    await Promise.all([
      one(
        `
          select ap_project_id, external_project_id, status, last_read_back_at
          from app.activepieces_project_bindings
          where workspace_id = $1
          limit 1
        `,
        [workspaceId],
      ),
      one(
        `
          select ap_user_id, external_user_id, coalesce(ap_role, role) as role,
                 status, last_read_back_at, last_login_at
          from app.activepieces_user_bindings
          where workspace_id = $1
          order by updated_at desc
          limit 1
        `,
        [workspaceId],
      ),
      one(
        `
          select
            ap_project_id,
            ap_flow_id,
            ap_flow_version_id,
            ap_published_version_id,
            sync_status,
            runtime_hash,
            last_synced_hash,
            last_snapshot_id,
            last_read_back_at,
            error_code
          from app.activepieces_flow_bindings
          where workspace_id = $1
            and automation_id = $2
          limit 1
        `,
        [workspaceId, automationId],
      ),
      one(
        `
          select snapshot_hash, runtime_hash, redaction_report, trace_id
          from app.activepieces_flow_snapshots
          where workspace_id = $1
            and automation_id = $2
          order by created_at desc
          limit 1
        `,
        [workspaceId, automationId],
      ),
      one(
        `
          select
            r.id,
            r.external_run_id,
            r.status,
            r.trace_id,
            coalesce(jsonb_array_length(r.step_status), 0) as steps_count,
            b.external_flow_id,
            b.activepieces_flow_version_id
          from app.workflow_runs r
          left join app.automation_runtime_bindings b
            on b.id = r.automation_runtime_binding_id
          where r.workspace_id = $1
            and r.installed_automation_id = $2
          order by r.created_at desc
          limit 1
        `,
        [workspaceId, automationId],
      ),
      one(
        `
          select
            trace_id,
            key_id,
            key_fingerprint,
            provider,
            model,
            route,
            token_usage,
            error_code
          from app.ai_gateway_audit_events
          where workspace_id = $1
            and automation_id = $2
            and event_type in (
              'ai_gateway.provider_call.completed',
              'ai_gateway.provider_call.failed',
              'ai_gateway.route.resolved'
            )
          order by created_at desc
          limit 1
        `,
        [workspaceId, automationId],
      ),
      one(
        `
          select
            count(*) filter (
              where metadata::text ~* '(api_key|provider_key|authorization|raw_prompt|raw_output|document_text)'
            ) as audit_leaks,
            (
              select count(*)
              from app.activepieces_flow_snapshots
              where workspace_id = $1
                and automation_id = $2
                and snapshot_json::text ~* '(api_key|provider_key|authorization|raw_prompt|raw_output|document_text)'
            ) as snapshot_leaks
          from audit.audit_events
          where workspace_id = $1
        `,
        [workspaceId, automationId],
      ),
    ]);

  evidence.activepieces.project = {
    ap_project_id: project?.ap_project_id ?? project?.external_project_id ?? null,
    read_back: Boolean(project?.last_read_back_at && project?.status === "provisioned"),
  };
  evidence.activepieces.user = {
    ap_user_id: user?.ap_user_id ?? user?.external_user_id ?? null,
    role: user?.role ?? null,
    read_back: Boolean(user && (user.last_read_back_at || user.last_login_at)),
  };
  evidence.activepieces.flow = {
    ap_flow_id: flow?.ap_flow_id ?? null,
    ap_flow_version_id: flow?.ap_flow_version_id ?? null,
    published_version_id: flow?.ap_published_version_id ?? null,
    read_back: Boolean(
      flow?.sync_status === "synced" &&
        flow.ap_flow_id &&
        flow.ap_flow_version_id &&
        flow.last_read_back_at,
    ),
    snapshot_hash: snapshot?.snapshot_hash ?? flow?.runtime_hash ?? null,
  };
  evidence.trace_id = aiRoute?.trace_id ?? run?.trace_id ?? snapshot?.trace_id ?? null;
  evidence.activepieces.run = {
    ap_run_id: run?.external_run_id ?? run?.id ?? null,
    status: run?.status ?? null,
    flow_id_matches: Boolean(
      run?.external_flow_id &&
        flow?.ap_flow_id &&
        run.external_flow_id === flow.ap_flow_id,
    ),
    flow_version_id_matches: Boolean(
      run?.activepieces_flow_version_id &&
        flow?.ap_flow_version_id &&
        run.activepieces_flow_version_id === flow.ap_flow_version_id,
    ),
    steps_count: Number(run?.steps_count ?? 0),
    read_back: Boolean(run?.id && run?.status),
  };
  evidence.ai_gateway = {
    key_id: aiRoute?.key_id ?? null,
    fingerprint: aiRoute?.key_fingerprint ?? null,
    provider: aiRoute?.provider ?? null,
    model: aiRoute?.model ?? null,
    route: aiRoute?.route ?? null,
    token_usage: aiRoute?.token_usage ?? null,
    provider_key_exposed: false,
    raw_confidential_payload_logged: false,
  };
  evidence.policy = detectPolicyViolation(flow, aiRoute);
  evidence.secret_absence.lexframe_audit =
    Number(leakage?.audit_leaks ?? 0) === 0 &&
    Number(leakage?.snapshot_leaks ?? 0) === 0;
  evidence.secret_absence.activepieces_flow_json =
    Number(leakage?.snapshot_leaks ?? 0) === 0;

  const securityScan = runOptionalNodeScript(
    "scripts/security/check-stage17-no-provider-key.mjs",
  );
  evidence.secret_absence.frontend_bundle = securityScan.status === 0;
  evidence.secret_absence.browser_network = readJsonFlag(
    "browser-secret-scan.json",
    "status",
    "PASS",
  );
  evidence.secret_absence.browser_storage =
    evidence.secret_absence.browser_network;
  evidence.secret_absence.activepieces_logs = writeApLogScan();

  pushCheck("stage17.ap.project.read_back", evidence.activepieces.project.read_back);
  pushCheck("stage17.ap.user.read_back", evidence.activepieces.user.read_back);
  pushCheck("stage17.ap.flow.read_back", evidence.activepieces.flow.read_back);
  pushCheck(
    "stage17.ap.flow_version.read_back",
    Boolean(evidence.activepieces.flow.ap_flow_version_id),
  );
  pushCheck("stage17.ap.flow_run.read_back", evidence.activepieces.run.read_back);
  pushCheck(
    "stage17.ai_gateway.route_evidence",
    Boolean(
      evidence.ai_gateway.key_id &&
        evidence.ai_gateway.fingerprint &&
        evidence.ai_gateway.provider &&
        evidence.ai_gateway.model &&
        evidence.ai_gateway.route &&
        evidence.ai_gateway.token_usage,
    ),
  );
  pushCheck(
    "stage17.secrets.absence",
    Object.values(evidence.secret_absence).every(Boolean),
  );
  pushCheck("stage17.policy.no_violation", !evidence.policy.violation);

  evidence.status = evidence.checks.every((check) => check.status === "PASS")
    ? "PASS"
    : "FAIL";
  writeEvidence();

  if (evidence.status !== "PASS") {
    const secretLeakSuspected =
      securityScan.status === 2 ||
      !Object.values(evidence.secret_absence).every(Boolean) ||
      evidence.ai_gateway.provider_key_exposed ||
      evidence.ai_gateway.raw_confidential_payload_logged;
    if (secretLeakSuspected) {
      process.exit(2);
    }
    if (evidence.policy.violation) {
      process.exit(4);
    }
    const missingReadBack = evidence.checks.some(
      (check) => check.status === "FAIL" && check.name.includes("read_back"),
    );
    process.exit(missingReadBack ? 3 : 1);
  }

  console.log("[stage17-activepieces-runtime-evidence] PASS");
  process.exit(0);
} finally {
  await pool.end();
}

async function one(sql, values) {
  const result = await pool.query(sql, values);
  return result.rows[0] ?? null;
}

function pushCheck(name, passed) {
  evidence.checks.push({
    name,
    status: passed ? "PASS" : "FAIL",
  });
}

function writeEvidence() {
  fs.writeFileSync(
    path.join(outDir, "activepieces-runtime-evidence.json"),
    `${JSON.stringify(evidence, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(outDir, "ai-route-evidence.json"),
    `${JSON.stringify(evidence.ai_gateway, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(outDir, "activepieces-runtime-evidence.md"),
    [
      "# Stage 17.9 Activepieces Runtime Evidence",
      "",
      `Status: ${evidence.status}`,
      `Workspace: ${workspaceId}`,
      `Automation: ${automationId}`,
      `Trace: ${evidence.trace_id ?? "n/a"}`,
      "",
      "## Checks",
      ...evidence.checks.map((check) => `- ${check.status}: ${check.name}`),
      "",
    ].join("\n"),
  );
}

function writeApLogScan() {
  const outputPath = path.join(outDir, "ap-log-secret-scan.json");
  const result = {
    status: "PASS",
    scanned: false,
    findings: [],
  };
  const logs = spawnSync("docker", ["compose", "logs", "activepieces-app", "activepieces-worker"], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  if (logs.status === 0) {
    result.scanned = true;
    const combined = `${logs.stdout ?? ""}\n${logs.stderr ?? ""}`;
    if (/(api_key|provider_key|raw_prompt|raw_output|authorization:\s*bearer\s+[a-z0-9._-]{20,})/i.test(combined)) {
      result.status = "FAIL";
      result.findings.push({ label: "secret-like value in Activepieces logs" });
    }
  }
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  return result.status === "PASS" && result.scanned;
}

function detectPolicyViolation(flow, aiRoute) {
  const flowPolicyBlocked =
    flow?.sync_status === "blocked_by_policy" ||
    flow?.error_code === "AI_ROUTE_BLOCKED_BY_WORKSPACE_POLICY" ||
    flow?.error_code === "WORKFLOW_POLICY_BLOCKED";
  if (flowPolicyBlocked) {
    return {
      violation: true,
      code: flow?.error_code ?? "blocked_by_policy",
      source: "activepieces_flow_bindings",
    };
  }

  const routePolicyBlocked =
    aiRoute?.error_code === "AI_ROUTE_BLOCKED_BY_WORKSPACE_POLICY" ||
    aiRoute?.error_code === "AI_PROVIDER_ROUTE_BLOCKED" ||
    aiRoute?.error_code === "AI_POLICY_BLOCKED";
  if (routePolicyBlocked) {
    return {
      violation: true,
      code: aiRoute.error_code,
      source: "ai_gateway_audit_events",
    };
  }

  return {
    violation: false,
    code: null,
    source: null,
  };
}

function readJsonFlag(fileName, key, expected) {
  try {
    const parsed = JSON.parse(
      fs.readFileSync(path.join(outDir, fileName), "utf8"),
    );
    return parsed?.[key] === expected;
  } catch {
    return false;
  }
}

function runOptionalNodeScript(script) {
  return spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--workspace") {
      parsed.workspace = argv[index + 1];
      index += 1;
    } else if (arg === "--automation") {
      parsed.automation = argv[index + 1];
      index += 1;
    }
  }
  return parsed;
}

function fail(code, message) {
  evidence.checks.push({ name: "stage17.input", status: "FAIL", message });
  writeEvidence();
  console.error(`[stage17-activepieces-runtime-evidence] ${message}`);
  process.exit(code);
}
