export interface LogRecord {
  readonly scope: string;
  readonly level: "debug" | "info" | "warn" | "error";
  readonly message: string;
  readonly meta?: Record<string, unknown>;
}

export function createLogger(scope: string) {
  return {
    debug(message: string, meta?: Record<string, unknown>) {
      console.debug(JSON.stringify({ scope, level: "debug", message, meta } satisfies LogRecord));
    },
    info(message: string, meta?: Record<string, unknown>) {
      console.info(JSON.stringify({ scope, level: "info", message, meta } satisfies LogRecord));
    },
    warn(message: string, meta?: Record<string, unknown>) {
      console.warn(JSON.stringify({ scope, level: "warn", message, meta } satisfies LogRecord));
    },
    error(message: string, meta?: Record<string, unknown>) {
      console.error(JSON.stringify({ scope, level: "error", message, meta } satisfies LogRecord));
    },
  };
}

