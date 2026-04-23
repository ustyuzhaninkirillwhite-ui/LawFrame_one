import type { ErrorCode } from '@lexframe/contracts';
import { HttpException } from '@nestjs/common';

export class AppHttpException extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    status: number,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message, status);
  }
}
