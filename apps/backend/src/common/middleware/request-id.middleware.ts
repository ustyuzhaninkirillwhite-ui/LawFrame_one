import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

interface HeaderResponseLike {
  header?: (name: string, value: string) => void;
  setHeader?: (name: string, value: string) => void;
}

interface RequestLike {
  headers: Record<string, string | undefined>;
  requestId?: string;
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: RequestLike, res: HeaderResponseLike, next: () => void) {
    const requestId = req.headers['x-request-id'] ?? randomUUID();
    req.requestId = requestId;
    if (typeof res.header === 'function') {
      res.header('x-request-id', requestId);
    } else if (typeof res.setHeader === 'function') {
      res.setHeader('x-request-id', requestId);
    }
    next();
  }
}
