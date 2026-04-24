import type {
  DocumentKind,
  DocumentObjectRole,
  DocumentSource,
  SignedUrlRequest,
  StorageState,
} from '@lexframe/contracts';

export const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;
export const DEFAULT_UPLOAD_TTL_MINUTES = 15;
export const ORIGINAL_SIGNED_URL_TTL_SECONDS = 120;
export const PREVIEW_SIGNED_URL_TTL_SECONDS = 300;
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'text/plain',
] as const;
export const PREVIEWABLE_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
export const TEXT_EXTRACTABLE_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

export function mapStorageState(bucket: string): StorageState {
  if (bucket === 'quarantine-private') {
    return 'quarantined';
  }

  if (bucket === 'previews-private' || bucket === 'artifacts-private') {
    return 'signed_url_only';
  }

  return 'private_bucket';
}

export function buildStoragePath(
  workspaceId: string,
  documentId: string,
  versionId: string,
  role: DocumentObjectRole,
  filename: string,
) {
  return `workspace/${workspaceId}/documents/${documentId}/versions/${versionId}/${role}/${sanitizeFilename(filename)}`;
}

export function buildDerivedStoragePath(
  workspaceId: string,
  documentId: string,
  versionId: string,
  role: Exclude<DocumentObjectRole, 'original'>,
  filename: string,
) {
  const safeBaseName = stripExtension(sanitizeFilename(filename));
  const extension =
    role === 'preview_pdf'
      ? 'pdf'
      : role === 'thumbnail'
        ? 'png'
        : role === 'extracted_text'
          ? 'json'
          : 'pdf';

  return `workspace/${workspaceId}/documents/${documentId}/versions/${versionId}/${role}/${safeBaseName}.${extension}`;
}

export function sanitizeFilename(filename: string) {
  const trimmed = filename.trim().toLowerCase();
  const [baseName, extension] = splitExtension(trimmed);
  const safeBase = baseName
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const safeExtension = extension.replace(/[^a-z0-9]+/g, '');
  return safeExtension.length > 0
    ? `${safeBase || 'document'}.${safeExtension}`
    : safeBase || 'document';
}

export function splitExtension(filename: string) {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot <= 0) {
    return [filename, ''] as const;
  }

  return [filename.slice(0, lastDot), filename.slice(lastDot + 1)] as const;
}

export function stripExtension(filename: string) {
  return splitExtension(filename)[0];
}

export function resolveDocumentSource(kind: DocumentKind): DocumentSource {
  if (kind === 'document_template') {
    return 'template_library';
  }

  return 'user_upload';
}

export function clampSignedUrlTtl(
  purpose: SignedUrlRequest['purpose'],
  requested: number | undefined,
) {
  const defaultValue =
    purpose === 'preview'
      ? PREVIEW_SIGNED_URL_TTL_SECONDS
      : ORIGINAL_SIGNED_URL_TTL_SECONDS;

  if (typeof requested !== 'number' || Number.isNaN(requested)) {
    return defaultValue;
  }

  return Math.max(30, Math.min(requested, defaultValue));
}

export function createFutureTimestamp(minutes: number) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

export function normalizeArtifactKind(value: string): DocumentKind {
  if (
    value === 'case_material' ||
    value === 'evidence' ||
    value === 'legal_source' ||
    value === 'document_template' ||
    value === 'generated_document' ||
    value === 'draft_document' ||
    value === 'delivery_attachment' ||
    value === 'profile_clause' ||
    value === 'other'
  ) {
    return value;
  }

  return 'generated_document';
}

export function deriveArtifactFilename(title: string, mimeType: string) {
  const base = sanitizeFilename(title);
  const extension =
    mimeType === 'application/pdf'
      ? 'pdf'
      : mimeType ===
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ? 'docx'
        : mimeType === 'image/png'
          ? 'png'
          : mimeType === 'image/jpeg'
            ? 'jpg'
            : mimeType === 'text/plain'
              ? 'txt'
              : 'bin';

  const stripped = stripExtension(base);
  return `${stripped}.${extension}`;
}
