import { loadServerEnv } from '@lexframe/config';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import {
  Pool,
  type PoolClient,
  type QueryResult,
  type QueryResultRow,
} from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor() {
    const env = loadServerEnv();

    this.pool = new Pool({
      connectionString: env.SUPABASE_DB_URL,
    });
  }

  query<T extends QueryResultRow>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, [...values]);
  }

  async one<T extends QueryResultRow>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<T | null> {
    const result = await this.query<T>(text, values);
    return result.rows[0] ?? null;
  }

  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('begin');
      const result = await callback(client);
      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async ping(): Promise<boolean> {
    try {
      await this.query('select 1');
      return true;
    } catch {
      return false;
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
