import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const defaultArtifactsDir = path.join(
  repoRoot,
  'artifacts',
  'system-tests',
  'full-gate',
);
const monitoredPorts = [
  3000, 3014, 3029, 3100, 3129, 54321, 54322, 54323, 6379, 6380, 8080, 8090,
  8091, 8123, 9200, 19092,
];
const secretPattern =
  /(BEGIN PRIVATE KEY[\s\S]*?END PRIVATE KEY|Bearer\s+[A-Za-z0-9._~+/=-]+|sk-[A-Za-z0-9_-]{8,}|xai-[A-Za-z0-9_-]{8,}|eyJ[A-Za-z0-9._~+/=-]+|postgresql:\/\/[^@\s]+@|service_role|SUPABASE_SECRET_KEY|ACTIVEPIECES_API_KEY|OPENAI_API_KEY|TAVILY_API_KEY)/i;
const secretPatternGlobal =
  /(BEGIN PRIVATE KEY[\s\S]*?END PRIVATE KEY|Bearer\s+[A-Za-z0-9._~+/=-]+|sk-[A-Za-z0-9_-]{8,}|xai-[A-Za-z0-9_-]{8,}|eyJ[A-Za-z0-9._~+/=-]+|postgresql:\/\/[^@\s]+@|service_role|SUPABASE_SECRET_KEY|ACTIVEPIECES_API_KEY|OPENAI_API_KEY|TAVILY_API_KEY)/gi;

const options = parseArgs(process.argv.slice(2));
const artifactsDir = path.resolve(repoRoot, options.artifactsDir);
const logsDir = path.join(artifactsDir, 'logs');
const commandLedgerPath = path.join(artifactsDir, 'command-ledger.json');
const finalReportPath = path.join(artifactsDir, 'full-system-gate.json');
const playwrightResultsPath = path.join(
  artifactsDir,
  'playwright-results.backend-full-system.json',
);

fs.mkdirSync(logsDir, { recursive: true });

const startedAt = new Date().toISOString();
const ledger = [];
const phases = [];

try {
  const inventory = await collectInventory();
  writeJson('inventory.json', inventory);
  phases.push({ name: 'inventory', status: 'PASS' });

  if (options.clean) {
    const cleanResult = runCommand({
      name: 'clean-runtime-up-full',
      command: 'corepack pnpm stage16:runtime:up-full',
      timeoutMs: 600_000,
    });
    phases.push({
      name: 'clean-runtime-up-full',
      status: cleanResult.status === 'pass' ? 'PASS' : 'FAIL',
    });
    if (cleanResult.status !== 'pass') {
      finish('FAIL', 'clean runtime setup failed', 1);
    }
  }

  const preflight = runPreflight();
  writeJson('preflight.full.json', preflight.report);
  phases.push({
    name: 'preflight',
    status: preflight.report.status === 'READY' ? 'PASS' : 'BLOCKED',
  });
  if (preflight.report.status !== 'READY' && options.failOnBlocked) {
    finish('BLOCKED_REQUIRED', 'full runtime preflight blocked required services', 2);
  }

  for (const command of releaseCommands()) {
    const result = runCommand(command);
    phases.push({
      name: command.name,
      status: result.status === 'pass' ? 'PASS' : 'FAIL',
      durationMs: result.durationMs,
    });
    if (result.status !== 'pass') {
      finish('FAIL', `${command.name} failed`, result.exitCode || 1);
    }
  }

  redactPlaywrightArtifacts();
  phases.push({ name: 'artifact-redaction', status: 'PASS' });

  const evidence = collectEvidence();
  writeJson('evidence-summary.json', evidence);
  phases.push({ name: 'evidence', status: evidence.safe ? 'PASS' : 'FAIL' });
  if (!evidence.safe) {
    finish('FAIL', 'unsafe evidence artifacts detected', 1);
  }

  finish('PASS', 'full system gate passed', 0);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  finish('FAIL', sanitize(message), 1);
}

function parseArgs(argv) {
  const args = new Set(argv);
  return {
    clean: args.has('--clean'),
    reuseRuntime: args.has('--reuse-runtime'),
    json: args.has('--json'),
    failOnBlocked: args.has('--fail-on-blocked'),
    includeMsw: args.has('--include-msw'),
    skipOptionalReason: readArg(argv, '--skip-optional'),
    scope: readArg(argv, '--scope') ?? 'full',
    artifactsDir: readArg(argv, '--artifacts-dir') ?? defaultArtifactsDir,
  };
}

function releaseCommands() {
  const env = {
    LEXFRAME_E2E_USE_MSW: '0',
    LEXFRAME_E2E_REUSE_EXISTING_SERVER: '0',
    LEXFRAME_E2E_SCOPE: options.scope,
    LEXFRAME_E2E_SKIP_SEARCH_INDEX: '0',
    PLAYWRIGHT_JSON_OUTPUT_NAME: playwrightResultsPath,
  };
  const commands = [
    {
      name: 'contracts-typecheck',
      command: 'corepack pnpm --filter @lexframe/contracts typecheck',
      timeoutMs: 180_000,
    },
    {
      name: 'api-client-typecheck',
      command: 'corepack pnpm --filter @lexframe/api-client typecheck',
      timeoutMs: 180_000,
    },
    {
      name: 'backend-typecheck',
      command: 'corepack pnpm --filter @lexframe/backend typecheck',
      timeoutMs: 180_000,
    },
    {
      name: 'backend-lint',
      command: 'corepack pnpm --filter @lexframe/backend lint',
      timeoutMs: 240_000,
    },
    {
      name: 'backend-cross-domain-tests',
      command:
        'corepack pnpm --filter @lexframe/backend test -- chat documents settings activepieces automation canvas runs audit authorization legal-search legal-rag legal-sources project-knowledge web-search',
      timeoutMs: 300_000,
    },
    {
      name: 'web-typecheck',
      command: 'corepack pnpm --filter @lexframe/web typecheck',
      timeoutMs: 180_000,
    },
    {
      name: 'web-lint',
      command: 'corepack pnpm --filter @lexframe/web lint',
      timeoutMs: 240_000,
    },
    {
      name: 'web-cross-domain-unit-tests',
      command:
        'corepack pnpm --filter @lexframe/web exec vitest run app-shell project-sidebar project-home LexFrameChatShell settings upload-dialog activepieces-canvas',
      timeoutMs: 300_000,
    },
    {
      name: 'e2e-typecheck',
      command: 'corepack pnpm --filter @lexframe/e2e typecheck',
      timeoutMs: 180_000,
    },
    {
      name: 'e2e-lint',
      command: 'corepack pnpm --filter @lexframe/e2e lint',
      timeoutMs: 240_000,
    },
    {
      name: 'web-bundle-secret-scan',
      command: 'corepack pnpm validate:web-bundle-secrets',
      timeoutMs: 180_000,
    },
    {
      name: 'repo-secret-scan',
      command: 'corepack pnpm secret-scan',
      timeoutMs: 180_000,
    },
    {
      name: 'backend-backed-cross-domain-e2e',
      command: [
        'corepack pnpm --filter @lexframe/e2e exec playwright test',
        'frontend-shell-navigation-state.spec.ts',
        'project-workspace-tabs-state.spec.ts',
        'chat-live-reload-recovery.spec.ts',
        'automation-activepieces-canvas-full.spec.ts',
        'automation-runtime-dry-run-full.spec.ts',
        'documents-upload-download-full.spec.ts',
        'settings-ai-route-preferences-live.spec.ts',
        'security-browser-storage-network-full.spec.ts',
        'stage6-search-integrated.spec.ts',
        'search-browser-security-isolation.spec.ts',
        'system-release-gate-smoke.spec.ts',
        '--reporter=list,json',
      ].join(' '),
      env,
      timeoutMs: 1_200_000,
    },
  ];

  if (options.includeMsw) {
    commands.push({
      name: 'msw-deterministic-cross-domain-e2e',
      command:
        'corepack pnpm --filter @lexframe/e2e exec playwright test project-web-search-sources.spec.ts frontend-multitab-shell-state.spec.ts settings-network-failure-resilience.spec.ts --reporter=list,json',
      env: {
        LEXFRAME_E2E_USE_MSW: '1',
        PLAYWRIGHT_JSON_OUTPUT_NAME: path.join(
          artifactsDir,
          'playwright-results.msw-full-system.json',
        ),
      },
      timeoutMs: 600_000,
    });
  }

  return commands;
}

function runPreflight() {
  const command = [
    'node scripts/stage16-e2e-preflight.mjs',
    `--scope=${options.scope}`,
    '--json',
    '--fail-on-required',
  ]
    .filter(Boolean)
    .join(' ');
  const result = runCommand({
    name: 'full-preflight',
    command,
    timeoutMs: 120_000,
    allowFailure: true,
  });
  const report = parseJsonObject(result.stdout);
  return { result, report };
}

function runCommand(item) {
  const started = Date.now();
  const result = spawnSync(item.command, {
    cwd: repoRoot,
    shell: true,
    encoding: 'utf8',
    env: { ...process.env, ...(item.env ?? {}) },
    timeout: item.timeoutMs ?? 300_000,
    maxBuffer: 30 * 1024 * 1024,
  });
  const durationMs = Date.now() - started;
  const status = result.status === 0 ? 'pass' : 'fail';
  const logPath = path.join(logsDir, `${safeName(item.name)}.log`);
  const stdout = sanitize(result.stdout ?? '');
  const stderr = sanitize(result.stderr ?? '');
  fs.writeFileSync(
    logPath,
    [`$ ${item.command}`, '', stdout, stderr].join('\n'),
    'utf8',
  );
  const record = {
    name: item.name,
    command: redactCommand(item.command),
    status,
    exitCode: result.status ?? null,
    signal: result.signal ?? null,
    durationMs,
    logPath: path.relative(repoRoot, logPath).replace(/\\/g, '/'),
  };
  ledger.push(record);
  fs.writeFileSync(commandLedgerPath, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
  return {
    ...record,
    stdout,
    stderr,
  };
}

async function collectInventory() {
  return {
    generatedAt: new Date().toISOString(),
    mode: options.clean ? 'clean-runtime' : options.reuseRuntime ? 'reuse-runtime' : 'standard',
    scope: options.scope,
    git: {
      branch: git(['rev-parse', '--abbrev-ref', 'HEAD']),
      commit: git(['rev-parse', 'HEAD']),
      dirtyFiles: git(['status', '--short'])
        .split(/\r?\n/)
        .filter(Boolean)
        .map(classifyDirtyFile),
    },
    versions: {
      node: commandText(process.execPath, ['--version']),
      pnpm: commandText('corepack', ['pnpm', '--version']),
      docker: commandText('docker', ['version', '--format', '{{.Server.Version}}']),
    },
    ports: await Promise.all(monitoredPorts.map(checkPort)),
    compose: readCompose(),
    environment: safeEnvironment(),
    skipOptionalReason: options.skipOptionalReason,
  };
}

function collectEvidence() {
  const files = collectFiles(artifactsDir).map((filePath) => {
    const relativePath = path.relative(repoRoot, filePath).replace(/\\/g, '/');
    const safeForSharing = isSafeArtifact(filePath);
    return {
      path: relativePath,
      sha256: sha256(filePath),
      bytes: fs.statSync(filePath).size,
      safeForSharing,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    artifacts: files,
    safe: files.every((file) => file.safeForSharing),
    commandCount: ledger.length,
    playwrightResults: fs.existsSync(playwrightResultsPath)
      ? path.relative(repoRoot, playwrightResultsPath).replace(/\\/g, '/')
      : null,
  };
}

function redactPlaywrightArtifacts() {
  const candidates = [
    playwrightResultsPath,
    path.join(artifactsDir, 'playwright-results.msw-full-system.json'),
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) {
      continue;
    }

    const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8'));
    const redacted = redactAttachmentBodies(parsed);
    fs.writeFileSync(candidate, `${JSON.stringify(redacted, null, 2)}\n`, 'utf8');
  }
}

function redactAttachmentBodies(value) {
  if (Array.isArray(value)) {
    return value.map(redactAttachmentBodies);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const next = {};
  for (const [key, childValue] of Object.entries(value)) {
    if (key === 'body' && typeof childValue === 'string') {
      next[key] = `[REDACTED_ATTACHMENT_BODY:${sha256Text(childValue)}]`;
    } else {
      next[key] = redactAttachmentBodies(childValue);
    }
  }

  return next;
}

function finish(status, summary, exitCode) {
  const payload = {
    status,
    summary,
    startedAt,
    finishedAt: new Date().toISOString(),
    mode: options.clean ? 'clean-runtime' : options.reuseRuntime ? 'reuse-runtime' : 'standard',
    scope: options.scope,
    phases,
    commandLedger: path.relative(repoRoot, commandLedgerPath).replace(/\\/g, '/'),
    artifactsDir: path.relative(repoRoot, artifactsDir).replace(/\\/g, '/'),
    playwrightResults: fs.existsSync(playwrightResultsPath)
      ? path.relative(repoRoot, playwrightResultsPath).replace(/\\/g, '/')
      : null,
  };
  fs.writeFileSync(finalReportPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`[full-system-gate] ${status}: ${summary}`);
    console.log(`report: ${path.relative(repoRoot, finalReportPath)}`);
  }
  process.exit(exitCode);
}

function classifyDirtyFile(line) {
  const match = line.match(/^(.{2})\s+(.*)$/);
  const status = match?.[1] ?? line.slice(0, 2);
  const filePath = (match?.[2] ?? line.slice(3)).trim().replace(/\\/g, '/');
  const currentTask =
    filePath === 'package.json' ||
    filePath === 'apps/web/src/app/(auth)/onboarding/workspace/page.tsx' ||
    filePath === 'tests/e2e/helpers/auth.ts' ||
    filePath === 'tests/e2e/utils/performance.ts' ||
    filePath === 'tests/e2e/system-release-gate-smoke.spec.ts' ||
    filePath === 'scripts/testing/full-system-gate.mjs' ||
    filePath === 'docs/testing/part9-full-system-gate.md' ||
    filePath.startsWith('artifacts/system-tests/full-gate/') ||
    filePath.startsWith('artifacts/system-tests/block5-performance/') ||
    filePath.startsWith('artifacts/system-tests/block5-release-gate/') ||
    filePath.startsWith('artifacts/system-tests/block5-security/');
  return {
    status,
    path: filePath,
    classification: currentTask ? 'current-task' : 'pre-existing-or-unrelated',
  };
}

function readCompose() {
  const result = spawnSync(
    'docker',
    [
      'compose',
      '--profile',
      'local-integrated',
      '--profile',
      'full-runtime',
      'ps',
      '--all',
      '--format',
      'json',
    ],
    { cwd: repoRoot, encoding: 'utf8', shell: false, maxBuffer: 20 * 1024 * 1024 },
  );
  if (result.status !== 0) {
    return { status: 'unavailable', stderr: sanitize(result.stderr ?? '') };
  }
  return {
    status: 'available',
    services: parseJsonLines(result.stdout ?? '').map((row) => ({
      service: row.Service,
      state: row.State,
      status: row.Status,
      health: row.Health ?? row.health ?? null,
      exitCode: row.ExitCode ?? null,
    })),
  };
}

function safeEnvironment() {
  return Object.fromEntries(
    Object.entries(process.env)
      .filter(([key]) =>
        /^(LEXFRAME|NEXT_PUBLIC|ACTIVEPIECES|OPENSEARCH|SUPABASE|PLAYWRIGHT)_/.test(
          key,
        ),
      )
      .map(([key, value]) => [key, redactEnvValue(key, value ?? '')]),
  );
}

function redactEnvValue(key, value) {
  if (/KEY|TOKEN|SECRET|PASSWORD|PRIVATE|AUTH|DB_URL/i.test(key)) {
    return value ? '[REDACTED]' : '';
  }
  return sanitize(value);
}

function commandText(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: command === 'corepack',
  });
  return sanitize(result.stdout || result.stderr || '').trim();
}

function git(args) {
  return commandText('git', args) || 'unknown';
}

async function checkPort(port) {
  const connectable = await canConnectPort(port);
  const bindable = await canBindPort(port);
  return {
    port,
    connectable,
    bindable,
    state: connectable ? 'listening' : bindable ? 'free' : 'unknown',
  };
}

function canConnectPort(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    socket.setTimeout(750);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(false));
  });
}

function canBindPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

function collectFiles(root) {
  if (!fs.existsSync(root)) {
    return [];
  }
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function isSafeArtifact(filePath) {
  if (!/\.(json|log|txt|md)$/i.test(filePath)) {
    return true;
  }
  return !secretPattern.test(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(name, value) {
  const filePath = path.join(artifactsDir, name);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return filePath;
}

function parseJsonObject(output) {
  const firstBrace = output.indexOf('{');
  const lastBrace = output.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1) {
    return {
      status: 'BLOCKED_REQUIRED',
      parseError: 'preflight did not produce JSON',
      raw: sanitize(output).slice(0, 2000),
    };
  }
  return JSON.parse(output.slice(firstBrace, lastBrace + 1));
}

function parseJsonLines(output) {
  const text = output.trim();
  if (!text) {
    return [];
  }
  if (text.startsWith('[')) {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [parsed];
  }
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      const parsed = JSON.parse(line);
      return Array.isArray(parsed) ? parsed : [parsed];
    });
}

function safeName(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
}

function sha256(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function sha256Text(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function redactCommand(command) {
  return sanitize(command);
}

function sanitize(value) {
  return String(value).replace(secretPatternGlobal, (match) =>
    match.startsWith('postgresql://') ? 'postgresql://[REDACTED]@' : '[REDACTED]',
  );
}

function readArg(argv, name) {
  const prefix = `${name}=`;
  const inline = argv.find((arg) => arg.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : null;
}
