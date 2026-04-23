import type {
  DocumentGenerationInput,
  DocumentStructureSection,
  DocumentSummary,
  DocumentTemplateMapping,
  DocumentTemplatePlaceholder,
  DocumentValidationIssue,
  PhraseRuleSummary,
} from '@lexframe/contracts';
import type { LexframeRequest } from '../../common/types/lexframe-request';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { createHash } from 'node:crypto';

export interface RequestMeta {
  readonly requestId: string | null;
  readonly traceId: string | null;
}

export function requestMeta(request: LexframeRequest): RequestMeta {
  return {
    requestId: request.requestId ?? request.headers['x-request-id'] ?? null,
    traceId: request.traceId ?? request.headers['x-trace-id'] ?? null,
  };
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Request body must be a JSON object.',
    );
  }

  return value as Record<string, unknown>;
}

export function expectString(value: unknown, message: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AppHttpException('VALIDATION_ERROR', 400, message);
  }

  return value.trim();
}

export function optionalString(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Expected a string or null value.',
    );
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function optionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'boolean') {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Expected a boolean value.',
    );
  }

  return value;
}

export function optionalNumber(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Expected a numeric value.',
    );
  }

  return value;
}

export function optionalRecord(
  value: unknown,
): Record<string, unknown> | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return asRecord(value);
}

export function stringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Expected an array of strings.',
    );
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function optionalStringArray(
  value: unknown,
): readonly string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  return stringArray(value);
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

export function hashJson(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

export function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortJson(entry));
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;

    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        accumulator[key] = sortJson(record[key]);
        return accumulator;
      }, {});
  }

  return value;
}

export function deepMerge<T>(
  base: T,
  overlay: unknown,
  lockedPaths: readonly string[] = [],
  currentPath = '',
): T {
  if (overlay === undefined) {
    return base;
  }

  if (lockedPaths.includes(currentPath)) {
    return base;
  }

  if (Array.isArray(base) && Array.isArray(overlay)) {
    return overlay as T;
  }

  if (isPlainObject(base) && isPlainObject(overlay)) {
    const output: Record<string, unknown> = {
      ...(base as Record<string, unknown>),
    };

    for (const [key, value] of Object.entries(overlay)) {
      const nextPath = currentPath.length > 0 ? `${currentPath}.${key}` : key;
      output[key] =
        key in output
          ? deepMerge(output[key], value, lockedPaths, nextPath)
          : value;
    }

    return output as T;
  }

  return overlay as T;
}

export function extractLockedPaths(value: unknown): readonly string[] {
  if (!isPlainObject(value)) {
    return [];
  }

  const meta = (value as Record<string, unknown>).meta;

  if (!isPlainObject(meta) || !Array.isArray(meta.lockedPaths)) {
    return [];
  }

  return meta.lockedPaths.filter(
    (entry): entry is string =>
      typeof entry === 'string' && entry.trim().length > 0,
  );
}

export function getByPath(source: unknown, path: string): unknown {
  if (path.trim().length === 0) {
    return undefined;
  }

  const segments = path.split('.').filter((segment) => segment.length > 0);
  let current: unknown = source;

  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = Number(segment);

      if (!Number.isInteger(index)) {
        return undefined;
      }

      current = current[index];
      continue;
    }

    if (!isPlainObject(current)) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

export function buildGenerationContext(input: {
  readonly profile: Record<string, unknown>;
  readonly generationInput: DocumentGenerationInput;
  readonly documentType?: Record<string, unknown> | null;
  readonly clauseLibrary?: Record<string, unknown> | null;
}) {
  return {
    profile: input.profile,
    input: input.generationInput,
    facts: input.generationInput.facts ?? {},
    params: input.generationInput.params ?? {},
    documentType: input.documentType ?? {},
    clauses: input.clauseLibrary ?? {},
  } as const;
}

export function evaluateMappings(
  mappings: readonly DocumentTemplateMapping[],
  context: Record<string, unknown>,
) {
  const resolved: Record<string, unknown> = {};
  const missing: string[] = [];

  for (const mapping of mappings) {
    const candidate = getByPath(context, mapping.sourcePath);
    const value =
      candidate === undefined || candidate === null || candidate === ''
        ? (mapping.fallbackValue ?? null)
        : candidate;

    resolved[mapping.placeholderCode] = value;

    if (
      mapping.required &&
      (value === null || value === undefined || value === '')
    ) {
      missing.push(mapping.placeholderCode);
    }
  }

  return {
    resolved,
    missing,
  };
}

export function extractPlaceholders(
  source: string,
): readonly DocumentTemplatePlaceholder[] {
  const matches = new Set<string>();
  const pattern = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;
  let current: RegExpExecArray | null = null;

  while ((current = pattern.exec(source)) !== null) {
    matches.add(current[1]!);
  }

  return [...matches].map((code) => ({
    code,
    label: code,
    required: true,
    sourceType: code.startsWith('profile.')
      ? 'profile'
      : code.startsWith('clause.')
        ? 'clause'
        : code.startsWith('documentType.')
          ? 'document_type'
          : 'fact',
    exampleValue: null,
  }));
}

export function validateGeneratedDocument(input: {
  readonly placeholders: readonly DocumentTemplatePlaceholder[];
  readonly missingFieldCodes: readonly string[];
  readonly phraseRules: readonly PhraseRuleSummary[];
  readonly renderedText: string;
  readonly documentTypeSections?: readonly DocumentStructureSection[];
  readonly approvalRouteBound?: boolean;
}): readonly Omit<DocumentValidationIssue, 'id' | 'resolved'>[] {
  const issues: Omit<DocumentValidationIssue, 'id' | 'resolved'>[] = [];

  for (const fieldCode of input.missingFieldCodes) {
    issues.push({
      code: 'missing_field',
      severity: 'error',
      path: `mapping.${fieldCode}`,
      message: `Required field "${fieldCode}" is missing.`,
      suggestedFix: 'Fill the mapped input value or add a fallback.',
    });
  }

  for (const placeholder of input.placeholders) {
    if (input.renderedText.includes(`{{${placeholder.code}}}`)) {
      issues.push({
        code: 'unresolved_placeholder',
        severity: 'error',
        path: `placeholder.${placeholder.code}`,
        message: `Placeholder "${placeholder.code}" stayed unresolved in the rendered preview.`,
        suggestedFix: 'Check placeholder mapping or provide fallback data.',
      });
    }
  }

  for (const rule of input.phraseRules.filter(
    (entry) => entry.ruleType === 'forbidden',
  )) {
    if (input.renderedText.toLowerCase().includes(rule.phrase.toLowerCase())) {
      issues.push({
        code: 'forbidden_phrase',
        severity: 'warning',
        path: 'content',
        message: `Forbidden phrase detected: "${rule.phrase}".`,
        suggestedFix:
          rule.rationale ?? 'Replace the phrase with an approved alternative.',
      });
    }
  }

  for (const section of input.documentTypeSections ?? []) {
    if (
      section.required &&
      !input.renderedText.toLowerCase().includes(section.title.toLowerCase())
    ) {
      issues.push({
        code: 'required_section_missing',
        severity: 'warning',
        path: `section.${section.sectionId}`,
        message: `Required section "${section.title}" is not represented in the rendered content.`,
        suggestedFix:
          'Ensure the template or input produces the required section.',
      });
    }
  }

  if (!input.approvalRouteBound) {
    issues.push({
      code: 'approval_route_missing',
      severity: 'info',
      path: 'approval',
      message: 'No approval route is bound to this generation request.',
      suggestedFix: 'Attach an approval route before final external delivery.',
    });
  }

  return issues;
}

export function toDocumentSummary(input: {
  readonly id: string;
  readonly workspaceId: string;
  readonly ownerId: string;
  readonly title: string;
  readonly description: string | null;
  readonly kind: DocumentSummary['kind'];
  readonly status: DocumentSummary['status'];
  readonly classification: DocumentSummary['classification'];
  readonly source: DocumentSummary['source'];
  readonly tags?: readonly string[];
  readonly version?: {
    readonly id: string;
    readonly versionNo: number;
    readonly status: string;
    readonly originalFilename: string;
    readonly mimeType: string;
    readonly sizeBytes: number;
    readonly scanStatus:
      | 'not_started'
      | 'queued'
      | 'clean'
      | 'infected'
      | 'manual_review_required'
      | 'not_configured';
    readonly previewStatus: 'not_started' | 'queued' | 'ready' | 'failed';
    readonly extractionStatus:
      | 'not_started'
      | 'queued'
      | 'ready'
      | 'failed'
      | 'requires_ocr';
    readonly createdAt: string;
    readonly completedAt: string | null;
  } | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly archivedAt?: string | null;
  readonly deletedAt?: string | null;
}): DocumentSummary {
  return {
    id: input.id,
    workspaceId: input.workspaceId,
    ownerId: input.ownerId,
    title: input.title,
    description: input.description,
    kind: input.kind,
    status: input.status,
    classification: input.classification,
    source: input.source,
    tags: input.tags ?? [],
    currentVersion: input.version
      ? {
          id: input.version.id,
          documentId: input.id,
          versionNo: input.version.versionNo,
          status: input.version
            .status as DocumentSummary['currentVersion'] extends infer TVersion
            ? TVersion extends { status: infer TStatus }
              ? TStatus
              : never
            : never,
          originalFilename: input.version.originalFilename,
          mimeType: input.version.mimeType,
          sizeBytes: input.version.sizeBytes,
          sha256: null,
          storageState: 'signed_url_only',
          scanStatus: input.version.scanStatus,
          previewStatus: input.version.previewStatus,
          extractionStatus: input.version.extractionStatus,
          createdAt: input.version.createdAt,
          completedAt: input.version.completedAt,
        }
      : null,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    archivedAt: input.archivedAt ?? null,
    deletedAt: input.deletedAt ?? null,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
