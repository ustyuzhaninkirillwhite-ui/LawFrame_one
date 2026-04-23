import type { createLogger } from '@lexframe/logger';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

type LoggerInstance = ReturnType<typeof createLogger>;

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerInstance) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest() as {
      method: string;
      url: string;
      headers: Record<string, string | undefined>;
      requestId?: string;
      traceId?: string;
    };
    const startedAt = Date.now();

    return next.handle().pipe(
      tap(() => {
        this.logger.info('request audited', {
          method: request.method,
          url: request.url,
          requestId: request.requestId ?? request.headers['x-request-id'],
          traceId: request.traceId ?? request.headers['x-trace-id'],
          durationMs: Date.now() - startedAt,
        });
      }),
    );
  }
}
