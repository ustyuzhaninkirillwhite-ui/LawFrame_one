import { Logger } from '@nestjs/common';
import { DatabaseService } from './database.service';

interface MockPgPool {
  readonly config: unknown;
  listenerCount(eventName: string | symbol): number;
  emit(eventName: string | symbol, ...args: readonly unknown[]): boolean;
}

const mockPoolInstances: MockPgPool[] = [];

jest.mock('pg', () => ({
  Pool: class MockPool extends jest.requireActual('node:events').EventEmitter {
    readonly config: unknown;

    constructor(config: unknown) {
      super();
      this.config = config;
      mockPoolInstances.push(this as unknown as MockPgPool);
    }
  },
}));

jest.mock('@lexframe/config', () => ({
  loadServerEnv: () => ({ SUPABASE_DB_URL: 'postgres://example.test/db' }),
}));

describe('DatabaseService', () => {
  beforeEach(() => {
    mockPoolInstances.length = 0;
  });

  it('handles idle postgres pool errors without crashing the process', () => {
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    new DatabaseService();
    const pool = mockPoolInstances[0];

    expect(pool).toBeDefined();
    if (!pool) {
      throw new Error('Mock pg pool was not created.');
    }
    expect(pool.listenerCount('error')).toBe(1);
    expect(() =>
      pool.emit(
        'error',
        Object.assign(new Error('terminating connection'), { code: '57P01' }),
      ),
    ).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      'Postgres idle client error (57P01): terminating connection',
    );

    warnSpy.mockRestore();
  });
});
