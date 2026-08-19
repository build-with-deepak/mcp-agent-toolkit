import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, type QueryResultRow } from 'pg';
import type { AppConfig } from '../config/configuration';

/**
 * Two pools, two privilege levels.
 *
 * The ADMIN pool (owner credentials) runs migrations and creates the
 * `mcp_readonly` role. The READONLY pool is what the agent's DB tool
 * queries through: it authenticates as `mcp_readonly` (SELECT-only
 * grants), opens every connection with `default_transaction_read_only=on`
 * and a 5s statement_timeout. App-level SQL validation exists too
 * (sql-guard.ts), but the role is the layer that holds even if the guard
 * has a bug — an agent's SQL is untrusted input BY DESIGN, since the LLM
 * writes it from a visitor's natural-language question.
 *
 * The role is created in code rather than schema.sql because CREATE ROLE
 * cannot take a parameterized password; the identifier is fixed and the
 * password is escaped, so the interpolation below is bounded.
 */
@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DbService.name);
  private readonly adminPool: Pool;
  private readonly readonlyPool: Pool;
  private migrated = false;

  constructor(configService: ConfigService<{ app: AppConfig }, true>) {
    const db = configService.get('app', { infer: true }).db;

    this.adminPool = new Pool({ connectionString: db.url, max: 4 });

    const url = new URL(db.url);
    url.username = 'mcp_readonly';
    url.password = db.readonlyPassword;
    this.readonlyPool = new Pool({
      connectionString: url.toString(),
      max: 4,
      options: '-c default_transaction_read_only=on -c statement_timeout=5000',
    });

    for (const pool of [this.adminPool, this.readonlyPool]) {
      pool.on('error', (err) =>
        this.logger.error(`Postgres pool error: ${err.message}`),
      );
    }
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.migrate();
    } catch (err) {
      this.logger.warn(
        `Postgres not reachable at boot (will retry on first use): ${(err as Error).message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.adminPool.end(), this.readonlyPool.end()]);
  }

  /** Agent-facing: runs through the read-only role. */
  async readonlyQuery<T extends QueryResultRow>(
    sql: string,
  ): Promise<{ rows: T[]; rowCount: number }> {
    await this.ensureMigrated();
    const result = await this.readonlyPool.query<T>(sql);
    return {
      rows: result.rows,
      rowCount: result.rowCount ?? result.rows.length,
    };
  }

  private async ensureMigrated(): Promise<void> {
    if (this.migrated) return;
    try {
      await this.migrate();
    } catch (err) {
      this.logger.error(`Migration retry failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException(
        'The database is unreachable right now. Try again shortly.',
      );
    }
  }

  private async migrate(): Promise<void> {
    const config = await this.adminPool.connect();
    try {
      const roPassword = this.readonlyPassword().replace(/'/g, "''");
      await config.query(
        `DO $$ BEGIN
           IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mcp_readonly') THEN
             CREATE ROLE mcp_readonly LOGIN;
           END IF;
         END $$;`,
      );
      await config.query(
        `ALTER ROLE mcp_readonly LOGIN PASSWORD '${roPassword}'`,
      );

      const schema = await readFile(
        join(__dirname, '..', '..', 'db', 'schema.sql'),
        'utf-8',
      );
      await config.query(schema);
      this.migrated = true;
      this.logger.log('Schema, sample dataset and read-only role applied.');
    } finally {
      config.release();
    }
  }

  private readonlyPassword(): string {
    // Reconstructed from the readonly pool's own connection string so the
    // password used for ALTER ROLE and the one the pool authenticates with
    // cannot drift apart.
    const url = new URL(
      (this.readonlyPool.options as { connectionString: string })
        .connectionString,
    );
    return decodeURIComponent(url.password);
  }
}
