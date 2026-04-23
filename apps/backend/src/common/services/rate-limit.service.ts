import { AppHttpException } from '../errors/app-http.exception';
import { Injectable } from '@nestjs/common';

@Injectable()
export class RateLimitService {
  private readonly buckets = new Map<string, number[]>();

  assertWithinLimit(key: string, maxRequests: number, windowMs: number): void {
    const now = Date.now();
    const bucket = this.buckets.get(key) ?? [];
    const active = bucket.filter((timestamp) => now - timestamp < windowMs);

    if (active.length >= maxRequests) {
      throw new AppHttpException(
        'RATE_LIMITED',
        429,
        'Too many requests for this operation.',
        {
          retryAfterSeconds: Math.ceil(windowMs / 1000),
        },
      );
    }

    active.push(now);
    this.buckets.set(key, active);
  }
}
