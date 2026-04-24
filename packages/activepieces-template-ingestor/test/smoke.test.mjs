import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import ingestorModule from '../dist/index.js';

const {
  generateTemplateIngestionMarkdown,
  scanActivepiecesTemplateSources,
  summarizeTemplateSources,
} = ingestorModule;

test('detects importable local Activepieces flow templates', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lexframe-templates-'));
  const templateDir = path.join(root, 'templates');
  fs.mkdirSync(templateDir, { recursive: true });
  fs.writeFileSync(
    path.join(templateDir, 'example-flow.json'),
    JSON.stringify({
      displayName: 'Notify reviewer',
      schemaVersion: '20',
      valid: true,
      trigger: {
        name: 'trigger',
        displayName: 'Manual Trigger',
        type: 'PIECE_TRIGGER',
        settings: {
          pieceName: '@activepieces/piece-manual-trigger',
        },
        nextAction: {
          name: 'notify',
          displayName: 'Notify',
          type: 'PIECE',
          settings: {
            pieceName: '@activepieces/piece-slack',
            connectionName: 'slack_workspace',
          },
        },
      },
    }),
  );

  const report = scanActivepiecesTemplateSources(root);
  const localFlow = report.sources.find(
    (source) => source.sourcePath === 'templates/example-flow.json',
  );

  assert.ok(localFlow);
  assert.equal(localFlow.sourceType, 'local_flow_json');
  assert.equal(localFlow.importable, true);
  assert.deepEqual(localFlow.requiredPieces, [
    '@activepieces/piece-manual-trigger',
    '@activepieces/piece-slack',
  ]);
  assert.deepEqual(localFlow.requiredConnections, ['slack_workspace']);
  assert.equal(report.counts.sources, 2);
  assert.match(generateTemplateIngestionMarkdown(report), /Notify reviewer|local_flow_json/);
  assert.match(summarizeTemplateSources(report), /sources=2/);
});
