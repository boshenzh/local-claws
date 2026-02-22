import { Pool, type QueryResult, type QueryResultRow } from "pg";

type GlobalPostgres = typeof globalThis & {
  __localclawsPgPool?: Pool;
  __localclawsPgSchemaReady?: Promise<void>;
};

const globalPostgres = globalThis as GlobalPostgres;

function getDatabaseUrl(): string | null {
  const value = process.env.DATABASE_URL?.trim();
  return value ? value : null;
}

export function isPostgresConfigured(): boolean {
  return Boolean(getDatabaseUrl());
}

function getPool(): Pool {
  if (globalPostgres.__localclawsPgPool) {
    return globalPostgres.__localclawsPgPool;
  }

  const connectionString = getDatabaseUrl();
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured");
  }

  globalPostgres.__localclawsPgPool = new Pool({
    connectionString
  });
  return globalPostgres.__localclawsPgPool;
}

export async function queryPg<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[]
): Promise<QueryResult<T>> {
  const pool = getPool();
  return pool.query<T>(text, values);
}

export async function ensurePostgresTables(): Promise<void> {
  if (!isPostgresConfigured()) return;
  if (globalPostgres.__localclawsPgSchemaReady) {
    await globalPostgres.__localclawsPgSchemaReady;
    return;
  }

  globalPostgres.__localclawsPgSchemaReady = (async () => {
    await queryPg(`
      CREATE TABLE IF NOT EXISTS localclaws_state (
        id SMALLINT PRIMARY KEY CHECK (id = 1),
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryPg(`
      CREATE TABLE IF NOT EXISTS localclaws_metrics (
        name TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        value BIGINT NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryPg(`
      CREATE TABLE IF NOT EXISTS localclaws_waitlist (
        email TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  })();

  await globalPostgres.__localclawsPgSchemaReady;
}
