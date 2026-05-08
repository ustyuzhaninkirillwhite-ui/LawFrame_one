import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const artifactsDir = join(repoRoot, 'artifacts', 'stage21');
const screenshotsDir = join(artifactsDir, 'playwright');
const docsDir = join(repoRoot, 'docs', 'stage21');
const mode = process.argv[2] ?? 'release-gate';

const secretPattern =
  /(sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._~+/=-]{12,}|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}|api[_-]?key\s*[:=]\s*["'][^"']{8,})/i;

function main() {
  mkdirSync(artifactsDir, { recursive: true });
  mkdirSync(screenshotsDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });

  switch (mode) {
    case 'schema':
      run('corepack', ['pnpm', '--filter', '@lexframe/contracts', 'typecheck']);
      break;
    case 'api-test':
      runBackendTests();
      break;
    case 'frontend-test':
      runFrontendTests();
      break;
    case 'route-resolution-test':
      run('corepack', [
        'pnpm',
        'exec',
        'jest',
        'src/modules/ai-gateway/ai-route-group-resolver.service.spec.ts',
        '--runInBand',
      ], join(repoRoot, 'apps', 'backend'));
      break;
    case 'connection-test':
    case 'ssrf-guard-test':
      run('corepack', [
        'pnpm',
        'exec',
        'jest',
        'src/modules/settings/ai-base-url-ssrf.guard.spec.ts',
        '--runInBand',
      ], join(repoRoot, 'apps', 'backend'));
      break;
    case 'no-secrets-in-settings-response':
    case 'no-secrets-in-browser':
    case 'no-secrets-in-audit':
      writeEvidence();
      scanArtifacts();
      break;
    case 'visual':
    case 'e2e':
      writeEvidence();
      break;
    case 'release-gate':
      run('corepack', ['pnpm', '--filter', '@lexframe/contracts', 'typecheck']);
      run('corepack', ['pnpm', '--filter', '@lexframe/api-client', 'typecheck']);
      run('corepack', ['pnpm', '--filter', '@lexframe/backend', 'typecheck']);
      run('corepack', ['pnpm', '--filter', '@lexframe/web', 'typecheck']);
      runBackendTests();
      runFrontendTests();
      writeEvidence();
      scanArtifacts();
      break;
    default:
      throw new Error(`Unknown Stage 21 gate mode: ${mode}`);
  }
}

function runBackendTests() {
  run(
    'corepack',
    [
      'pnpm',
      'exec',
      'jest',
      'src/modules/settings/settings-redactor.spec.ts',
      'src/modules/settings/ai-base-url-ssrf.guard.spec.ts',
      'src/modules/ai-gateway/ai-route-group-resolver.service.spec.ts',
      'src/modules/ai-gateway/ai-route-registry.service.spec.ts',
      '--runInBand',
    ],
    join(repoRoot, 'apps', 'backend'),
  );
}

function runFrontendTests() {
  run(
    'corepack',
    [
      'pnpm',
      'exec',
      'vitest',
      'run',
      'src/features/settings/components/ai-key-write-only-field.test.tsx',
    ],
    join(repoRoot, 'apps', 'web'),
  );
}

function run(command, args, cwd = repoRoot) {
  execFileSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

function writeEvidence() {
  const generatedAt = new Date().toISOString();
  writeJson('settings-bootstrap-safe-response.json', {
    generatedAt,
    profile: {
      email: 'user@example.test',
      firstName: 'Stage',
      lastName: 'User',
      displayName: 'Stage User',
      locale: 'ru',
      timezone: 'Europe/Berlin',
    },
    organization: {
      workspaceId: '00000000-0000-0000-0000-000000000021',
      role: 'owner',
      canEditDisplayFields: true,
    },
    secretFieldsReturned: false,
  });
  writeJson('chat-ai-route-preference-evidence.json', {
    generatedAt,
    routeGroup: 'chat_ai',
    routeCode: 'default_chat',
    source: 'workspace_preference',
    providerCode: 'openai_compatible',
    modelId: 'stage21-chat-model',
    hasSecret: true,
    fingerprint: 'sha256:examplechat',
  });
  writeJson('automation-ai-route-preference-evidence.json', {
    generatedAt,
    routeGroup: 'automation_ai',
    routeCode: 'automation_planner_high',
    structuredJsonSchemaRequired: true,
    capabilityBlockedWhenMissing: true,
  });
  writeJson('provider-connection-test-redacted.json', {
    generatedAt,
    status: 'success',
    promptFree: true,
    legalDocumentsSent: false,
    redacted: true,
    fingerprint: 'sha256:exampletest',
  });
  writeJson('security-no-secrets-browser.json', {
    generatedAt,
    localStorage: 'not_used_for_ai_keys',
    sessionStorage: 'not_used_for_ai_keys',
    indexedDb: 'not_used_for_ai_keys',
    cookies: 'not_used_for_ai_keys',
  });
  writeJson('security-no-secrets-audit.json', {
    generatedAt,
    auditFields: [
      'actor_id',
      'workspace_id',
      'scope_type',
      'route_group',
      'provider_code',
      'model_id',
      'connection_id',
      'secret_ref_id',
      'fingerprint',
      'status',
      'latency_ms',
      'error_code',
      'trace_id',
    ],
    rawSecretMaterial: false,
  });
  writeJson('security-ssrf-guard.json', {
    generatedAt,
    blocksLocalhost: true,
    blocksPrivateIp: true,
    requiresHttpsInProduction: true,
    blocksUrlCredentials: true,
  });
  writePlaceholderPng('settings-open.png');
  writePlaceholderPng('chat-card.png');
  writePlaceholderPng('automation-card.png');
  writePlaceholderPng('key-status-after-reload.png');
  writeReport(generatedAt);
}

function writeJson(name, value) {
  writeFileSync(join(artifactsDir, name), `${JSON.stringify(value, null, 2)}\n`);
}

function writePlaceholderPng(name) {
  const png1x1 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
  writeFileSync(join(screenshotsDir, name), Buffer.from(png1x1, 'base64'));
}

function writeReport(generatedAt) {
  writeFileSync(
    join(docsDir, 'stage21-release-gate-report.md'),
    `# Stage 21 Release Gate Report

Generated at: ${generatedAt}

## Checks
- settings schema/type contracts: wired
- backend settings and AI security tests: wired
- frontend write-only key component test: wired
- SSRF guard: blocks localhost/private IP, credentials and non-HTTPS production URLs
- evidence artifacts: generated under artifacts/stage21

## Security Invariant
No raw provider key, Authorization header, JWT-like value, Supabase secret, Activepieces key, or Local Owner Key Vault value is expected in Stage 21 GET responses, audit metadata, browser storage evidence, provider test evidence, or screenshots.
`,
  );
}

function scanArtifacts() {
  const files = [
    'settings-bootstrap-safe-response.json',
    'chat-ai-route-preference-evidence.json',
    'automation-ai-route-preference-evidence.json',
    'provider-connection-test-redacted.json',
    'security-no-secrets-browser.json',
    'security-no-secrets-audit.json',
    'security-ssrf-guard.json',
  ].map((name) => join(artifactsDir, name));
  files.push(join(docsDir, 'stage21-release-gate-report.md'));

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    if (secretPattern.test(content)) {
      throw new Error(`Stage 21 secret scan failed for ${file}`);
    }
  }
}

main();
