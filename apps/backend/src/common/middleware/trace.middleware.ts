import { Injectable, NestMiddleware } from '@nestjs/common';

interface HeaderResponseLike {
  header?: (name: string, value: string) => void;
  setHeader?: (name: string, value: string) => void;
}

interface RequestLike {
  headers: Record<string, string | undefined>;
  requestId?: string;
  traceId?: string;
}

@Injectable()
export class TraceMiddleware implements NestMiddleware {
  use(req: RequestLike, res: HeaderResponseLike, next: () => void) {
    const traceId =
      req.headers['x-trace-id'] ?? req.requestId ?? 'trace-stage0';
    req.traceId = traceId;
    if (typeof res.header === 'function') {
      res.header('x-trace-id', traceId);
    } else if (typeof res.setHeader === 'function') {
      res.setHeader('x-trace-id', traceId);
    }
    next();
  }
}
