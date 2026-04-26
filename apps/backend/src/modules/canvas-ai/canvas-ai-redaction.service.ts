import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';

const REDACTED = '[redacted]';
const SENSITIVE_KEY_PATTERN =
  /secret|token|password|authorization|cookie|signed.?url|service.?role|api.?key|raw.?text|document.?text|prompt|email|phone/i;

@Injectable()
export class CanvasAiRedactionService {
  redact<T>(value: T): {
    readonly value: T;
    readonly redactions: readonly string[];
  } {
    const redactions = new Set<string>();
    const redacted = this.redactValue(value, redactions);
    return { value: redacted as T, redactions: [...redactions] };
  }

  safePreview(value: string, maxLength = 280) {
    const redacted = value
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, '<EMAIL>')
      .replace(/\+?\d[\d\s().-]{8,}\d/gu, '<PHONE>')
      .replace(/(sk|pk|srv|pat)_[A-Za-z0-9_-]{16,}/gu, '<TOKEN>');
    return redacted.length > maxLength
      ? `${redacted.slice(0, maxLength - 1)}...`
      : redacted;
  }

  hash(value: unknown) {
    return createHash('sha256')
      .update(typeof value === 'string' ? value : JSON.stringify(value))
      .digest('hex');
  }

  private redactValue(value: unknown, redactions: Set<string>): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.redactValue(item, redactions));
    }

    if (!isRecord(value)) {
      if (typeof value === 'string') {
        return this.redactString(value, redactions);
      }
      return value;
    }

    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        redactions.add(`key:${key}`);
        output[key] = REDACTED;
        continue;
      }
      output[key] = this.redactValue(child, redactions);
    }
    return output;
  }

  private redactString(value: string, redactions: Set<string>) {
    let next = value;
    if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu.test(next)) {
      redactions.add('entity:email');
      next = next.replace(
        /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu,
        '<EMAIL>',
      );
    }
    if (/\+?\d[\d\s().-]{8,}\d/u.test(next)) {
      redactions.add('entity:phone');
      next = next.replace(/\+?\d[\d\s().-]{8,}\d/gu, '<PHONE>');
    }
    if (/(sk|pk|srv|pat)_[A-Za-z0-9_-]{16,}/u.test(next)) {
      redactions.add('entity:token');
      next = next.replace(/(sk|pk|srv|pat)_[A-Za-z0-9_-]{16,}/gu, '<TOKEN>');
    }
    return next;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
