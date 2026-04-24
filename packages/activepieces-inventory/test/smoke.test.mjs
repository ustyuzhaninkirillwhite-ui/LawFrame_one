import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import inventoryModule from '../dist/index.js';

const { generatePiecesMarkdown, scanActivepiecesPieces, summarizePieces } = inventoryModule;

test('scans a minimal Activepieces piece repository layout', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lexframe-pieces-'));
  const pieceRoot = path.join(root, 'packages', 'pieces', 'core', 'text-helper');
  fs.mkdirSync(path.join(pieceRoot, 'src', 'lib', 'actions'), { recursive: true });
  fs.writeFileSync(
    path.join(pieceRoot, 'package.json'),
    JSON.stringify({ name: '@activepieces/piece-text-helper' }),
  );
  fs.writeFileSync(
    path.join(pieceRoot, 'src', 'index.ts'),
    [
      "export const textHelper = {",
      "  displayName: 'Text Helper',",
      "  description: 'Formats legal text snippets.',",
      '  auth: PieceAuth.None,',
      '};',
      '',
    ].join('\n'),
  );
  fs.writeFileSync(
    path.join(pieceRoot, 'src', 'lib', 'actions', 'format.action.ts'),
    'export const formatText = {};\n',
  );

  const report = scanActivepiecesPieces(root);
  const markdown = generatePiecesMarkdown(report);

  assert.equal(report.counts.total, 1);
  assert.equal(report.counts.core, 1);
  assert.equal(report.counts.sourceActionFiles, 1);
  assert.equal(report.pieces[0].packageName, '@activepieces/piece-text-helper');
  assert.equal(report.pieces[0].risk, 'safe_by_default');
  assert.match(markdown, /Activepieces Pieces Inventory Report/);
  assert.match(summarizePieces(report), /total=1/);
});
