import pg from "pg";
import type { Db, DbDeps } from "./types.js";
import { config, postgresTarget } from "./config.js";

export function createPool(): Db {
  return new pg.Pool({
    host: config.postgres.host,
    port: config.postgres.port,
    user: config.postgres.user,
    password: config.postgres.password,
    database: config.postgres.database,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    keepAlive: true,
  });
}

export function attachPoolErrorLogging(db: Db): void {
  db.on("error", (err) => {
    console.error("[postgres] idle client error:", err.message);
  });
}

export async function connectPostgres(deps: DbDeps): Promise<void> {
  const target = postgresTarget();
  console.log(`[postgres] connecting to ${target}…`);
  const client = await deps.db.connect();
  try {
    await client.query("SELECT 1 AS ok");
    console.log(`[postgres] connected (${target})`);
  } finally {
    client.release();
  }
}

export async function disconnectPostgres(deps: DbDeps): Promise<void> {
  await deps.db.end();
  console.log("[postgres] disconnected");
}
