import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const artifactsRoot = path.join(repoRoot, 'artifacts', 'system-tests');
const outputPath = path.join(artifactsRoot, 'system-test-report-summary.json');

fs.mkdirSync(artifactsRoot, { recursive: true });

const playwrightResults = readJson(
  path.join(repoRoot, 'tests', 'e2e', 'playwright-report', 'results.json'),
) ?? { suites: [] };
const metrics = collectJson(path.join(artifactsRoot, 'block5-performance', 'metrics'));
const security = readJson(
  path.join(artifactsRoot, 'block5-security', 'browser-security-scan.json'),
);

const summary = {
  generatedAt: new Date().toISOString(),
  playwright: summarizePlaywright(playwrightResults),
  performance: {
    total: metrics.length,
    passed: metrics.filter((metric) => metric.passedBudget === true).length,
    failed: metrics.filter((metric) => metric.passedBudget === false).length,
  },
  security: security
    ? {
        dom: security.dom?.status ?? 'unknown',
        storage: security.storage?.status ?? 'unknown',
        console: security.console?.status ?? 'unknown',
        networkForbiddenHosts:
          security.network?.forbiddenHosts?.length ??
          security.snapshot?.forbiddenHosts?.length ??
          0,
      }
    : { status: 'missing' },
};

fs.writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
console.log(`Merged system-test report written to ${path.relative(repoRoot, outputPath)}`);

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function collectJson(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((entry) => entry.endsWith('.json'))
    .map((entry) => readJson(path.join(dir, entry)))
    .filter(Boolean);
}

function summarizePlaywright(results) {
  const stats = { passed: 0, failed: 0, skipped: 0, timedOut: 0 };
  walkSuites(results.suites ?? [], stats);
  return stats;
}

function walkSuites(suites, stats) {
  for (const suite of suites) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const status = test.results?.at(-1)?.status ?? 'skipped';
        if (status === 'passed') {
          stats.passed += 1;
        } else if (status === 'timedOut') {
          stats.timedOut += 1;
        } else if (status === 'skipped') {
          stats.skipped += 1;
        } else {
          stats.failed += 1;
        }
      }
    }
    walkSuites(suite.suites ?? [], stats);
  }
}
