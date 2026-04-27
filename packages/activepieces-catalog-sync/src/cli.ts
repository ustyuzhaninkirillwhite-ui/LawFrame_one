import { spawnSync } from 'node:child_process';
import {
  scanActivepiecesPieces,
  summarizePieces,
} from '@lexframe/activepieces-inventory';
import {
  generateCatalogSyncSql,
  summarizeCatalogSync,
} from './index';

declare const process: {
  argv: string[];
  env: Record<string, string | undefined>;
  exitCode?: number;
};

declare const console: {
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

const args = process.argv.slice(2);
const repoRoot =
  readArg('--repo-root') ??
  readArg('--pieces-root') ??
  process.env.ACTIVEPIECES_REPO_ROOT ??
  '/activepieces';
const sourceImageTag =
  readArg('--source-image-tag') ??
  process.env.ACTIVEPIECES_SOURCE_IMAGE_TAG ??
  'activepieces/activepieces:0.44.0';
const shouldApply = args.includes('--apply');
const shouldPrintSql = args.includes('--sql');
const shouldPrintJson = args.includes('--json');

try {
  const report = scanActivepiecesPieces(repoRoot);
  const sql = generateCatalogSyncSql(report, { sourceImageTag });
  const summary = summarizeCatalogSync(report, { sourceImageTag });

  if (shouldPrintSql) {
    console.log(sql);
  }

  if (shouldPrintJson) {
    console.log(JSON.stringify({ inventory: report.counts, sync: summary }, null, 2));
  } else {
    console.log(`[activepieces-catalog-sync] inventory ${summarizePieces(report)}`);
    console.log(
      `[activepieces-catalog-sync] sync pieces=${summary.pieces} entries=${summary.entries} actions=${summary.actions} triggers=${summary.triggers} blocked=${summary.blockedEntries}`,
    );
  }

  if (shouldApply) {
    const databaseUrl =
      process.env.ACTIVEPIECES_CATALOG_DATABASE_URL ??
      process.env.SUPABASE_DB_URL ??
      process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error(
        'ACTIVEPIECES_CATALOG_DATABASE_URL, SUPABASE_DB_URL, or DATABASE_URL is required for --apply.',
      );
    }
    const result = spawnSync(
      'psql',
      [databaseUrl, '-v', 'ON_ERROR_STOP=1'],
      {
        input: sql,
        encoding: 'utf8',
        stdio: ['pipe', 'inherit', 'inherit'],
        shell: false,
      },
    );
    if (result.status !== 0) {
      throw new Error(`psql catalog sync failed with exit ${result.status}`);
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

function readArg(name: string) {
  const index = args.indexOf(name);
  if (index < 0) {
    return null;
  }
  const value = args[index + 1];
  return value && !value.startsWith('--') ? value : null;
}
