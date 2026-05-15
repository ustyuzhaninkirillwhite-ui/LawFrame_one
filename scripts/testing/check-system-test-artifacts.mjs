import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const artifactsRoot = path.join(repoRoot, 'artifacts', 'system-tests');
const required = [
  'evidence-manifest.json',
  'block5-performance',
  'block5-performance/metrics',
  'block5-security',
  'block5-visual',
];

const missing = required.filter(
  (relativePath) => !fs.existsSync(path.join(artifactsRoot, relativePath)),
);

if (missing.length > 0) {
  console.error(`Missing system-test artifacts: ${missing.join(', ')}`);
  process.exit(1);
}

const manifest = JSON.parse(
  fs.readFileSync(path.join(artifactsRoot, 'evidence-manifest.json'), 'utf8'),
);
const artifacts = Array.isArray(manifest.artifacts) ? manifest.artifacts : [];
const unsafe = artifacts.filter((artifact) => artifact.safeForSharing === false);

if (unsafe.length > 0) {
  console.error(
    `Unsafe artifacts detected: ${unsafe.map((artifact) => artifact.path).join(', ')}`,
  );
  process.exit(1);
}

console.log('System-test artifact structure is present and sharing-safe.');
