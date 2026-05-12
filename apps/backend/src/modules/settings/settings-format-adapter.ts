import type { SettingsFormatCode } from '@lexframe/contracts';
import { AppHttpException } from '../../common/errors/app-http.exception';

export interface SettingsFormatAdapter<T> {
  readonly code: SettingsFormatCode;
  parse(body: unknown): T;
}

export class ManualFormSettingsFormatAdapter<
  T,
> implements SettingsFormatAdapter<T> {
  readonly code = 'manual_form' as const;

  constructor(
    private readonly parseManual: (body: Record<string, unknown>) => T,
  ) {}

  parse(body: unknown): T {
    const record = requireRecord(body);
    const format = record.format;
    if (format !== undefined && format !== null && format !== 'manual_form') {
      throw new AppHttpException(
        'VALIDATION_ERROR',
        400,
        'Unsupported settings format.',
        { format },
      );
    }

    return this.parseManual(record);
  }
}

export class FutureUserFormatSettingsAdapter implements SettingsFormatAdapter<never> {
  readonly code = 'future_user_format' as const;

  parse(): never {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'future_user_format is reserved and is not accepted in Stage 21.',
    );
  }
}

export function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Request body must be an object.',
    );
  }

  return value as Record<string, unknown>;
}

export function optionalString(
  value: unknown,
  field: string,
  maxLength = 255,
): string | null | undefined {
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
      `${field} must be a string or null.`,
    );
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, maxLength) : null;
}

export function requiredString(
  value: unknown,
  field: string,
  maxLength = 512,
): string {
  const parsed = optionalString(value, field, maxLength);

  if (!parsed) {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      `${field} is required.`,
    );
  }

  return parsed;
}

export function optionalBoolean(
  value: unknown,
  field: string,
): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'boolean') {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      `${field} must be a boolean.`,
    );
  }

  return value;
}

export function optionalObject(
  value: unknown,
  field: string,
): Record<string, unknown> | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      `${field} must be an object.`,
    );
  }

  return value as Record<string, unknown>;
}
