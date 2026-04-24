import type { LexframeRequest } from '../types/lexframe-request';
import { AppHttpException } from '../errors/app-http.exception';

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

export function asRecord(
  value: unknown,
  message = 'Request body must be a JSON object.',
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AppHttpException('VALIDATION_ERROR', 400, message);
  }

  return value as Record<string, unknown>;
}

export function asLooseRecord(
  value: unknown,
  message = 'Expected a JSON object.',
): Record<string, unknown> {
  return asRecord(value, message);
}

export function expectString(value: unknown, message: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AppHttpException('VALIDATION_ERROR', 400, message);
  }

  return value.trim();
}

export function expectStringArray(
  value: unknown,
  message: string,
): readonly string[] {
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== 'string')
  ) {
    throw new AppHttpException('VALIDATION_ERROR', 400, message);
  }

  return (value as string[])
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
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

export function optionalStringArray(
  value: unknown,
  message = 'Expected an array of strings.',
): readonly string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  return expectStringArray(value, message);
}
