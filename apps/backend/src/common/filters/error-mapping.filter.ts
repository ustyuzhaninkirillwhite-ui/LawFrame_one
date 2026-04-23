import { createLogger } from '@lexframe/logger';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { ErrorCode } from '@lexframe/contracts';
import { AppHttpException } from '../errors/app-http.exception';

interface ReplyTarget {
  send?: (body: unknown) => void;
}

interface ReplyLike extends ReplyTarget {
  status?: (code: number) => ReplyTarget;
  code?: (code: number) => ReplyTarget;
  header?: (name: string, value: string) => void;
  setHeader?: (name: string, value: string) => void;
  end?: (body: string) => void;
  statusCode?: number;
}

@Catch()
export class ErrorMappingFilter implements ExceptionFilter {
  private readonly logger = createLogger('backend.error-filter');

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const request = host.switchToHttp().getRequest() as {
      url: string;
      headers: Record<string, string | undefined>;
      requestId?: string;
      traceId?: string;
    };

    if (exception instanceof AppHttpException) {
      this.sendError(response, exception.getStatus(), {
        error: {
          code: exception.code,
          message: exception.message,
          ...(exception.details ? { details: exception.details } : {}),
        },
        path: request.url,
        requestId: request.requestId ?? request.headers['x-request-id'] ?? null,
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      this.sendError(response, status, {
        error: {
          code: this.mapStatus(status),
          message: exception.message,
        },
        path: request.url,
        requestId: request.requestId ?? request.headers['x-request-id'] ?? null,
      });
      return;
    }

    this.logger.error(
      'Unhandled backend exception reached the global filter.',
      {
        path: request.url,
        error: exception instanceof Error ? exception.message : 'unknown_error',
        ...(exception instanceof Error && exception.stack
          ? { stack: exception.stack }
          : {}),
      },
    );

    this.sendError(response, HttpStatus.INTERNAL_SERVER_ERROR, {
      error: {
        code: 'READINESS_GATE_BLOCKED' satisfies ErrorCode,
        message: 'Unexpected backend error',
        ...(process.env.NODE_ENV !== 'production' && exception instanceof Error
          ? {
              details: {
                underlyingError: exception.message,
              },
            }
          : {}),
      },
      path: request.url,
      requestId: request.requestId ?? request.headers['x-request-id'] ?? null,
    });
  }

  private sendError(
    response: unknown,
    statusCode: number,
    payload: Record<string, unknown>,
  ) {
    const reply = response as ReplyLike;

    const send = (target: ReplyTarget | undefined) => {
      if (target && typeof target.send === 'function') {
        target.send(payload);
        return true;
      }

      return false;
    };

    if (typeof reply.status === 'function' && send(reply.status(statusCode))) {
      return;
    }

    if (typeof reply.code === 'function' && send(reply.code(statusCode))) {
      return;
    }

    if (typeof reply.send === 'function') {
      if (typeof reply.statusCode === 'number') {
        reply.statusCode = statusCode;
      }
      reply.send(payload);
      return;
    }

    if (typeof reply.setHeader === 'function') {
      reply.setHeader('content-type', 'application/json; charset=utf-8');
    } else if (typeof reply.header === 'function') {
      reply.header('content-type', 'application/json; charset=utf-8');
    }

    if (typeof reply.statusCode === 'number') {
      reply.statusCode = statusCode;
    }

    if (typeof reply.end === 'function') {
      reply.end(JSON.stringify(payload));
    }
  }

  private mapStatus(status: number): ErrorCode {
    if (status === HttpStatus.FORBIDDEN) {
      return 'PERMISSION_DENIED';
    }

    if (status === HttpStatus.UNAUTHORIZED) {
      return 'AUTH_REQUIRED';
    }

    return 'READINESS_GATE_BLOCKED';
  }
}
