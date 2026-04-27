import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import inventoryModule from '../../activepieces-inventory/dist/index.js';
import syncModule from '../dist/index.js';

const { scanActivepiecesPieces } = inventoryModule;
const { generateCatalogSyncSql, summarizeCatalogSync } = syncModule;

test('generates idempotent catalog SQL for Activepieces entries', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lexframe-catalog-'));
  const pieceRoot = path.join(root, 'packages', 'pieces', 'community', 'delay');
  fs.mkdirSync(path.join(pieceRoot, 'src', 'lib', 'actions'), { recursive: true });
  fs.writeFileSync(
    path.join(pieceRoot, 'package.json'),
    JSON.stringify({ name: '@activepieces/piece-delay', version: '1.0.0' }),
  );
  fs.writeFileSync(
    path.join(pieceRoot, 'src', 'index.ts'),
    [
      "export const delay = createPiece({",
      "  displayName: 'Delay',",
      "  description: 'Wait before continuing.',",
      '  auth: PieceAuth.None,',
      '});',
      '',
    ].join('\n'),
  );
  fs.writeFileSync(
    path.join(pieceRoot, 'src', 'lib', 'actions', 'wait-for.ts'),
    [
      "export const waitFor = createAction({",
      "  displayName: 'Wait for duration',",
      "  description: 'Pauses execution.',",
      '});',
      '',
    ].join('\n'),
  );

  const report = scanActivepiecesPieces(root);
  const summary = summarizeCatalogSync(report, {
    sourceImageTag: 'activepieces/activepieces:0.44.0',
  });
  const sql = generateCatalogSyncSql(report, {
    sourceImageTag: 'activepieces/activepieces:0.44.0',
  });

  assert.equal(summary.pieces, 1);
  assert.equal(summary.actions, 1);
  assert.match(sql, /activepieces_piece_registry/);
  assert.match(sql, /activepieces_action_registry/);
  assert.match(sql, /ap\.delay\.action\.wait_for/);
});
