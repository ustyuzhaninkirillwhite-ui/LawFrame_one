import { AppHttpException } from '../../common/errors/app-http.exception';
import {
  buildActivepiecesPostgresPoolOptions,
  resolveActivepiecesPostgresPassword,
} from './activepieces-postgres-pool.service';

describe('ActivepiecesPostgresPoolService', () => {
  it('classifies missing AP Postgres credentials as a controlled config error', () => {
    expect(() =>
      resolveActivepiecesPostgresPassword({
        envValue: '',
        filePath: '',
      }),
    ).toThrow(AppHttpException);

    try {
      resolveActivepiecesPostgresPassword({
        envValue: '',
        filePath: '',
      });
    } catch (error) {
      expect(error).toMatchObject({
        code: 'AP_POSTGRES_CONFIG_MISSING',
      });
      expect(JSON.stringify(error)).not.toMatch(
        /SASL|SCRAM|client password|postgres:\/\/|ACTIVEPIECES_POSTGRES_PASSWORD/i,
      );
    }
  });

  it('creates a bounded AP Postgres pool config for local runtime reuse', () => {
    const options = buildActivepiecesPostgresPoolOptions({
      ACTIVEPIECES_POSTGRES_HOST: '127.0.0.1',
      ACTIVEPIECES_POSTGRES_PORT: 54323,
      ACTIVEPIECES_POSTGRES_DATABASE: 'activepieces',
      ACTIVEPIECES_POSTGRES_USERNAME: 'postgres',
      ACTIVEPIECES_POSTGRES_PASSWORD: 'postgres',
      ACTIVEPIECES_POSTGRES_PASSWORD_FILE: '',
    });

    expect(options).toMatchObject({
      host: '127.0.0.1',
      port: 54323,
      database: 'activepieces',
      user: 'postgres',
      password: 'postgres',
      max: 4,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
    });
  });
});
