import { AppHttpException } from '../../common/errors/app-http.exception';
import { Injectable } from '@nestjs/common';
import { AuditService, type AuditRecordInput } from './audit.service';

const FORBIDDEN_AUDIT_KEYS = new Set([
  'api_key',
  'apikey',
  'apiKey',
  'authorization',
  'Authorization',
  'raw_prompt',
  'raw_output',
  'document_text',
  'client_material_text',
  'provider_key',
  'private_key',
]);

@Injectable()
export class SafeAuditWriter {
  constructor(private readonly auditService: AuditService) {}

  async record(input: AuditRecordInput) {
    const forbiddenPath = findForbiddenPath(input.metadata ?? {}, '$.metadata');
    if (forbiddenPath) {
      throw new AppHttpException(
        'VALIDATION_ERROR',
        400,
        'Audit payload contains a forbidden secret or raw-content field.',
        { path: forbiddenPath },
      );
    }

    await this.auditService.record(input);
  }
}

function findForbiddenPath(value: unknown, path: string): string | null {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const match = findForbiddenPath(item, `${path}[${index}]`);
      if (match) {
        return match;
      }
    }
    return null;
  }

  if (typeof value !== 'object' || value === null) {
    return null;
  }

  for (const [key, item] of Object.entries(value)) {
    if (FORBIDDEN_AUDIT_KEYS.has(key)) {
      return `${path}.${key}`;
    }
    const match = findForbiddenPath(item, `${path}.${key}`);
    if (match) {
      return match;
    }
  }

  return null;
}
