import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

export type PieceKind = 'core' | 'community' | 'custom';

export type PieceRisk =
  | 'safe_by_default'
  | 'safe_with_workspace_policy'
  | 'requires_human_approval'
  | 'requires_admin_role'
  | 'advanced_only'
  | 'blocked_by_default'
  | 'forbidden_in_production'
  | 'unknown';

export type LexFrameExposure =
  | 'all_users'
  | 'workspace_policy'
  | 'approval_required'
  | 'advanced_users'
  | 'admin_only'
  | 'hidden'
  | 'blocked';

export type PieceImportMode =
  | 'library_import'
  | 'direct_reuse_mit'
  | 'activepieces_embedded'
  | 'activepieces_runtime_api'
  | 'wrapper'
  | 'fork_adapt'
  | 'blocked_security'
  | 'not_found';

export type PieceEntryType = 'action' | 'trigger';

export interface PieceInventoryEntry {
  readonly type: PieceEntryType;
  readonly name: string;
  readonly displayName: string | null;
  readonly description: string | null;
  readonly sourcePath: string;
  readonly sourceHash: string;
}

export interface PieceInventoryItem {
  readonly packageName: string;
  readonly packageVersion: string;
  readonly slug: string;
  readonly path: string;
  readonly kind: PieceKind;
  readonly displayName: string | null;
  readonly description: string | null;
  readonly authType: string;
  readonly actions: number;
  readonly triggers: number;
  readonly actionEntries: readonly PieceInventoryEntry[];
  readonly triggerEntries: readonly PieceInventoryEntry[];
  readonly categories: readonly string[];
  readonly risk: PieceRisk;
  readonly exposure: LexFrameExposure;
  readonly importMode: PieceImportMode;
  readonly notes: readonly string[];
  readonly sourceHash: string;
}

export interface PieceInventoryReport {
  readonly repoRoot: string;
  readonly generatedAt: string;
  readonly counts: {
    readonly core: number;
    readonly community: number;
    readonly custom: number;
    readonly total: number;
    readonly sourceActionFiles: number;
    readonly sourceTriggerFiles: number;
  };
  readonly pieces: readonly PieceInventoryItem[];
}

interface PackageJson {
  readonly name?: string;
  readonly version?: string;
}

const SAFE_CORE = new Set([
  'approval',
  'crypto',
  'csv',
  'data-mapper',
  'data-summarizer',
  'date-helper',
  'delay',
  'forms',
  'manual-trigger',
  'math-helper',
  'qrcode',
  'schedule',
  'store',
  'tags',
  'text-helper',
  'xml',
]);

const ADVANCED_CORE = new Set([
  'connections',
  'file-helper',
  'graphql',
  'http',
  'image-helper',
  'pdf',
  'sftp',
  'smtp',
  'subflows',
  'tables',
  'webhook',
]);

const AI_PROVIDERS = [
  'openai',
  'azure-openai',
  'anthropic',
  'claude',
  'google-gemini',
  'gemini',
  'google-vertex-ai',
  'amazon-bedrock',
  'bedrock',
  'cohere',
  'deepseek',
  'grok',
  'groq',
  'hugging-face',
  'perplexity',
  'replicate',
  'stability-ai',
  'elevenlabs',
  'assemblyai',
  'deepgram',
];

const DATABASE_PROVIDERS = [
  'postgres',
  'mysql',
  'mariadb',
  'mongodb',
  'supabase',
  'snowflake',
  'oracle-database',
  'bigquery',
  'redis',
  'clickhouse',
  'airtable',
];

const DELIVERY_PROVIDERS = [
  'gmail',
  'sendgrid',
  'resend',
  'mailchimp',
  'twilio',
  'telegram',
  'telegram-bot',
  'slack',
  'discord',
  'microsoft-teams',
  'whatsapp',
  'smtp',
];

const DOCUMENT_PROVIDERS = [
  'docusign',
  'pandadoc',
  'sign-now',
  'signrequest',
  'dropbox',
  'box',
  'google-drive',
  'google-docs',
  'onedrive',
  'sharepoint',
  'pdf',
  'airparser',
  'amazon-textract',
];

const DEVOPS_OR_EGRESS_PROVIDERS = [
  'http',
  'graphql',
  'soap',
  'sftp',
  'ftp',
  'amazon-s3',
  'github',
  'gitlab',
  'bitbucket',
  'apify',
  'firecrawl',
  'tavily',
  'browserless',
];

const FINANCE_PROVIDERS = [
  'stripe',
  'square',
  'quickbooks',
  'xero',
  'chargebee',
  'paddle',
  'paypal',
];

export function scanActivepiecesPieces(repoRoot: string): PieceInventoryReport {
  const absoluteRoot = path.resolve(repoRoot);
  const base = path.join(absoluteRoot, 'packages', 'pieces');
  const pieces: PieceInventoryItem[] = [];

  for (const kind of ['core', 'community', 'custom'] satisfies PieceKind[]) {
    const kindPath = path.join(base, kind);
    if (!fs.existsSync(kindPath)) {
      continue;
    }

    for (const dirent of fs.readdirSync(kindPath, { withFileTypes: true })) {
      if (!dirent.isDirectory()) {
        continue;
      }

      const piecePath = path.join(kindPath, dirent.name);
      const packageJsonPath = path.join(piecePath, 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        continue;
      }

      const packageJson = readJson<PackageJson>(packageJsonPath);
      const sourceRoot = path.join(piecePath, 'src');
      const sourceFiles = fs.existsSync(sourceRoot)
        ? walkFiles(sourceRoot)
            .filter((file) => file.endsWith('.ts'))
            .sort((left, right) => left.localeCompare(right))
        : [];
      const indexText = readTextIfExists(path.join(sourceRoot, 'index.ts'));
      const actionFiles = sourceFiles.filter(isActionFile);
      const triggerFiles = sourceFiles.filter(isTriggerFile);
      const slug = dirent.name;
      const classification = classifyPiece(slug, kind);
      const actionEntries = actionFiles.map((file) =>
        buildEntry(file, piecePath, 'action'),
      );
      const triggerEntries = triggerFiles.map((file) =>
        buildEntry(file, piecePath, 'trigger'),
      );

      pieces.push({
        packageName: packageJson.name ?? `@activepieces/piece-${slug}`,
        packageVersion: packageJson.version ?? '0.0.0',
        slug,
        path: normalizePath(path.relative(absoluteRoot, piecePath)),
        kind,
        displayName: extractStringProperty(indexText, 'displayName'),
        description: extractStringProperty(indexText, 'description'),
        authType: extractAuthType(indexText),
        actions: actionEntries.length,
        triggers: triggerEntries.length,
        actionEntries,
        triggerEntries,
        categories: extractCategories(indexText),
        risk: classification.risk,
        exposure: classification.exposure,
        importMode: classification.importMode,
        notes: classification.notes,
        sourceHash: hashFiles([
          packageJsonPath,
          path.join(piecePath, 'project.json'),
          ...sourceFiles,
        ]),
      });
    }
  }

  const counts = {
    core: pieces.filter((piece) => piece.kind === 'core').length,
    community: pieces.filter((piece) => piece.kind === 'community').length,
    custom: pieces.filter((piece) => piece.kind === 'custom').length,
    total: pieces.length,
    sourceActionFiles: pieces.reduce((sum, piece) => sum + piece.actions, 0),
    sourceTriggerFiles: pieces.reduce((sum, piece) => sum + piece.triggers, 0),
  };

  return {
    repoRoot: absoluteRoot,
    generatedAt: new Date().toISOString(),
    counts,
    pieces: pieces.sort((left, right) =>
      left.packageName.localeCompare(right.packageName),
    ),
  };
}

export function generatePiecesMarkdown(report: PieceInventoryReport): string {
  const lines = [
    '# Activepieces Pieces Inventory Report',
    '',
    `Archive root: \`${report.repoRoot}\``,
    `Generated at: \`${report.generatedAt}\``,
    '',
    '| Class | Count |',
    '|---|---:|',
    `| Core | ${report.counts.core} |`,
    `| Community | ${report.counts.community} |`,
    `| Custom | ${report.counts.custom} |`,
    `| Total | ${report.counts.total} |`,
    `| Source action files | ${report.counts.sourceActionFiles} |`,
    `| Source trigger files | ${report.counts.sourceTriggerFiles} |`,
    '',
    '| Piece | Path | Actions | Triggers | Auth | Risk | LexFrame exposure | Import mode |',
    '|---|---|---:|---:|---|---|---|---|',
  ];

  for (const piece of report.pieces) {
    lines.push(
      `| ${escapeCell(piece.packageName)} | \`${escapeCell(piece.path)}\` | ${piece.actions} | ${piece.triggers} | ${escapeCell(piece.authType)} | ${piece.risk} | ${piece.exposure} | ${piece.importMode} |`,
    );
  }

  return `${lines.join('\n')}\n`;
}

export function summarizePieces(report: PieceInventoryReport): string {
  return [
    `core=${report.counts.core}`,
    `community=${report.counts.community}`,
    `custom=${report.counts.custom}`,
    `total=${report.counts.total}`,
    `actions=${report.counts.sourceActionFiles}`,
    `triggers=${report.counts.sourceTriggerFiles}`,
  ].join(' ');
}

function classifyPiece(
  slug: string,
  kind: PieceKind,
): Pick<PieceInventoryItem, 'risk' | 'exposure' | 'importMode' | 'notes'> {
  const notes: string[] = [];

  if (kind === 'custom') {
    return {
      risk: 'requires_admin_role',
      exposure: 'admin_only',
      importMode: 'fork_adapt',
      notes: ['Custom pieces must be reviewed before tenant exposure.'],
    };
  }

  if (SAFE_CORE.has(slug)) {
    return {
      risk: 'safe_by_default',
      exposure: 'all_users',
      importMode: 'library_import',
      notes,
    };
  }

  if (ADVANCED_CORE.has(slug)) {
    notes.push('Core technical piece requires policy and observability gates.');
    return {
      risk: slug === 'http' || slug === 'graphql' || slug === 'webhook'
        ? 'advanced_only'
        : 'safe_with_workspace_policy',
      exposure: slug === 'http' || slug === 'graphql' || slug === 'webhook'
        ? 'advanced_users'
        : 'workspace_policy',
      importMode: 'wrapper',
      notes,
    };
  }

  if (matchesProvider(slug, AI_PROVIDERS)) {
    return {
      risk: 'blocked_by_default',
      exposure: 'blocked',
      importMode: 'wrapper',
      notes: ['Route through LexFrame AI gateway; do not store provider keys in Activepieces.'],
    };
  }

  if (matchesProvider(slug, DATABASE_PROVIDERS)) {
    return {
      risk: slug === 'supabase' ? 'forbidden_in_production' : 'requires_admin_role',
      exposure: slug === 'supabase' ? 'blocked' : 'admin_only',
      importMode: slug === 'supabase' ? 'blocked_security' : 'wrapper',
      notes: ['Use scoped backend tokens only; never pass privileged database credentials.'],
    };
  }

  if (matchesProvider(slug, DELIVERY_PROVIDERS)) {
    return {
      risk: 'requires_human_approval',
      exposure: 'approval_required',
      importMode: 'library_import',
      notes: ['External delivery requires approval, confirmation, and audit.'],
    };
  }

  if (matchesProvider(slug, DOCUMENT_PROVIDERS)) {
    return {
      risk: 'safe_with_workspace_policy',
      exposure: 'workspace_policy',
      importMode: 'library_import',
      notes: ['Route files through LexFrame document layer and DLP policy.'],
    };
  }

  if (matchesProvider(slug, DEVOPS_OR_EGRESS_PROVIDERS)) {
    return {
      risk: 'advanced_only',
      exposure: 'advanced_users',
      importMode: 'wrapper',
      notes: ['Requires SSRF, egress, and token-scope controls.'],
    };
  }

  if (matchesProvider(slug, FINANCE_PROVIDERS)) {
    return {
      risk: 'requires_admin_role',
      exposure: 'admin_only',
      importMode: 'library_import',
      notes: ['Finance/billing integrations require admin approval.'],
    };
  }

  return {
    risk: 'unknown',
    exposure: 'hidden',
    importMode: 'library_import',
    notes: ['Long-tail community integration needs provider-specific review.'],
  };
}

function matchesProvider(slug: string, providers: readonly string[]): boolean {
  return providers.some((provider) => {
    if (slug === provider) {
      return true;
    }
    return slug.startsWith(`${provider}-`) || slug.endsWith(`-${provider}`);
  });
}

function isActionFile(file: string): boolean {
  const normalized = normalizePath(file);
  return /\/actions?\//.test(normalized) || /\.action\.ts$/.test(normalized);
}

function isTriggerFile(file: string): boolean {
  const normalized = normalizePath(file);
  return /\/triggers?\//.test(normalized) || /\.trigger\.ts$/.test(normalized);
}

function extractStringProperty(source: string, property: string): string | null {
  const pattern = new RegExp(`${property}\\s*:\\s*(['"\`])([\\s\\S]*?)\\1`, 'm');
  const match = source.match(pattern);
  return match?.[2]?.trim() || null;
}

function extractAuthType(source: string): string {
  const authPatterns: Array<[RegExp, string]> = [
    [/PieceAuth\.OAuth2/i, 'oauth2'],
    [/PieceAuth\.SecretText/i, 'secret_text'],
    [/PieceAuth\.BasicAuth/i, 'basic_auth'],
    [/PieceAuth\.CustomAuth/i, 'custom_auth'],
    [/PieceAuth\.None/i, 'none'],
    [/auth\s*:\s*undefined/i, 'none'],
  ];

  for (const [pattern, authType] of authPatterns) {
    if (pattern.test(source)) {
      return authType;
    }
  }

  return source.includes('auth:') ? 'unknown_auth' : 'none';
}

function extractCategories(source: string): readonly string[] {
  const match = source.match(/categories\s*:\s*\[([\s\S]*?)\]/m);
  if (!match?.[1]) {
    return [];
  }

  const values = new Set<string>();
  for (const value of match[1].matchAll(/PieceCategory\.([A-Za-z0-9_]+)/g)) {
    if (value[1]) {
      values.add(value[1].toLowerCase());
    }
  }

  return [...values].sort();
}

function buildEntry(
  file: string,
  piecePath: string,
  type: PieceEntryType,
): PieceInventoryEntry {
  const source = readTextIfExists(file);
  const relative = normalizePath(path.relative(piecePath, file));
  const basename = path.basename(file).replace(/\.ts$/, '');
  const rawName =
    extractStringProperty(source, 'name') ??
    extractExportName(source) ??
    basename
      .replace(/\.action$/, '')
      .replace(/\.trigger$/, '')
      .replace(/-action$/, '')
      .replace(/-trigger$/, '');

  return {
    type,
    name: normalizeEntryName(rawName),
    displayName: extractStringProperty(source, 'displayName'),
    description: extractStringProperty(source, 'description'),
    sourcePath: relative,
    sourceHash: hashText(source),
  };
}

function extractExportName(source: string): string | null {
  const match = source.match(/export\s+const\s+([A-Za-z0-9_]+)/);
  return match?.[1] ?? null;
}

function normalizeEntryName(value: string): string {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

function readTextIfExists(file: string): string {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function walkFiles(root: string): string[] {
  const files: string[] = [];
  for (const dirent of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, dirent.name);
    if (dirent.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function hashFiles(files: readonly string[]): string {
  const hash = crypto.createHash('sha256');
  for (const file of files) {
    if (!fs.existsSync(file)) {
      continue;
    }
    hash.update(normalizePath(file));
    hash.update('\0');
    hash.update(fs.readFileSync(file));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function hashText(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/');
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}
