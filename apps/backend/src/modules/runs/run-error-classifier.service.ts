import { Injectable } from '@nestjs/common';

@Injectable()
export class RunErrorClassifierService {
  classify(input: {
    readonly code?: string | null;
    readonly message?: string | null;
  }) {
    const code = input.code?.trim().toLowerCase() ?? null;
    const message = input.message?.trim() ?? null;
    const retryable =
      code === 'timeout' ||
      code === 'network_error' ||
      code === 'temporary_unavailable' ||
      code === 'rate_limited';

    return {
      code,
      message,
      retryable,
      userMessage:
        message ??
        (retryable
          ? 'Временная ошибка выполнения. Запуск можно повторить.'
          : 'Запуск завершился с ошибкой.'),
    };
  }
}
