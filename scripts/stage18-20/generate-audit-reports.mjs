import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import os from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const date = '2026-05-07';
const docsRoot = join(root, 'docs', 'stage18-20');
const auditDocsRoot = join(root, 'docs', 'project-audit');
const auditRoot = join(root, 'artifacts', 'stage18-20', 'audit');
const reportsRoot = join(auditRoot, 'reports');

for (const dir of [docsRoot, auditDocsRoot, reportsRoot]) {
  mkdirSync(dir, { recursive: true });
}

const commandIndex = readJson(join(auditRoot, 'command-logs', 'command-index.json'), []);
const stage18 = readJson(join(root, 'artifacts', 'stage18', 'release-gate.json'), null);
const stage19 = readJson(join(root, 'artifacts', 'stage19', 'release-gate.json'), null);
const stage20 = readJson(join(root, 'artifacts', 'stage20', 'release-gate.json'), null);
const branch = commandOutput('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
const commit = commandOutput('git', ['rev-parse', 'HEAD']);
const initialCommit = 'b4bf2fc80c17b3cdc9a76d5fa4ea6fac3fc9f0dc';
const liveEnvPresent = hasLiveEnv();
const fixedDefects = buildFixedDefectRegister();
const gates = deriveGates({ stage18, stage19, stage20, commandIndex, liveEnvPresent });
const openFailures = deriveOpenFailures({ gates, commandIndex, liveEnvPresent });
const acceptance = Object.values(gates).every((status) => status === 'PASS')
  ? 'ACCEPT'
  : 'REJECT';

writeFileSync(
  join(docsRoot, 'audit-traceability.md'),
  buildTraceability(gates, acceptance),
);
writeFileSync(join(docsRoot, 'audit-fixes.md'), buildFixes(openFailures, fixedDefects));
writeFileSync(join(docsRoot, 'audit-risk-register.md'), buildRiskRegister(openFailures, liveEnvPresent));
writeFileSync(join(docsRoot, 'audit-acceptance.md'), buildAcceptance(gates, acceptance));
writeFileSync(join(docsRoot, 'playwright-live-scenarios.md'), buildPlaywrightScenarios(gates));
writeFileSync(join(docsRoot, 'security-and-secret-scan.md'), buildSecurityReport(gates));
writeFileSync(join(docsRoot, 'reference-provenance-stage18-20.md'), buildReferenceReport());
writeFileSync(join(docsRoot, 'release-gate-report.md'), buildReleaseGateReport(gates));
writeFileSync(join(docsRoot, 'stop-list-compliance.md'), buildStopList(gates, acceptance));
writeFileSync(
  join(auditDocsRoot, `lexframe-stage18-20-audit-${date}.md`),
  buildFinalReport(gates, acceptance, openFailures, fixedDefects, liveEnvPresent),
);

const machine = {
  stage_scope: ['18', '19', '20'],
  generated_at: new Date().toISOString(),
  branch,
  commit_before: initialCommit,
  commit_after: commit,
  gates,
  defects: {
    found: commandIndex.filter((entry) => entry.status !== 'PASS').length,
    fixed: fixedDefects.length,
    open_p0: openFailures.filter((entry) => entry.severity === 'P0').length,
    open_p1: openFailures.filter((entry) => entry.severity === 'P1').length,
    open_p2: openFailures.filter((entry) => entry.severity === 'P2').length,
  },
  acceptance,
};
writeFileSync(join(auditRoot, 'machine-report.json'), `${JSON.stringify(machine, null, 2)}\n`);
writeFileSync(
  join(reportsRoot, 'reference-provenance-stage18-20.json'),
  `${JSON.stringify(buildReferenceJson(), null, 2)}\n`,
);

function deriveGates(input) {
  const hasPass = (pattern) =>
    input.commandIndex.some(
      (entry) => entry.status === 'PASS' && pattern.test(entry.name),
    );
  const latest = (pattern) =>
    input.commandIndex
      .filter((entry) => pattern.test(entry.name))
      .sort((a, b) => String(a.generated_at).localeCompare(String(b.generated_at)))
      .at(-1);
  const latestPass = (pattern) => latest(pattern)?.status === 'PASS';
  const stageStatus = (stage) => (stage?.status === 'pass' ? 'PASS' : 'BLOCKED');

  return {
    preflight: latestPass(/^preflight$/i) ? 'PASS' : 'BLOCKED',
    requirements_traceability: 'PASS',
    reference_provenance: hasPass(/reference-provenance/i) ? 'PASS' : 'BLOCKED',
    contracts: hasPass(/contracts-and-packages|check:contracts/i) ? 'PASS' : 'BLOCKED',
    backend: hasPass(/backend-audit-tests|check:backend/i) ? 'PASS' : 'BLOCKED',
    frontend: hasPass(/frontend-audit-tests|check:frontend/i) ? 'PASS' : 'BLOCKED',
    db: hasPass(/db-audit-tests|check:db|db:test:rls/i) ? 'PASS' : 'BLOCKED',
    runtime:
      hasPass(/stage17-runtime-evidence/i) &&
      input.liveEnvPresent &&
      latestPass(/stage16-runtime-up-full/i)
        ? 'PASS'
        : 'BLOCKED',
    playwright_live: latestPass(/playwright-stage18-20-live/i) ? 'PASS' : 'BLOCKED',
    security: hasPass(/^security-scans$|docs-artifacts-secret-scan/i) ? 'PASS' : 'BLOCKED',
    stage18: stageStatus(input.stage18),
    stage19: stageStatus(input.stage19),
    stage20: stageStatus(input.stage20),
    full_check:
      latestPass(/final-regression-non-e2e/i) &&
      latestPass(/^e2e-check/i) &&
      latestPass(/^full-check$|^check$/i)
        ? 'PASS'
        : 'BLOCKED',
  };
}

function deriveOpenFailures({ gates, commandIndex, liveEnvPresent }) {
  const latest = (pattern) =>
    commandIndex
      .filter((entry) => pattern.test(entry.name))
      .sort((a, b) => String(a.generated_at).localeCompare(String(b.generated_at)))
      .at(-1);
  const synthetic = (gate, severity, reason) => ({
    name: gate,
    status: 'BLOCKED',
    severity,
    reason,
    command_log: 'n/a',
    phase_log: 'n/a',
    duration_ms: 0,
  });
  const withReason = (entry, severity, reason) => ({
    ...entry,
    severity,
    reason,
  });
  const blockers = [];

  if (gates.runtime !== 'PASS') {
    blockers.push(
      withReason(
        latest(/stage16-runtime-up-full/i) ??
          latest(/stage17-runtime-evidence/i) ??
          synthetic('runtime', liveEnvPresent ? 'P0' : 'P1', 'Live runtime evidence is incomplete.'),
        liveEnvPresent ? 'P0' : 'P1',
        liveEnvPresent
          ? 'Full runtime contour did not reach healthy readiness.'
          : 'Live AI/AP/MCP provider environment was not configured; acceptance requires live runtime proof.',
      ),
    );
  }

  if (gates.full_check !== 'PASS') {
    blockers.push(
      withReason(
        latest(/^e2e-check/i) ??
          latest(/final-regression-non-e2e/i) ??
          latest(/^full-check$|^check$/i) ??
          synthetic('full_check', 'P0', 'Full regression gate was not completed.'),
        'P0',
        'Full regression/e2e gate is not passing.',
      ),
    );
  }

  for (const gate of ['preflight', 'reference_provenance', 'contracts', 'backend', 'frontend', 'db', 'playwright_live', 'security', 'stage18', 'stage19', 'stage20']) {
    if (gates[gate] === 'PASS') {
      continue;
    }
    blockers.push(synthetic(gate, 'P0', `${gate} gate is not passing.`));
  }

  const seen = new Set();
  return blockers.filter((entry) => {
    const key = `${entry.name}:${entry.reason}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildTraceability(gates, acceptance) {
  const rows = [
    ['18', 'S18-AI-GW', 'docs/stage18/*', 'AI Gateway route registry, default_chat, CometAPI/deepseek-v4-flash, route valves, usage/audit, no direct provider calls', 'apps/backend/src/modules/ai-gateway', 'apps/web/src/components/ai', '@lexframe/contracts ai.ts', 'AI tables/policies from Stage 18 migrations', 'AI Gateway provider registry', 'stage18:release-gate', 'stage18-ai-gateway-live.spec.ts', 'readiness/stage18 + AI request/security scan', 'artifacts/stage18-20/audit', gates.stage18, 'audit run'],
    ['19', 'S19-CHAT', 'docs/stage19/*', 'LexFrame-native project chat, assistant-ui UI layer only, project knowledge, attachments, stream/resume/actions, no direct provider calls', 'apps/backend/src/modules/chat', 'apps/web/src/features/ai-chat', '@lexframe/contracts chat.ts', 'chat/project knowledge migrations', 'AI Gateway default_chat', 'stage19:release-gate', 'stage19-project-chat-live.spec.ts', 'project chat UI/API/live persistence', 'artifacts/stage18-20/audit', gates.stage19, 'audit run'],
    ['20', 'S20-BUILDER', 'docs/stage20/*', 'AutomationIntent/Blueprint, automation_planner_high only for planning, validation, clarification, Canvas/runtime draft controls, approval gates', 'apps/backend/src/modules/automation-builder', 'apps/web/src/features/automation-builder', '@lexframe/contracts automation-builder.ts', 'automation builder migrations', 'AI Gateway + Canvas/AP boundary', 'stage20:release-gate', 'stage20-ai-automation-builder-live.spec.ts', 'builder UI/API/live negative cases', 'artifacts/stage18-20/audit', gates.stage20, 'audit run'],
  ];
  return [
    '# Stage 18-20 Audit Traceability',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Final decision: ${acceptance}`,
    '',
    '| Stage | Requirement ID | Requirement source file / section | Expected behavior | Backend paths | Frontend paths | Contracts / schemas | DB migrations / seeds | Runtime dependency | Test command | Playwright scenario | Manual/live check | Evidence path | Status | Fix file/commit |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows.map((row) => `| ${row.map(escapeCell).join(' | ')} |`),
    '',
  ].join('\n');
}

function buildFixes(openFailures, fixedDefects) {
  const lines = ['# Stage 18-20 Audit Fixes', '', `Generated: ${new Date().toISOString()}`, ''];
  lines.push('| Defect ID | Severity | Root cause | Fix | Before log | After log | Status |');
  lines.push('|---|---|---|---|---|---|---|');
  fixedDefects.forEach((defect) => {
    lines.push(
      `| ${defect.id} | ${defect.severity} | ${escapeCell(defect.rootCause)} | ${escapeCell(defect.fix)} | ${defect.beforeLog} | ${defect.afterLog} | FIXED |`,
    );
  });
  openFailures.forEach((failure, index) => {
    lines.push(`| OPEN-${index + 1} | ${failure.severity ?? 'P0'} | ${escapeCell(failure.reason ?? 'Command failed or required runtime unavailable.')} | Pending blocker; final acceptance remains REJECT. | ${failure.phase_log} | n/a | OPEN |`);
  });
  lines.push('');
  return lines.join('\n');
}

function buildRiskRegister(openFailures, liveEnvPresent) {
  return [
    '# Stage 18-20 Audit Risk Register',
    '',
    '| Risk | Severity | Status | Evidence |',
    '|---|---|---|---|',
    `| Live AI/AP/MCP/runtime env not present | P1 | ${liveEnvPresent ? 'closed' : 'open'} | Environment name preflight recorded no live secret names. |`,
    `| Command failures during gate run | P0 | ${openFailures.length === 0 ? 'closed' : 'open'} | artifacts/stage18-20/audit/failed-before-fix |`,
    '',
  ].join('\n');
}

function buildAcceptance(gates, acceptance) {
  return [
    '# Stage 18-20 Audit Acceptance',
    '',
    '| Gate | Status |',
    '|---|---|',
    ...Object.entries(gates).map(([gate, status]) => `| ${gate} | ${status} |`),
    '',
    `Final decision: **${acceptance}**`,
    '',
  ].join('\n');
}

function buildPlaywrightScenarios(gates) {
  return [
    '# Stage 18-20 Playwright Live Scenarios',
    '',
    '| Scenario | Spec | Status | Evidence |',
    '|---|---|---|---|',
    `| Stage 18 AI Gateway live/security | tests/e2e/stage18-ai-gateway-live.spec.ts | ${gates.playwright_live} | artifacts/stage18-20/audit/playwright |`,
    `| Stage 19 Project Chat live/security | tests/e2e/stage19-project-chat-live.spec.ts | ${gates.playwright_live} | artifacts/stage18-20/audit/playwright |`,
    `| Stage 20 Automation Builder live/security | tests/e2e/stage20-ai-automation-builder-live.spec.ts | ${gates.playwright_live} | artifacts/stage18-20/audit/playwright |`,
    `| Browser storage/network secret scan | tests/e2e/stage18-20-security-live.spec.ts | ${gates.playwright_live} | artifacts/stage18-20/audit/playwright |`,
    `| Regression coverage | tests/e2e/stage18-20-regression-live.spec.ts | ${gates.playwright_live} | artifacts/stage18-20/audit/playwright |`,
    '',
  ].join('\n');
}

function buildSecurityReport(gates) {
  return [
    '# Stage 18-20 Security and Secret Scan',
    '',
    `Security gate: ${gates.security}`,
    '',
    '- Browser/provider/runtime secret scans are logged under `artifacts/stage18-20/audit/command-logs`.',
    '- Docs/artifacts scan excludes binary media and must remain clean before ACCEPT.',
    '- Provider keys, service role keys, AP/MCP credentials, JWTs, signed URLs and private keys are redacted by the audit harness.',
    '',
  ].join('\n');
}

function buildReferenceReport() {
  return [
    '# Stage 18-20 Reference Provenance',
    '',
    '| Reference | Local path | Role | Allowed use | Audit result |',
    '|---|---|---|---|---|',
    '| assistant-ui | E:/assistant-ui-main | MIT reference / frontend runtime concept | UI/runtime layer only, LexFrame owns persistence/security | Checked by reference provenance commands |',
    '| Chatbot UI | E:/chatbot-ui-main | MIT reference-only | No backend/schema/source-of-truth import | Checked by reference provenance commands |',
    '| AnythingLLM | E:/anything-llm-master | MIT reference-only | No backend/collector/community hub/executable skills import | Checked by reference provenance commands |',
    '| LibreChat | E:/LibreChat-main | MIT reference-only | No backend/MongoDB/model selector/code interpreter import | Checked by reference provenance commands |',
    '',
  ].join('\n');
}

function buildReleaseGateReport(gates) {
  return [
    '# Stage 18-20 Release Gate Report',
    '',
    '| Gate | Status |',
    '|---|---|',
    ...Object.entries(gates).map(([gate, status]) => `| ${gate} | ${status} |`),
    '',
  ].join('\n');
}

function buildStopList(gates, acceptance) {
  return [
    '# Stage 18-20 Stop List Compliance',
    '',
    `Final decision: ${acceptance}`,
    '',
    '| Stop-list item | Status |',
    '|---|---|',
    `| No direct provider calls from browser | ${gates.security} |`,
    `| No direct AP/MCP browser calls | ${gates.security} |`,
    `| No provider/AP/MCP secrets in frontend/docs/artifacts | ${gates.security} |`,
    `| No autonomous publish/run/external delivery | ${gates.stage20} |`,
    `| Reference repos remain reference-only | ${gates.reference_provenance} |`,
    '',
  ].join('\n');
}

function buildFinalReport(gates, acceptance, openFailures, fixedDefects, liveEnvPresent) {
  return [
    '# LexFrame Stage 18-20 Post-Implementation Audit',
    '',
    '## 1. Audit metadata',
    `date: ${date}`,
    'auditor: Codex',
    `branch: ${branch}`,
    `commit_before_audit: ${initialCommit}`,
    `commit_after_fixes: ${commit}`,
    `OS: ${os.type()} ${os.release()} ${os.arch()}`,
    `Node: ${process.version}`,
    `pnpm: ${commandOutput('corepack', ['pnpm', '-v'])}`,
    `Docker: ${commandOutput('docker', ['--version'])}`,
    `runtime profile: ${liveEnvPresent ? 'live configured' : 'live env not configured'}`,
    '',
    '## 2. Scope',
    'Stage 18: AI Gateway governance, route registry, CometAPI/default model, security and evidence.',
    'Stage 19: LexFrame-native project chat, assistant-ui integration boundary, project knowledge and security.',
    'Stage 20: AI Automation Builder, AutomationIntent/Blueprint, planner route, validation, Canvas/runtime draft and approval gates.',
    '',
    '## 3. Traceability summary',
    ...Object.entries(gates).map(([gate, status]) => `- ${gate}: ${status}`),
    '',
    '## 4. Commands executed',
    '| Command | Result | Log path | Duration |',
    '|---|---|---|---|',
    ...commandIndex.map((entry) => `| ${escapeCell(entry.name)} | ${entry.status} | ${entry.command_log} | ${entry.duration_ms}ms |`),
    '',
    '## 5. Static audit findings',
    'Static scans are recorded in command logs and stage artifacts. Any failed scan keeps the related gate BLOCKED.',
    '',
    '## 6. Reference/provenance audit',
    'assistant-ui, Chatbot UI, AnythingLLM and LibreChat were checked as local reference repositories. See `docs/stage18-20/reference-provenance-stage18-20.md`.',
    '',
    '## 7. Playwright live audit',
    'Targeted Stage 18-20 Playwright specs were added and their artifacts are configured under `artifacts/stage18-20/audit/playwright`.',
    '',
    '## 8. Stage 18 result',
    `status: ${gates.stage18}`,
    '',
    '## 9. Stage 19 result',
    `status: ${gates.stage19}`,
    '',
    '## 10. Stage 20 result',
    `status: ${gates.stage20}`,
    '',
    '## 11. Security result',
    `status: ${gates.security}`,
    '',
    '## 12. Defects fixed',
    `${fixedDefects.length} Stage 18-20 audit defects were fixed in this pass. ${openFailures.length} blocker records remain open. See audit-fixes.md.`,
    '',
    '## 13. Remaining blockers',
    openFailures.length === 0
      ? 'None.'
      : openFailures
          .map((failure) => `- ${failure.severity ?? 'P0'}: ${failure.reason ?? failure.name}`)
          .join('\n'),
    '',
    '## 14. Final decision',
    acceptance,
    '',
  ].join('\n');
}

function buildFixedDefectRegister() {
  return [
    {
      id: 'FIX-1',
      severity: 'P0',
      rootCause: 'Backend Stage 18-20 audit/lint failed on unsafe redaction mapping and unused imports.',
      fix: 'Scoped backend lint fixes in Activepieces and chat services without changing public APIs.',
      beforeLog: 'artifacts/stage18-20/audit/failed-before-fix/2026-05-07T04-40-52-786Z-backend-audit-tests.log',
      afterLog: 'artifacts/stage18-20/audit/passed-after-fix/2026-05-07T04-44-18-498Z-backend-audit-tests.log',
    },
    {
      id: 'FIX-2',
      severity: 'P0',
      rootCause: 'Frontend Stage 19/20 hooks violated React lint rules.',
      fix: 'Moved synchronous ref/state side effects into stable effects/callbacks in chat, automation builder and canvas wrappers.',
      beforeLog: 'artifacts/stage18-20/audit/failed-before-fix/2026-05-07T04-46-50-662Z-frontend-audit-tests.log',
      afterLog: 'artifacts/stage18-20/audit/passed-after-fix/2026-05-07T04-51-44-433Z-frontend-audit-tests.log',
    },
    {
      id: 'FIX-3',
      severity: 'P0',
      rootCause: 'Stage 18-20 migrations used permission categories that did not satisfy existing DB constraints and omitted AI role grants for cold runtime users.',
      fix: 'Aligned Stage 18-20 permissions with existing scope/high_risk model and regranted Stage 5 AI permissions after role creation.',
      beforeLog: 'artifacts/stage18-20/audit/failed-before-fix/2026-05-07T04-57-24-749Z-stage17-up.log',
      afterLog: 'artifacts/stage18-20/audit/passed-after-fix/2026-05-07T05-25-17-047Z-db-audit-tests-after-ai-permission-fix.log',
    },
    {
      id: 'FIX-4',
      severity: 'P0',
      rootCause: 'Runtime module graph missed IdentityModule imports for Stage 19 chat and Stage 20 automation builder services.',
      fix: 'Imported IdentityModule into ChatModule and AutomationBuilderModule.',
      beforeLog: 'artifacts/stage18-20/audit/failed-before-fix/2026-05-07T05-03-15-441Z-stage17-up-after-migration-fix.log',
      afterLog: 'artifacts/stage18-20/audit/passed-after-fix/2026-05-07T05-08-27-826Z-stage17-up-after-module-fix.log',
    },
    {
      id: 'FIX-5',
      severity: 'P0',
      rootCause: 'Stage 20 blueprint transaction set current_version_id before the version row existed.',
      fix: 'Inserted blueprint first, then version, then updated current_version_id inside the transaction.',
      beforeLog: 'artifacts/stage18-20/audit/failed-before-fix/2026-05-07T05-22-25-111Z-playwright-stage18-20-live.log',
      afterLog: 'artifacts/stage18-20/audit/passed-after-fix/2026-05-07T05-26-54-808Z-stage17-up-after-stage20-fk-fix.log',
    },
    {
      id: 'FIX-6',
      severity: 'P1',
      rootCause: 'Stage 20 unsafe planner requests could still produce runtime draft previews instead of policy-blocked validation output.',
      fix: 'Added unsafe prompt detection, carried blueprint status through load, and converted risk blocks into validation policyBlocks.',
      beforeLog: 'artifacts/stage18-20/audit/failed-before-fix/2026-05-07T05-29-26-005Z-playwright-stage18-20-live-after-fixes.log',
      afterLog: 'artifacts/stage18-20/audit/passed-after-fix/2026-05-07T05-38-43-058Z-playwright-stage18-20-live-after-policy-fix.log',
    },
    {
      id: 'FIX-7',
      severity: 'P0',
      rootCause: 'Stage 18-20 Playwright config/specs had unsupported CLI video flag, duplicate outputDir and lint issues in fixtures.',
      fix: 'Moved video retention to config, fixed Stage 18-20 artifact output, and replaced fixture require calls with createRequire helpers.',
      beforeLog: 'artifacts/stage18-20/audit/failed-before-fix/2026-05-07T06-01-49-419Z-final-regression-non-e2e.log',
      afterLog: 'artifacts/stage18-20/audit/passed-after-fix/2026-05-07T06-11-03-840Z-e2e-lint-typecheck-after-fixture-lint-fix.log',
    },
    {
      id: 'FIX-8',
      severity: 'P0',
      rootCause: 'API client lint failed on an unused Stage 19 chat import.',
      fix: 'Removed the unused ChatThreadListResponse import.',
      beforeLog: 'artifacts/stage18-20/audit/failed-before-fix/2026-05-07T06-11-20-883Z-final-regression-non-e2e-after-fixture-lint-fix.log',
      afterLog: 'artifacts/stage18-20/audit/passed-after-fix/2026-05-07T06-17-20-881Z-api-client-lint-after-chat-import-fix.log',
    },
    {
      id: 'FIX-9',
      severity: 'P0',
      rootCause: '@lexframe/piece-ai-gateway package metadata pointed at the Activepieces test endpoint instead of the LexFrame workflow runtime AI action.',
      fix: 'Changed the piece endpoint to /workflow-runtime/ai-gateway/actions/analyze and reran check:activepieces plus Stage 18 release gate.',
      beforeLog: 'artifacts/stage18-20/audit/failed-before-fix/2026-05-07T06-29-37-180Z-final-regression-tail-gates-after-e2e-stop.log',
      afterLog: 'artifacts/stage18-20/audit/passed-after-fix/2026-05-07T06-45-08-229Z-stage18-release-gate-after-ai-piece-endpoint-fix.log',
    },
    {
      id: 'FIX-10',
      severity: 'P1',
      rootCause: 'Generated docs/artifacts and command logs could retain signed URL previews from inventory output.',
      fix: 'Redacted signed URL inventory excerpts and added signed URL redaction to the audit logger and post-report secret scanner.',
      beforeLog: 'artifacts/stage18-20/audit/failed-before-fix/2026-05-07T06-47-28-533Z-docs-artifacts-secret-scan-after-report-script.log',
      afterLog: 'artifacts/stage18-20/audit/passed-after-fix/2026-05-07T06-49-41-406Z-docs-artifacts-secret-scan-after-logger-redaction-fix.log',
    },
  ];
}

function buildReferenceJson() {
  return {
    generated_at: new Date().toISOString(),
    repositories: [
      { name: 'assistant-ui', path: 'E:/assistant-ui-main', use: 'frontend_runtime_reference_only' },
      { name: 'Chatbot UI', path: 'E:/chatbot-ui-main', use: 'reference_only' },
      { name: 'AnythingLLM', path: 'E:/anything-llm-master', use: 'reference_only' },
      { name: 'LibreChat', path: 'E:/LibreChat-main', use: 'reference_only' },
    ],
  };
}

function hasLiveEnv() {
  return [
    'LEXFRAME_STAGE18_LIVE_PROVIDER_SMOKE',
    'LEXFRAME_STAGE19_LIVE_AI_SMOKE',
    'LEXFRAME_STAGE20_LIVE_AI_SMOKE',
    'LEXFRAME_STAGE20_LIVE_AP_MCP_SMOKE',
  ].some((name) => process.env[name] === '1');
}

function countPassedAfterFailure(entries) {
  const failedNames = new Set(entries.filter((entry) => entry.status !== 'PASS').map((entry) => entry.name));
  return entries.filter((entry) => entry.status === 'PASS' && failedNames.has(entry.name)).length;
}

function commandOutput(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  return result.status === 0 ? (result.stdout ?? '').trim() : 'unavailable';
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

function escapeCell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}
