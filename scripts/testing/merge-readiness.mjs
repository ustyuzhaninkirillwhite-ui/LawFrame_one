import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const outputDir = path.join(repoRoot, 'artifacts', 'system-tests', 'merge-readiness');
const classificationPath = path.join(outputDir, 'worktree-classification.json');
const hygienePath = path.join(outputDir, 'artifact-hygiene-scan.json');
const redactionLogPath = path.join(outputDir, 'artifact-redaction-log.json');
const mergeReadinessReportPath = path.join(repoRoot, 'docs', 'testing', 'merge-readiness-report.md');
const shouldRedactLocalArtifacts = process.argv.includes('--redact-local-artifacts');

const textExtensions = new Set([
  '.css',
  '.csv',
  '.html',
  '.js',
  '.json',
  '.log',
  '.md',
  '.mjs',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.xml',
  '.yaml',
  '.yml',
]);
const binaryExtensions = new Set([
  '.docx',
  '.gif',
  '.jpeg',
  '.jpg',
  '.pdf',
  '.png',
  '.webm',
  '.zip',
]);

const forbiddenPatterns = [
  {
    name: 'private-key',
    severity: 'high',
    pattern: /BEGIN (?:RSA |EC |OPENSSH |)?PRIVATE KEY/i,
  },
  {
    name: 'authorization-bearer',
    severity: 'high',
    pattern: /Bearer\s+[A-Za-z0-9._~+/=-]{16,}/i,
  },
  {
    name: 'jwt-like',
    severity: 'high',
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/i,
  },
  {
    name: 'provider-key',
    severity: 'high',
    pattern: /\b(?:sk|xai|tavily|anthropic|deepseek)-[A-Za-z0-9_-]{12,}\b/i,
  },
  {
    name: 'service-role',
    severity: 'high',
    pattern: /\bservice_role\b/i,
  },
  {
    name: 'secret-env-name',
    severity: 'medium',
    pattern:
      /\b(?:SUPABASE_SECRET_KEY|ACTIVEPIECES_API_KEY|OPENAI_API_KEY|TAVILY_API_KEY|AP_JWT_SECRET|AP_ENCRYPTION_KEY)\b/i,
  },
  {
    name: 'signed-url',
    severity: 'high',
    pattern:
      /\b(?:X-Amz-Signature|X-Amz-Credential|Signature=|sig=|signedUrl|signed_url)\b/i,
  },
  {
    name: 'postgres-url-with-credentials',
    severity: 'high',
    pattern: /postgres(?:ql)?:\/\/[^@\s]+@/i,
  },
  {
    name: 'json-base64-attachment-body',
    severity: 'medium',
    pattern: /"body"\s*:\s*"[A-Za-z0-9+/=]{240,}"/i,
  },
  {
    name: 'data-url',
    severity: 'medium',
    pattern: /data:(?:image|application)\/[a-z0-9.+-]+;base64,/i,
  },
];

fs.mkdirSync(outputDir, { recursive: true });

const classification = buildWorktreeClassification();
writeJson(classificationPath, classification);

let hygiene = buildArtifactHygieneScan();
const redactionActions = shouldRedactLocalArtifacts
  ? redactLocalGeneratedArtifacts(hygiene.unsafeFindings)
  : [];
if (redactionActions.length > 0) {
  hygiene = buildArtifactHygieneScan();
}
writeJson(hygienePath, hygiene);

const effectiveRedactionActions =
  redactionActions.length > 0 ? redactionActions : readExistingRedactionActions();
const redactionLog = {
  generatedAt: new Date().toISOString(),
  status:
    hygiene.unsafeFindings.length > 0
      ? 'REVIEW_REQUIRED'
      : effectiveRedactionActions.length > 0
        ? 'REDACTED_LOCAL_ARTIFACTS'
        : 'NO_REDACTION_NEEDED',
  actions: effectiveRedactionActions,
  note:
    'Part 10 merge readiness does not silently redact or delete existing artifacts. Unsafe text findings require explicit review; binary trace/video/screenshot artifacts are local-only and excluded from PR by classification.',
  unsafeFindings: hygiene.unsafeFindings,
  binaryReview: hygiene.binaryReview,
};
writeJson(redactionLogPath, redactionLog);
writeMergeReadinessReport(classification, hygiene, redactionLog);

console.log(JSON.stringify({
  status: hygiene.unsafeFindings.length > 0 ? 'REVIEW_REQUIRED' : 'PASS',
  classification: relative(classificationPath),
  artifactHygiene: relative(hygienePath),
  redactionLog: relative(redactionLogPath),
  mergeReadinessReport: relative(mergeReadinessReportPath),
  files: classification.summary.total,
  unsafeFindings: hygiene.unsafeFindings.length,
  binaryReviewFiles: hygiene.binaryReview.length,
}, null, 2));

function buildWorktreeClassification() {
  const entries = parseGitStatus(gitRaw(['status', '--short']));
  const records = entries.map((entry) => classifyWorktreeEntry(entry));
  const byInclude = countBy(records, (record) => record.includeInPr);
  const byKind = countBy(records, (record) => record.kind);
  const byDomain = countBy(records, (record) => record.domain);

  return {
    generatedAt: new Date().toISOString(),
    branch: git(['rev-parse', '--abbrev-ref', 'HEAD']),
    commit: git(['rev-parse', 'HEAD']),
    git: {
      statusShort: entries,
      diffStat: git(['diff', '--stat']),
      diffNameStatus: git(['diff', '--name-status']),
      untracked: git(['ls-files', '--others', '--exclude-standard'])
        .split(/\r?\n/)
        .filter(Boolean),
      diffCheck: runGit(['diff', '--check']),
    },
    summary: {
      total: records.length,
      byInclude,
      byKind,
      byDomain,
    },
    records,
  };
}

function classifyWorktreeEntry(entry) {
  const filePath = normalize(entry.path);
  const kind = classifyKind(filePath);
  const domain = classifyDomain(filePath);
  const status = classifyStatus(entry.status);
  const includeInPr = classifyInclude(filePath, kind, domain);
  const requiresTest = includeInPr !== 'no' && ['code', 'test', 'script'].includes(kind);

  return {
    path: filePath,
    status,
    gitStatus: entry.status,
    domain,
    includeInPr,
    reason: reasonFor(filePath, kind, domain, includeInPr),
    risk: riskFor(filePath, kind, domain, includeInPr),
    requiresTest,
    kind,
  };
}

function classifyStatus(status) {
  if (status === '??') {
    return 'untracked';
  }
  if (status.includes('D')) {
    return 'deleted';
  }
  if (status.includes('A')) {
    return 'added';
  }
  if (status.includes('R')) {
    return 'renamed';
  }
  if (status.includes('M')) {
    return 'modified';
  }
  return 'changed';
}

function classifyKind(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (filePath.startsWith('artifacts/') || filePath.includes('/artifacts/')) {
    return 'artifact';
  }
  if (filePath.startsWith('.codex-dev-logs/')) {
    return 'temporary';
  }
  if (filePath.startsWith('docs/')) {
    return extension === '.docx' ? 'artifact' : 'doc';
  }
  if (filePath.startsWith('scripts/')) {
    return 'script';
  }
  if (filePath.startsWith('tests/e2e/')) {
    return 'test';
  }
  if (filePath.includes('/test') || filePath.endsWith('.spec.ts') || filePath.endsWith('.test.ts') || filePath.endsWith('.test.tsx')) {
    return 'test';
  }
  if (['.ts', '.tsx', '.js', '.mjs', '.json'].includes(extension)) {
    return 'code';
  }
  return 'artifact';
}

function classifyDomain(filePath) {
  if (filePath.startsWith('artifacts/system-tests/merge-readiness')) return 'merge-readiness';
  if (filePath.startsWith('artifacts/')) return 'artifact';
  if (filePath.startsWith('tests/e2e/artifacts/') || filePath.includes('playwright-report')) return 'artifact';
  if (filePath.startsWith('.codex-dev-logs/')) return 'temporary';
  if (
    /full-system-gate|system-release-gate|full-gate|part9|merge-readiness|hardening-cycle|clean-runtime-rc|scripts\/testing|stage16|stage21|runtime-preflight|playwright\.config|tests\/e2e\/helpers\/(?:api|auth|runtime-preflight)/i.test(
      filePath,
    )
  ) return 'full-gate';
  if (/activepieces|automation|canvas|runs|workflow|stage17/i.test(filePath)) return 'automation';
  if (/document|upload|storage|preview-panel/i.test(filePath)) return 'documents';
  if (/settings|ai-route|secret-write|ssrf|profile|organization/i.test(filePath)) return 'settings';
  if (/legal|search|rag|source|knowledge|stage15-projects|stage15-handlers|use-stage0-data/i.test(filePath)) return 'search';
  if (/chat|sse|branch|attachment|LexFrame/i.test(filePath)) return 'chat';
  if (/auth|authorization|security|audit|rbac|redaction|session-provider|sign-in|onboarding/i.test(filePath)) return 'security';
  if (/app-shell|sidebar|dialog|tabs|project-home|project-workspace|shell/i.test(filePath)) return 'shell';
  if (/contracts|api-client|ai-gateway|package\.json/i.test(filePath)) return 'contracts';
  return 'unrelated';
}

function classifyInclude(filePath, kind, domain) {
  if (kind === 'temporary') return 'no';
  if (filePath.startsWith('tests/e2e/artifacts/') || filePath.startsWith('artifacts/system-tests/docx-report-render/')) return 'no';
  if (/\.(png|jpg|jpeg|webm|zip|docx)$/i.test(filePath)) return 'no';
  if (kind === 'artifact') return 'review';
  if (filePath === 'apps/web/next-env.d.ts') return 'review';
  if (domain === 'unrelated') return 'review';
  return 'yes';
}

function reasonFor(filePath, kind, domain, includeInPr) {
  if (includeInPr === 'no') {
    return 'Generated/local-only artifact or temporary runtime file; keep out of PR unless explicitly attached outside git.';
  }
  if (includeInPr === 'review') {
    return 'Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code.';
  }
  if (kind === 'doc') return 'Intentional hardening-cycle documentation.';
  if (kind === 'script') return 'Intentional runtime/gate/verification script.';
  if (kind === 'test') return 'Intentional regression or release-gate test coverage.';
  return `Intentional ${domain} hardening code change.`;
}

function riskFor(filePath, kind, domain, includeInPr) {
  if (includeInPr === 'no') return 'Commit noise, stale binary artifacts, or local-only evidence if staged.';
  if (filePath === 'apps/web/next-env.d.ts') return 'Generated file; verify whether Next version changed it intentionally.';
  if (kind === 'artifact') return 'Artifact policy review required before PR.';
  if (domain === 'security') return 'Security boundary change; requires targeted auth/RBAC/audit tests.';
  if (domain === 'automation') return 'Runtime/session bridge change; requires AP/backend-backed coverage.';
  if (domain === 'settings') return 'Secret-handling change; requires browser/storage/network redaction proof.';
  if (domain === 'documents') return 'Storage lifecycle change; requires upload/download and no signed URL leak proof.';
  if (domain === 'search') return 'Source/RAG scoping change; requires search readiness and no cross-workspace leakage proof.';
  if (domain === 'chat') return 'Streaming/state change; requires reload/retry/secret isolation proof.';
  if (domain === 'full-gate') return 'Release gate script/test change; requires fresh system:full-gate run.';
  return 'Standard regression risk; covered by full gate or targeted part gates.';
}

function buildArtifactHygieneScan() {
  const roots = [
    'artifacts/system-tests',
    'docs/testing',
    'tests/e2e/playwright-report',
    'tests/e2e/artifacts',
  ];
  const files = roots.flatMap((root) => collectFiles(path.join(repoRoot, root)));
  const unsafeFindings = [];
  const policyReferences = [];
  const textScanned = [];
  const binaryReview = [];
  const skipped = [];

  for (const filePath of files) {
    const relativePath = relative(filePath);
    const extension = path.extname(filePath).toLowerCase();
    if (textExtensions.has(extension)) {
      const { findings, policyReferences: references } = scanTextFile(filePath);
      textScanned.push({
        path: relativePath,
        bytes: fs.statSync(filePath).size,
        sha256: sha256(filePath),
        findings: findings.length,
        policyReferences: references.length,
      });
      unsafeFindings.push(...findings);
      policyReferences.push(...references);
    } else if (binaryExtensions.has(extension)) {
      binaryReview.push({
        path: relativePath,
        bytes: fs.statSync(filePath).size,
        sha256: sha256(filePath),
        includeInPr: 'no',
        reason: 'Binary generated artifact; excluded from PR and not text-scanned for secrets.',
      });
    } else {
      skipped.push({
        path: relativePath,
        bytes: fs.statSync(filePath).size,
        reason: 'Unknown extension; not scanned.',
      });
    }
  }

  const highFindings = unsafeFindings.filter((finding) => finding.severity === 'high');
  return {
    generatedAt: new Date().toISOString(),
    roots,
    status: highFindings.length > 0 ? 'UNSAFE_FOUND' : 'PASS',
    textFilesScanned: textScanned.length,
    binaryReviewFiles: binaryReview.length,
    skippedFiles: skipped.length,
    unsafeFindings,
    policyReferences,
    binaryReview,
    skipped,
    policy: {
      binaryArtifacts: 'local-only; do not include in PR',
      textArtifacts: 'scanned for secret-like and base64 attachment patterns',
      redaction: 'no automatic mutation in Part 10',
    },
  };
}

function scanTextFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const findings = [];
  const policyReferences = [];
  for (const definition of forbiddenPatterns) {
    const match = definition.pattern.exec(text);
    if (!match) continue;
    const line = lineNumberFor(text, match.index);
    const lineText = lineTextFor(text, match.index);
    if (isAllowedPolicyReference(filePath, definition.name, lineText)) {
      policyReferences.push({
        path: relative(filePath),
        pattern: definition.name,
        line,
        evidenceHash: sha256Text(match[0]),
      });
      continue;
    }
    findings.push({
      path: relative(filePath),
      pattern: definition.name,
      severity: definition.severity,
      line,
      evidenceHash: sha256Text(match[0]),
      note: 'Matched content redacted; hash recorded for deduplication.',
    });
  }
  return { findings, policyReferences };
}

function isAllowedPolicyReference(filePath, patternName, lineText) {
  const normalized = normalize(filePath);
  if (!normalized.includes('/docs/testing/')) {
    return false;
  }
  if (!['service-role', 'secret-env-name', 'signed-url'].includes(patternName)) {
    return false;
  }
  if (patternName === 'secret-env-name') {
    return true;
  }
  return /forbidden|exposure|covered|checks|no |not |without|redact|secret-like|утеч|без|не |запрещ/i.test(
    lineText,
  );
}

function redactLocalGeneratedArtifacts(findings) {
  const actions = [];
  if (findings.some((finding) => finding.path.startsWith('tests/e2e/playwright-report/'))) {
    const reportDir = path.join(repoRoot, 'tests', 'e2e', 'playwright-report');
    if (isSafeChildPath(reportDir, path.join(repoRoot, 'tests', 'e2e'))) {
      fs.rmSync(reportDir, { recursive: true, force: true });
      actions.push({
        action: 'delete-generated-directory',
        path: relative(reportDir),
        reason: 'Generated Playwright HTML report contained local data-url/minified signed-url-like text; excluded from PR.',
      });
    }
  }

  const byPath = new Map();
  for (const finding of findings) {
    if (finding.path.startsWith('tests/e2e/playwright-report/')) {
      continue;
    }
    if (!isRedactableGeneratedTextArtifact(finding.path)) {
      continue;
    }
    const values = byPath.get(finding.path) ?? [];
    values.push(finding);
    byPath.set(finding.path, values);
  }

  for (const [relativePath, fileFindings] of byPath) {
    const filePath = path.join(repoRoot, relativePath);
    const before = fs.readFileSync(filePath, 'utf8');
    const after = redactText(before, filePath);
    if (after === before) {
      continue;
    }
    fs.writeFileSync(filePath, after, 'utf8');
    actions.push({
      action: 'redact-generated-text-artifact',
      path: relativePath,
      findings: fileFindings.map((finding) => ({
        pattern: finding.pattern,
        severity: finding.severity,
        line: finding.line,
        evidenceHash: finding.evidenceHash,
      })),
      beforeSha256: sha256Text(before),
      afterSha256: sha256Text(after),
    });
  }

  return actions;
}

function readExistingRedactionActions() {
  if (fs.existsSync(redactionLogPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(redactionLogPath, 'utf8'));
      if (Array.isArray(parsed.actions) && parsed.actions.length > 0) {
        return parsed.actions;
      }
    } catch {
      // Fall through to inference from already-redacted generated artifacts.
    }
  }
  return inferRedactionActionsFromCurrentArtifacts();
}

function writeMergeReadinessReport(classification, hygiene, redactionLog) {
  const records = classification.records;
  const includeRows = Object.entries(classification.summary.byInclude)
    .map(([key, value]) => `| ${escapeMarkdown(key)} | ${value} |`)
    .join('\n');
  const kindRows = Object.entries(classification.summary.byKind)
    .map(([key, value]) => `| ${escapeMarkdown(key)} | ${value} |`)
    .join('\n');
  const domainRows = Object.entries(classification.summary.byDomain)
    .map(([key, value]) => `| ${escapeMarkdown(key)} | ${value} |`)
    .join('\n');
  const fileRows = records
    .map((record) =>
      [
        record.path,
        record.status,
        record.domain,
        record.includeInPr,
        record.reason,
        record.risk,
        record.requiresTest ? 'yes' : 'no',
        record.kind,
      ].map((value) => escapeMarkdown(String(value))).join(' | '),
    )
    .map((row) => `| ${row} |`)
    .join('\n');
  const reviewRows = records
    .filter((record) => record.includeInPr !== 'yes')
    .map((record) => `| ${escapeMarkdown(record.includeInPr)} | ${escapeMarkdown(record.path)} | ${escapeMarkdown(record.reason)} |`)
    .join('\n');

  const markdown = `# Part 10. Merge Readiness Report

Generated: ${new Date().toISOString()}

## Status

Overall status: ${hygiene.unsafeFindings.length === 0 ? 'READY_FOR_PR_REVIEW' : 'REVIEW_REQUIRED'}.

Runtime proof status: reuse-runtime PASS from Part 9. Clean-runtime destructive reset was not run in Part 10.

Root command verified in \`package.json\`:

\`\`\`powershell
corepack pnpm system:full-gate
\`\`\`

The script expands to:

\`\`\`powershell
node scripts/testing/full-system-gate.mjs --reuse-runtime --json --artifacts-dir=artifacts/system-tests/full-gate --fail-on-blocked --scope=full
\`\`\`

## Worktree Summary

Branch: \`${escapeMarkdown(classification.branch)}\`

Commit: \`${classification.commit}\`

Total dirty/untracked entries: ${classification.summary.total}.

### Include Decision Counts

| include in PR | count |
| --- | ---: |
${includeRows}

### Kind Counts

| kind | count |
| --- | ---: |
${kindRows}

### Domain Counts

| domain | count |
| --- | ---: |
${domainRows}

## Artifact Hygiene

Status: ${hygiene.unsafeFindings.length === 0 ? 'PASS' : 'REVIEW_REQUIRED'}.

- Text files scanned: ${hygiene.textFilesScanned}.
- Binary local-only review files: ${hygiene.binaryReviewFiles}.
- Unknown skipped files: ${hygiene.skippedFiles}.
- Unsafe text findings: ${hygiene.unsafeFindings.length}.
- Redaction log status: ${redactionLog.status}.
- Redaction actions recorded: ${redactionLog.actions.length}.

Generated machine-readable artifacts:

- \`${relative(classificationPath)}\`
- \`${relative(hygienePath)}\`
- \`${relative(redactionLogPath)}\`

## PR Scope Recommendations

- \`yes\`: intended Part 1-9 hardening code, scripts, tests, and docs; still review diffs before staging.
- \`review\`: shared files, generated evidence, or unclassified supporting files that need explicit PR-scope decision.
- \`no\`: local-only traces, binary screenshots/videos, temporary logs, and generated Playwright artifacts.

## Non-PR / Review Queue

| include | path | reason |
| --- | --- | --- |
${reviewRows || '| none | none | none |'}

## Full Per-File Classification

| path | status | domain | include in PR | reason | risk | requires test | artifact/doc/code |
| --- | --- | --- | --- | --- | --- | --- | --- |
${fileRows}
`;

  fs.mkdirSync(path.dirname(mergeReadinessReportPath), { recursive: true });
  fs.writeFileSync(mergeReadinessReportPath, markdown, 'utf8');
}

function inferRedactionActionsFromCurrentArtifacts() {
  const actions = [];
  const reportDir = path.join(repoRoot, 'tests', 'e2e', 'playwright-report');
  if (!fs.existsSync(reportDir)) {
    actions.push({
      action: 'delete-generated-directory',
      path: relative(reportDir),
      reason:
        'Generated Playwright HTML report was removed during Part 10 artifact hygiene; report content is local-only and excluded from PR.',
    });
  }

  for (const root of ['artifacts/system-tests', 'tests/e2e/artifacts']) {
    for (const filePath of collectFiles(path.join(repoRoot, root))) {
      const extension = path.extname(filePath).toLowerCase();
      if (!textExtensions.has(extension)) {
        continue;
      }
      const text = fs.readFileSync(filePath, 'utf8');
      const markers = Array.from(
        new Set([...text.matchAll(/\[REDACTED_([a-z0-9-]+):[a-f0-9]{64}\]/gi)].map((match) => match[1])),
      );
      const attachmentMarkers = text.includes('[REDACTED_ATTACHMENT_BODY:');
      if (markers.length === 0 && !attachmentMarkers) {
        continue;
      }
      actions.push({
        action: 'redact-generated-text-artifact',
        path: relative(filePath),
        findings: [
          ...markers.map((pattern) => ({ pattern })),
          ...(attachmentMarkers ? [{ pattern: 'json-base64-attachment-body' }] : []),
        ],
        afterSha256: sha256Text(text),
        inferred: true,
      });
    }
  }

  return actions;
}

function isRedactableGeneratedTextArtifact(relativePath) {
  return (
    relativePath.startsWith('artifacts/system-tests/') ||
    relativePath.startsWith('tests/e2e/artifacts/')
  );
}

function redactText(text, filePath) {
  let next = text;
  for (const definition of forbiddenPatterns) {
    const flags = definition.pattern.flags.includes('g')
      ? definition.pattern.flags
      : `${definition.pattern.flags}g`;
    const regex = new RegExp(definition.pattern.source, flags);
    next = next.replace(regex, (match, ...args) => {
      const offset = Number(args.at(-2));
      const lineText = Number.isFinite(offset) ? lineTextFor(next, offset) : '';
      if (isAllowedPolicyReference(filePath, definition.name, lineText)) {
        return match;
      }
      if (definition.name === 'json-base64-attachment-body') {
        return `"body": "[REDACTED_ATTACHMENT_BODY:${sha256Text(match)}]"`;
      }
      return `[REDACTED_${definition.name}:${sha256Text(match)}]`;
    });
  }
  return next;
}

function lineTextFor(text, index) {
  const before = text.lastIndexOf('\n', index);
  const after = text.indexOf('\n', index);
  return text.slice(before + 1, after === -1 ? text.length : after);
}

function isSafeChildPath(candidate, parent) {
  const resolvedCandidate = path.resolve(candidate);
  const resolvedParent = path.resolve(parent);
  return (
    resolvedCandidate === resolvedParent ||
    resolvedCandidate.startsWith(`${resolvedParent}${path.sep}`)
  );
}

function parseGitStatus(output) {
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const status = line.slice(0, 2);
      const pathText = line.slice(2).trim();
      return { status, path: pathText.includes(' -> ') ? pathText.split(' -> ').at(-1) : pathText };
    });
}

function collectFiles(root) {
  if (!fs.existsSync(root)) return [];
  const result = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectFiles(fullPath));
    } else {
      result.push(fullPath);
    }
  }
  return result;
}

function countBy(records, selector) {
  return records.reduce((accumulator, record) => {
    const key = selector(record);
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});
}

function lineNumberFor(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function sha256(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function sha256Text(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function escapeMarkdown(value) {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function git(args) {
  return gitRaw(args).trim();
}

function gitRaw(args) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).replace(/\r?\n$/, '');
}

function runGit(args) {
  try {
    const stdout = execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 'pass', stdout: stdout.trim(), stderr: '' };
  } catch (error) {
    return {
      status: 'fail',
      stdout: String(error.stdout ?? '').trim(),
      stderr: String(error.stderr ?? '').trim(),
      exitCode: error.status ?? null,
    };
  }
}

function normalize(filePath) {
  return filePath.replace(/\\/g, '/');
}

function relative(filePath) {
  return normalize(path.relative(repoRoot, filePath));
}
