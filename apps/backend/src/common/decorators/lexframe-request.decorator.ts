import type { LexframeRequestState } from '../types/lexframe-request';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const LexframeRequestContext = createParamDecorator(
  (_data: unknown, context: ExecutionContext): LexframeRequestState => {
    const request = context.switchToHttp().getRequest<{
      lexframe?: LexframeRequestState;
    }>();

    return request.lexframe ?? {};
  },
);
