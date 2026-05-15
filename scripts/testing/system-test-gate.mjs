import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const artifactsRoot = path.join(repoRoot, 'artifacts', 'system-tests');
const quick = process.argv.includes('--quick');
const full = process.argv.includes('--full') || !quick;
const continueOnError = process.argv.includes('--continue');
const ledgerPath = path.join(artifactsRoot, 'command-ledger.json');
const commands = quick ? quickCommands() : fullCommands();
const ledger = [];

fs.mkdirSync(artifactsRoot, { recursive: true });

for (const item of commands) {
  const startedAt = Date.now();
  const logPath = path.join(
    artifactsRoot,
    'logs',
    `${item.name.replace(/[^a-zA-Z0-9_-]+/g, '-')}.log`,
  );
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const result = spawnSync(item.command, {
    cwd: repoRoot,
    shell: true,
    encoding: 'utf8',
    env: { ...process.env, ...(item.env ?? {}) },
  });
  fs.writeFileSync(
    logPath,
    [
      `$ ${item.command}`,
      '',
      result.stdout ?? '',
      result.stderr ?? '',
    ].join('\n'),
    'utf8',
  );
  const record = {
    name: item.name,
    command: item.command,
    status: result.status === 0 ? 'pass' : 'fail',
    logPath: path.relative(repoRoot, logPath).replace(/\\/g, '/'),
    durationMs: Date.now() - startedAt,
  };
  ledger.push(record);
  fs.writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');

  if (result.status !== 0 && !continueOnError) {
    console.error(`${item.name} failed. See ${record.logPath}`);
    process.exit(result.status ?? 1);
  }
}

if (full) {
  runPostCommand('collect evidence', 'node scripts/testing/collect-system-test-evidence.mjs');
  runPostCommand('check artifacts', 'node scripts/testing/check-system-test-artifacts.mjs');
}

console.log(`${quick ? 'Quick' : 'Full'} system test gate completed.`);

function quickCommands() {
  return [
    ['contracts typecheck', 'corepack pnpm --filter @lexframe/contracts typecheck'],
    ['backend typecheck', 'corepack pnpm --filter @lexframe/backend typecheck'],
    ['backend targeted tests', 'corepack pnpm --filter @lexframe/backend test -- chat documents settings activepieces automation canvas runs'],
    ['web typecheck', 'corepack pnpm --filter @lexframe/web typecheck'],
    ['web targeted tests', 'corepack pnpm --filter @lexframe/web exec vitest run app-shell project-sidebar project-home LexFrameChatShell settings upload-dialog activepieces-canvas'],
    ['secret scan', 'corepack pnpm secret-scan'],
    ['bundle secret scan', 'corepack pnpm validate:web-bundle-secrets'],
    ['block5 smoke e2e', 'corepack pnpm --filter @lexframe/e2e exec playwright test frontend-shell-clickability.spec.ts project-workspace-flow.spec.ts automation-activepieces-canvas-full.spec.ts browser-security-isolation-full.spec.ts ui-performance-animations-full.spec.ts system-release-gate-smoke.spec.ts'],
  ].map(([name, command]) => ({ name, command }));
}

function fullCommands() {
  return [
    ['contracts typecheck', 'corepack pnpm --filter @lexframe/contracts typecheck'],
    ['contracts lint', 'corepack pnpm --filter @lexframe/contracts lint'],
    ['backend typecheck', 'corepack pnpm --filter @lexframe/backend typecheck'],
    ['backend lint', 'corepack pnpm --filter @lexframe/backend lint'],
    ['backend system tests', 'corepack pnpm --filter @lexframe/backend test -- chat documents settings activepieces automation canvas runs'],
    ['web typecheck', 'corepack pnpm --filter @lexframe/web typecheck'],
    ['web lint', 'corepack pnpm --filter @lexframe/web lint'],
    ['web system tests', 'corepack pnpm --filter @lexframe/web exec vitest run app-shell project-sidebar project-home LexFrameChatShell settings upload-dialog activepieces-canvas'],
    ['db readiness', 'corepack pnpm check:db'],
    ['bundle secret scan', 'corepack pnpm validate:web-bundle-secrets'],
    ['secret scan', 'corepack pnpm secret-scan'],
    ['system e2e', 'corepack pnpm --filter @lexframe/e2e exec playwright test frontend-shell-clickability.spec.ts project-workspace-flow.spec.ts project-chat-runtime-full.spec.ts global-chat-runtime-full.spec.ts chat-attachments-branches.spec.ts documents-upload-download-full.spec.ts automation-activepieces-canvas-full.spec.ts automation-runtime-dry-run-full.spec.ts browser-security-isolation-full.spec.ts ui-performance-animations-full.spec.ts ui-reduced-motion.spec.ts accessibility-keyboard-focus.spec.ts visual-system-evidence.spec.ts system-release-gate-smoke.spec.ts'],
  ].map(([name, command]) => ({ name, command }));
}

function runPostCommand(name, command) {
  const result = spawnSync(command, {
    cwd: repoRoot,
    shell: true,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    console.error(`${name} failed.`);
    process.exit(result.status ?? 1);
  }
}
