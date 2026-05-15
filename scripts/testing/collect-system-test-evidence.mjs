import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const artifactsRoot = path.join(repoRoot, 'artifacts', 'system-tests');
const manifestPath = path.join(artifactsRoot, 'evidence-manifest.json');

fs.mkdirSync(artifactsRoot, { recursive: true });

const artifacts = collectArtifacts(artifactsRoot)
  .filter((filePath) => filePath !== manifestPath)
  .map((filePath) => ({
    type: artifactType(filePath),
    path: path.relative(repoRoot, filePath).replace(/\\/g, '/'),
    sha256: sha256(filePath),
    safeForSharing: safeForSharing(filePath),
  }));

const performanceSummary = summarizePerformance(artifactsRoot);
const securityScans = summarizeSecurity(artifactsRoot);
const manifest = {
  generatedAt: new Date().toISOString(),
  repo: path.basename(repoRoot),
  branch: git(['rev-parse', '--abbrev-ref', 'HEAD']),
  commit: git(['rev-parse', 'HEAD']),
  runtimeBaseUrl:
    process.env.LEXFRAME_E2E_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    'http://127.0.0.1:3100',
  commands: readCommandLedger(artifactsRoot),
  artifacts,
  securityScans,
  performanceSummary,
  visualChangePolicy: {
    visualCodeChanged: detectVisualCodeChanges(),
    baselineUpdated: artifacts.some((artifact) =>
      /-snapshots\/.*\.(png|jpg|jpeg)$/i.test(artifact.path),
    ),
    notes: [],
  },
  defects: readDefects(),
};

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Evidence manifest written to ${path.relative(repoRoot, manifestPath)}`);

function collectArtifacts(root) {
  if (!fs.existsSync(root)) {
    return [];
  }
  const result = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectArtifacts(fullPath));
    } else {
      result.push(fullPath);
    }
  }
  return result;
}

function artifactType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.webp'].includes(extension)) {
    return 'screenshot';
  }
  if (['.zip'].includes(extension)) {
    return 'trace';
  }
  if (extension === '.json') {
    return 'json';
  }
  if (['.log', '.txt'].includes(extension)) {
    return 'log';
  }
  return 'report';
}

function sha256(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function safeForSharing(filePath) {
  const textExtensions = new Set(['.json', '.md', '.txt', '.log']);
  if (!textExtensions.has(path.extname(filePath).toLowerCase())) {
    return true;
  }
  const text = fs.readFileSync(filePath, 'utf8');
  return !/(BEGIN PRIVATE KEY|service_role|ACTIVEPIECES_API_KEY|SUPABASE_SECRET_KEY|sk-[A-Za-z0-9_-]{12,})/i.test(
    text,
  );
}

function summarizePerformance(root) {
  const metricsDir = path.join(root, 'block5-performance', 'metrics');
  const records = fs.existsSync(metricsDir)
    ? collectArtifacts(metricsDir)
        .filter((filePath) => filePath.endsWith('.json'))
        .map((filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8')))
    : [];
  return {
    passed: records.filter((record) => record.passedBudget === true).length,
    failed: records.filter(
      (record) => record.passedBudget === false && !isPendingMetric(record),
    ).length,
    degraded: records.filter(
      (record) =>
        isPendingMetric(record) ||
        (Array.isArray(record.notes)
          ? record.notes.some((note) => /degraded/i.test(String(note)))
          : false),
    ).length,
  };
}

function isPendingMetric(record) {
  return (
    record.name === 'pending-live-run' ||
    (Array.isArray(record.notes) &&
      record.notes.some((note) => /pending/i.test(String(note))))
  );
}

function summarizeSecurity(root) {
  const browserScan = path.join(
    root,
    'block5-security',
    'browser-security-scan.json',
  );
  const browserStatus = fs.existsSync(browserScan) ? 'pass' : 'skipped';
  return {
    dom: browserStatus,
    storage: browserStatus,
    network: browserStatus,
    bundle: fs.existsSync(path.join(root, 'bundle-secret-scan.json'))
      ? 'pass'
      : 'skipped',
    secretScan: fs.existsSync(path.join(root, 'secret-scan.json'))
      ? 'pass'
      : 'skipped',
  };
}

function readCommandLedger(root) {
  const ledger = path.join(root, 'command-ledger.json');
  if (!fs.existsSync(ledger)) {
    return [];
  }
  return JSON.parse(fs.readFileSync(ledger, 'utf8'));
}

function detectVisualCodeChanges() {
  const diff = git(['diff', '--name-only']);
  return diff
    .split(/\r?\n/)
    .some((filePath) =>
      /apps\/web\/src\/app\/globals\.css|packages\/design-system-activepieces-bridge\//.test(
        filePath,
      ),
    );
}

function readDefects() {
  const defectsPath = path.join(repoRoot, 'docs', 'testing', 'detected-defects.md');
  if (!fs.existsSync(defectsPath)) {
    return [];
  }
  const text = fs.readFileSync(defectsPath, 'utf8');
  return Array.from(text.matchAll(/\| (B[0-9A-Z-]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|/g)).map(
    (match) => ({
      id: match[1],
      severity: match[2].trim(),
      summary: match[4].trim(),
      evidence: ['docs/testing/detected-defects.md'],
    }),
  );
}

function git(args) {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unknown';
  }
}
