import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const auditRoot = join(root, 'artifacts', 'stage18-20', 'audit');
const indexPath = join(auditRoot, 'command-logs', 'command-index.json');

const args = process.argv.slice(2);
const separator = args.indexOf('--');
if (separator === -1) {
  console.error('Usage: node scripts/stage18-20/audit-command.mjs --name <name> -- <command> [args...]');
  process.exit(2);
}

const options = args.slice(0, separator);
const commandArgs = args.slice(separator + 1);
const name = optionValue(options, '--name') ?? commandArgs.join(' ');
const safeName = name
  .toLowerCase()
  .replace(/[^a-z0-9._-]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 96) || 'command';
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

for (const dir of [
  'command-logs',
  'failed-before-fix',
  'passed-after-fix',
  'readiness',
  'runtime',
  'security',
  'reports',
]) {
  mkdirSync(join(auditRoot, dir), { recursive: true });
}

const metadata = collectMetadata();
const started = Date.now();
const result = spawnSync(commandArgs[0], commandArgs.slice(1), {
  cwd: root,
  encoding: 'utf8',
  shell: false,
  env: {
    ...process.env,
    NO_COLOR: '1',
    FORCE_COLOR: '0',
  },
});
const durationMs = Date.now() - started;
const exitCode = typeof result.status === 'number' ? result.status : 1;
const output = redact(
  [
    result.stdout ?? '',
    result.stderr ? `\n[stderr]\n${result.stderr}` : '',
    result.error ? `\n[spawn_error]\n${result.error.message}` : '',
  ].join(''),
);

const header = redact(
  [
    `timestamp=${new Date().toISOString()}`,
    `redaction=applied`,
    `name=${name}`,
    `command=${commandArgs.map(quoteArg).join(' ')}`,
    `exit_code=${exitCode}`,
    `duration_ms=${durationMs}`,
    `branch=${metadata.branch}`,
    `commit=${metadata.commit}`,
    `os=${metadata.os}`,
    `node=${metadata.node}`,
    `corepack=${metadata.corepack}`,
    `pnpm=${metadata.pnpm}`,
    `docker=${metadata.docker}`,
    `docker_compose=${metadata.dockerCompose}`,
    `docker_status=${metadata.dockerStatus}`,
  ].join('\n'),
);

const body = `${header}\n\n[output]\n${output}\n`;
const commandLogPath = join(auditRoot, 'command-logs', `${timestamp}-${safeName}.log`);
const phaseDir = exitCode === 0 ? 'passed-after-fix' : 'failed-before-fix';
const phaseLogPath = join(auditRoot, phaseDir, `${timestamp}-${safeName}.log`);
writeFileSync(commandLogPath, body);
writeFileSync(phaseLogPath, body);
appendIndex({
  name,
  command: commandArgs,
  status: exitCode === 0 ? 'PASS' : 'FAIL',
  exit_code: exitCode,
  duration_ms: durationMs,
  command_log: relative(commandLogPath),
  phase_log: relative(phaseLogPath),
  generated_at: new Date().toISOString(),
});

process.exit(exitCode);

function optionValue(values, key) {
  const index = values.indexOf(key);
  if (index === -1) {
    return null;
  }
  return values[index + 1] ?? null;
}

function collectMetadata() {
  return {
    branch: commandOutput('git', ['rev-parse', '--abbrev-ref', 'HEAD']),
    commit: commandOutput('git', ['rev-parse', 'HEAD']),
    os: `${os.type()} ${os.release()} ${os.arch()}`,
    node: process.version,
    corepack: commandOutput('corepack', ['--version']),
    pnpm: commandOutput('corepack', ['pnpm', '-v']),
    docker: commandOutput('docker', ['--version']),
    dockerCompose: commandOutput('docker', ['compose', 'version']),
    dockerStatus: commandOutput('docker', [
      'info',
      '--format',
      'Server={{.ServerVersion}};OSType={{.OSType}};Containers={{.Containers}};Images={{.Images}}',
    ]),
  };
}

function commandOutput(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    return 'unavailable';
  }
  return redact((result.stdout ?? '').trim());
}

function appendIndex(entry) {
  const current = readJson(indexPath, []);
  current.push(entry);
  writeFileSync(indexPath, `${JSON.stringify(current, null, 2)}\n`);
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

function relative(path) {
  return path.replace(`${root}\\`, '').replace(`${root}/`, '').replace(/\\/g, '/');
}

function quoteArg(value) {
  if (/^[A-Za-z0-9_./:=@-]+$/.test(value)) {
    return value;
  }
  return JSON.stringify(value);
}

function redact(value) {
  return value
    .replace(
      /https?:\/\/[^\s"'<>`]+\/storage\/v1\/object\/sign\/[^\s"'<>`]+/g,
      '[SIGNED_URL_REDACTED]',
    )
    .replace(
      /https?:\/\/[^\s"'<>`]+[?&](X-Amz-Signature|token|signature|sig)=[^\s"'<>`]+/gi,
      '[SIGNED_URL_REDACTED]',
    )
    .replace(/Bearer\s+[A-Za-z0-9._-]{20,}/g, 'Bearer [REDACTED]')
    .replace(/sk-[A-Za-z0-9_-]{10,}/g, 'sk-[REDACTED]')
    .replace(/xai-[A-Za-z0-9_-]{10,}/g, 'xai-[REDACTED]')
    .replace(/(service_role|SERVICE_ROLE|api_key|API_KEY|private_key|PRIVATE_KEY|jwt_secret|JWT_SECRET|encryption_key|ENCRYPTION_KEY)(["'\s:=]+)[^"'\s,;}]+/g, '$1$2[REDACTED]')
    .replace(/eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '[JWT_REDACTED]')
    .replace(/-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g, '[PRIVATE_KEY_REDACTED]');
}
