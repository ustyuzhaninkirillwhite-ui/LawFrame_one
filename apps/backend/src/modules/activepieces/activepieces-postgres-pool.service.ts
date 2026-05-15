import { loadServerEnv } from '@lexframe/config';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { Pool, type PoolConfig } from 'pg';
import { AppHttpException } from '../../common/errors/app-http.exception';

const DEFAULT_AP_POSTGRES_POOL_MAX = 4;
const AP_POSTGRES_CONNECTION_TIMEOUT_MS = 5_000;
const AP_POSTGRES_IDLE_TIMEOUT_MS = 30_000;

type ActivepiecesPostgresEnv = {
  readonly ACTIVEPIECES_POSTGRES_HOST: string;
  readonly ACTIVEPIECES_POSTGRES_PORT: number;
  readonly ACTIVEPIECES_POSTGRES_DATABASE: string;
  readonly ACTIVEPIECES_POSTGRES_USERNAME: string;
  readonly ACTIVEPIECES_POSTGRES_PASSWORD: string;
  readonly ACTIVEPIECES_POSTGRES_PASSWORD_FILE: string;
};

@Injectable()
export class ActivepiecesPostgresPoolService implements OnModuleDestroy {
  private readonly logger = new Logger(ActivepiecesPostgresPoolService.name);
  private readonly env = loadServerEnv();
  private pool: Pool | null = null;

  getPool() {
    if (this.pool) {
      return this.pool;
    }

    this.pool = new Pool(buildActivepiecesPostgresPoolOptions(this.env));
    this.pool.on('error', (error: Error & { readonly code?: string }) => {
      const code = error.code ? ` (${error.code})` : '';
      this.logger.warn(`Activepieces Postgres idle client error${code}`);
    });
    return this.pool;
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }
}

export function buildActivepiecesPostgresPoolOptions(
  env: ActivepiecesPostgresEnv,
): PoolConfig {
  return {
    host: env.ACTIVEPIECES_POSTGRES_HOST,
    port: env.ACTIVEPIECES_POSTGRES_PORT,
    database: env.ACTIVEPIECES_POSTGRES_DATABASE,
    user: env.ACTIVEPIECES_POSTGRES_USERNAME,
    password: resolveActivepiecesPostgresPassword({
      envValue: env.ACTIVEPIECES_POSTGRES_PASSWORD,
      filePath: env.ACTIVEPIECES_POSTGRES_PASSWORD_FILE,
    }),
    max: DEFAULT_AP_POSTGRES_POOL_MAX,
    connectionTimeoutMillis: AP_POSTGRES_CONNECTION_TIMEOUT_MS,
    idleTimeoutMillis: AP_POSTGRES_IDLE_TIMEOUT_MS,
  };
}

export function resolveActivepiecesPostgresPassword(input: {
  readonly envValue: string;
  readonly filePath: string;
}) {
  const password =
    input.filePath && existsSync(input.filePath)
      ? readFileSync(input.filePath, 'utf8').trim()
      : input.envValue;

  if (!password.trim()) {
    throw new AppHttpException(
      'AP_POSTGRES_CONFIG_MISSING',
      503,
      'Activepieces runtime database credentials are not configured.',
      {
        reasonCode: 'AP_POSTGRES_CONFIG_MISSING',
        safeToShow: true,
      },
    );
  }

  return password;
}
