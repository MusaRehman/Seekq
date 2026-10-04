import pg from "pg";
import { config, postgresTarget } from "./config.js";

export const pool = new pg.Pool({
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

pool.on("error", (err) => {
  console.error("[postgres] idle client error:", err.message);
});

export async function connectPostgres(): Promise<void> {
  const target = postgresTarget();
  console.log(`[postgres] connecting to ${target}…`);
  const client = await pool.connect();
  try {
    await client.query("SELECT 1 AS ok");
    console.log(`[postgres] connected (${target})`);
  } finally {
    client.release();
  }
}

export async function disconnectPostgres(): Promise<void> {
  await pool.end();
  console.log("[postgres] disconnected");
}
