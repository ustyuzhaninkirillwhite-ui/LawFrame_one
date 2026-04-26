import type {
  CanvasDataVisibilityMode,
  CanvasTestRunStepSummary,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { Injectable } from '@nestjs/common';

const SAFE_SUMMARY_KEYS = new Set([
  'id',
  'node_id',
  'module_code',
  'type',
  'status',
  'classification',
  'data_class',
  'hash',
  'payload_hash',
  'count',
  'total',
  'duration_ms',
  'started_at',
  'finished_at',
  'mime_type',
  'file_size',
]);

const SENSITIVE_KEY =
  /raw|payload|content|text|prompt|completion|response|output|input|token|secret|password|api[_-]?key|private[_-]?key|signed[_-]?url/i;

@Injectable()
export class CanvasDataVisibilityService {
  resolveMode(input: {
    readonly actor?: AuthenticatedActor | null;
    readonly access: AccessContext;
    readonly requested?: CanvasDataVisibilityMode | null;
    readonly highRiskRead?: boolean;
  }): CanvasDataVisibilityMode {
    const permissions = new Set(input.access.permissions);
    const hasRawPermission =
      permissions.has('canvas.test.view_raw_data') ||
      permissions.has('canvas.ai.view_raw_context') ||
      permissions.has('canvas.view_raw_dsl');
    const hasStructuredPermission =
      permissions.has('canvas.test.view_redacted') ||
      permissions.has('canvas.view') ||
      permissions.has('canvas.view_validation');
    const aal2 = input.actor?.assuranceLevel === 'aal2';

    if (input.requested === 'raw') {
      return hasRawPermission && aal2 && input.highRiskRead !== true
        ? 'raw'
        : 'redacted';
    }
    if (input.requested === 'structured_safe') {
      return hasStructuredPermission ? 'structured_safe' : 'metadata_only';
    }
    if (input.requested === 'redacted') {
      return hasStructuredPermission ? 'redacted' : 'metadata_only';
    }
    if (hasStructuredPermission) {
      return 'structured_safe';
    }
    return 'metadata_only';
  }

  redactTestStep(
    step: CanvasTestRunStepSummary,
    mode: CanvasDataVisibilityMode,
  ): CanvasTestRunStepSummary {
    if (mode === 'raw') {
      return step;
    }
    return {
      ...step,
      input_summary: this.redactValue(step.input_summary, mode),
      output_summary: this.redactValue(step.output_summary, mode),
      error:
        mode === 'metadata_only'
          ? step.error
            ? {
                code: step.error.code,
                severity: step.error.severity,
                node_id: step.error.node_id ?? step.node_id,
                edge_id: step.error.edge_id ?? null,
                title: 'Debug details redacted',
                user_message: 'Debug details are redacted.',
                technical_message: null,
                cause: { type: 'permission', details: {} },
                suggested_fixes: [],
                can_auto_fix: false,
              }
            : null
          : step.error,
    };
  }

  redactValue(
    value: unknown,
    mode: CanvasDataVisibilityMode,
  ): Record<string, unknown> | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (mode === 'raw') {
      return isRecord(value) ? value : { value };
    }
    if (mode === 'metadata_only') {
      return metadataOnly(value);
    }
    return redactStructured(value) as Record<string, unknown>;
  }
}

function metadataOnly(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) {
    return { redacted: true, type: 'array', count: value.length };
  }
  if (!isRecord(value)) {
    return { redacted: true, type: typeof value };
  }
  return {
    redacted: true,
    type: 'object',
    keys: Object.keys(value).slice(0, 25),
    count: Object.keys(value).length,
    classification:
      typeof value.classification === 'string'
        ? value.classification
        : typeof value.data_class === 'string'
          ? value.data_class
          : null,
    hash:
      typeof value.hash === 'string'
        ? value.hash
        : typeof value.payload_hash === 'string'
          ? value.payload_hash
          : null,
  };
}

function redactStructured(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.slice(0, 25).map((item) => redactStructured(item));
  }
  if (!isRecord(value)) {
    if (typeof value === 'string' && value.length > 120) {
      return '[redacted]';
    }
    return value;
  }
  const redacted: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key) && !SAFE_SUMMARY_KEYS.has(key)) {
      redacted[key] = '[redacted]';
      continue;
    }
    if (SAFE_SUMMARY_KEYS.has(key)) {
      redacted[key] = child;
      continue;
    }
    redacted[key] = redactStructured(child);
  }
  return redacted;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
