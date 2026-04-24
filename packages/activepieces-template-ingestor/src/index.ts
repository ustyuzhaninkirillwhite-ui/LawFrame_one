import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export type TemplateSourceType =
  | 'local_template_json'
  | 'local_flow_json'
  | 'docs_example'
  | 'test_fixture'
  | 'cloud_proxy'
  | 'unknown_json';

export type TemplateImportMode =
  | 'library_import'
  | 'metadata_only'
  | 'manual_review'
  | 'blocked_license'
  | 'not_importable';

export interface TemplateSourceRecord {
  readonly sourcePath: string;
  readonly sourceType: TemplateSourceType;
  readonly hash: string;
  readonly requiredPieces: readonly string[];
  readonly requiredConnections: readonly string[];
  readonly importable: boolean;
  readonly importMode: TemplateImportMode;
  readonly risk: string;
  readonly licenseNote: string;
  readonly lexFrameCategory: string;
  readonly blockers: readonly string[];
}

export interface TemplateIngestionReport {
  readonly repoRoot: string;
  readonly generatedAt: string;
  readonly counts: {
    readonly sources: number;
    readonly importable: number;
    readonly blocked: number;
    readonly licenseUnclear: number;
    readonly missingPiecesUnknown: number;
  };
  readonly sources: readonly TemplateSourceRecord[];
}

export function scanActivepiecesTemplateSources(
  repoRoot: string,
): TemplateIngestionReport {
  const absoluteRoot = path.resolve(repoRoot);
  const sources: TemplateSourceRecord[] = [];

  for (const file of walkFiles(absoluteRoot)) {
    const relativePath = normalizePath(path.relative(absoluteRoot, file));
    if (!shouldScanFile(relativePath)) {
      continue;
    }

    const text = fs.readFileSync(file, 'utf8');
    if (file.endsWith('.json')) {
      const record = inspectJsonSource(relativePath, text);
      if (record) {
        sources.push(record);
      }
      continue;
    }

    if (file.endsWith('.md') || file.endsWith('.mdx')) {
      sources.push(...inspectMarkdownJsonSnippets(relativePath, text));
    }
  }

  sources.push(buildCloudProxyRecord());

  const counts = {
    sources: sources.length,
    importable: sources.filter((source) => source.importable).length,
    blocked: sources.filter((source) => source.importMode === 'blocked_license' || source.importMode === 'not_importable').length,
    licenseUnclear: sources.filter((source) =>
      source.licenseNote.includes('needs legal confirmation'),
    ).length,
    missingPiecesUnknown: sources.filter((source) =>
      source.blockers.includes('unknown or missing piece dependencies'),
    ).length,
  };

  return {
    repoRoot: absoluteRoot,
    generatedAt: new Date().toISOString(),
    counts,
    sources: sources.sort((left, right) =>
      left.sourcePath.localeCompare(right.sourcePath),
    ),
  };
}

export function generateTemplateIngestionMarkdown(
  report: TemplateIngestionReport,
): string {
  const lines = [
    '# Activepieces Template Ingestion Report',
    '',
    `Archive root: \`${report.repoRoot}\``,
    `Generated at: \`${report.generatedAt}\``,
    '',
    '| Metric | Count |',
    '|---|---:|',
    `| Sources | ${report.counts.sources} |`,
    `| Importable | ${report.counts.importable} |`,
    `| Blocked | ${report.counts.blocked} |`,
    `| License unclear | ${report.counts.licenseUnclear} |`,
    `| Missing/unknown pieces | ${report.counts.missingPiecesUnknown} |`,
    '',
    '| Template/source | Path | Required pieces | Importable | Risk | License note | LexFrame category |',
    '|---|---|---|---|---|---|---|',
  ];

  for (const source of report.sources) {
    lines.push(
      `| ${source.sourceType} | \`${escapeCell(source.sourcePath)}\` | ${escapeCell(source.requiredPieces.join(', ') || 'none detected')} | ${source.importable ? 'yes' : 'no'} | ${escapeCell(source.risk)} | ${escapeCell(source.licenseNote)} | ${escapeCell(source.lexFrameCategory)} |`,
    );
  }

  return `${lines.join('\n')}\n`;
}

export function summarizeTemplateSources(report: TemplateIngestionReport): string {
  return [
    `sources=${report.counts.sources}`,
    `importable=${report.counts.importable}`,
    `blocked=${report.counts.blocked}`,
    `licenseUnclear=${report.counts.licenseUnclear}`,
    `missingPiecesUnknown=${report.counts.missingPiecesUnknown}`,
  ].join(' ');
}

function inspectJsonSource(
  relativePath: string,
  text: string,
): TemplateSourceRecord | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  if (!looksLikeActivepiecesTemplate(parsed) && !looksLikeActivepiecesFlow(parsed)) {
    return null;
  }

  const requiredPieces = extractRequiredPieces(parsed);
  const sourceType = classifyJsonSource(relativePath, parsed);
  return {
    sourcePath: relativePath,
    sourceType,
    hash: sha256(text),
    requiredPieces,
    requiredConnections: extractRequiredConnections(parsed),
    importable: sourceType !== 'unknown_json',
    importMode: sourceType === 'unknown_json' ? 'manual_review' : 'library_import',
    risk: classifyRisk(requiredPieces),
    licenseNote: 'covered by local repository license unless source file says otherwise',
    lexFrameCategory: inferCategory(requiredPieces),
    blockers: requiredPieces.length === 0
      ? ['unknown or missing piece dependencies']
      : [],
  };
}

function inspectMarkdownJsonSnippets(
  relativePath: string,
  text: string,
): TemplateSourceRecord[] {
  const records: TemplateSourceRecord[] = [];
  const snippets = text.matchAll(/```json\s*([\s\S]*?)```/g);
  let index = 0;

  for (const snippet of snippets) {
    index += 1;
    const json = snippet[1];
    if (!json) {
      continue;
    }
    const record = inspectJsonSource(`${relativePath}#json-${index}`, json);
    if (record) {
      records.push({
        ...record,
        sourceType: 'docs_example',
        importMode: 'manual_review',
        licenseNote: 'docs example; import after executable-template review',
      });
    }
  }

  return records;
}

function buildCloudProxyRecord(): TemplateSourceRecord {
  return {
    sourcePath: 'packages/server/api/src/app/template/community-templates.service.ts',
    sourceType: 'cloud_proxy',
    hash: 'cloud-activepieces-template-api',
    requiredPieces: [],
    requiredConnections: [],
    importable: false,
    importMode: 'metadata_only',
    risk: 'unknown cloud payload risk',
    licenseNote: 'needs legal confirmation before copying or redistributing cloud templates',
    lexFrameCategory: 'External Template Metadata',
    blockers: ['cloud payload terms are not repository source license'],
  };
}

function classifyJsonSource(relativePath: string, value: unknown): TemplateSourceType {
  const lower = relativePath.toLowerCase();
  if (lower.includes('fixture') || lower.includes('test')) {
    return 'test_fixture';
  }
  if (looksLikeActivepiecesTemplate(value)) {
    return 'local_template_json';
  }
  if (looksLikeActivepiecesFlow(value)) {
    return 'local_flow_json';
  }
  return 'unknown_json';
}

function looksLikeActivepiecesTemplate(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return (
    Array.isArray(value.flows) ||
    isRecord(value.template) ||
    (typeof value.name === 'string' && isRecord(value.flow))
  );
}

function looksLikeActivepiecesFlow(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isRecord(value.trigger) &&
    (typeof value.schemaVersion === 'string' ||
      typeof value.displayName === 'string' ||
      typeof value.valid === 'boolean')
  );
}

function extractRequiredPieces(value: unknown): readonly string[] {
  const pieces = new Set<string>();
  visit(value, (key, current) => {
    if (key === 'pieceName' && typeof current === 'string') {
      pieces.add(current);
    }
    if (
      typeof current === 'string' &&
      current.startsWith('@activepieces/piece-')
    ) {
      pieces.add(current);
    }
  });
  return [...pieces].sort();
}

function extractRequiredConnections(value: unknown): readonly string[] {
  const connections = new Set<string>();
  visit(value, (key, current) => {
    if (
      (key === 'connectionName' || key === 'connectionId') &&
      typeof current === 'string'
    ) {
      connections.add(current);
    }
  });
  return [...connections].sort();
}

function classifyRisk(requiredPieces: readonly string[]): string {
  const joined = requiredPieces.join(' ');
  if (/supabase|postgres|mysql|mongodb|snowflake|bigquery/.test(joined)) {
    return 'database/admin-only';
  }
  if (/openai|anthropic|claude|gemini|bedrock|cohere|perplexity/.test(joined)) {
    return 'ai-gateway-required';
  }
  if (/gmail|slack|telegram|twilio|sendgrid|smtp|whatsapp/.test(joined)) {
    return 'external-delivery-approval';
  }
  if (/http|graphql|webhook|sftp|firecrawl|apify|tavily/.test(joined)) {
    return 'advanced-egress-policy';
  }
  return requiredPieces.length > 0 ? 'standard-policy-review' : 'unknown';
}

function inferCategory(requiredPieces: readonly string[]): string {
  const joined = requiredPieces.join(' ');
  if (/docusign|pandadoc|pdf|google-docs|google-drive|dropbox|box/.test(joined)) {
    return 'Document Operations';
  }
  if (/gmail|slack|telegram|twilio|sendgrid|smtp|whatsapp/.test(joined)) {
    return 'Delivery And Notifications';
  }
  if (/openai|anthropic|claude|gemini|bedrock|cohere|perplexity/.test(joined)) {
    return 'AI-Assisted Automation';
  }
  if (/postgres|mysql|mongodb|supabase|snowflake|bigquery/.test(joined)) {
    return 'Data Integrations';
  }
  return 'Technical Integrations';
}

function shouldScanFile(relativePath: string): boolean {
  const lower = relativePath.toLowerCase();
  if (
    lower.includes('/node_modules/') ||
    lower.includes('/dist/') ||
    lower.includes('/.git/') ||
    lower.includes('/src/i18n/') ||
    lower.endsWith('package-lock.json') ||
    lower.endsWith('pnpm-lock.yaml') ||
    lower.endsWith('bun.lock')
  ) {
    return false;
  }

  if (lower.endsWith('.json')) {
    return /template|flow|example|fixture|seed|starter/.test(lower);
  }

  return lower.endsWith('.md') || lower.endsWith('.mdx');
}

function visit(
  value: unknown,
  visitor: (key: string, current: unknown) => void,
  key = '',
): void {
  visitor(key, value);
  if (Array.isArray(value)) {
    for (const item of value) {
      visit(item, visitor);
    }
    return;
  }
  if (isRecord(value)) {
    for (const [childKey, childValue] of Object.entries(value)) {
      visit(childValue, visitor, childKey);
    }
  }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/');
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}
