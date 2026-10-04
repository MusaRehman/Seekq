import "dotenv/config";

export const config = {
  port: Number(process.env.PORT) || 3000,
  postgres: {
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER ?? "postgres",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "",
  },
  redis: {
    url: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
  },
} as const;

export function postgresTarget(): string {
  const { host, port, database } = config.postgres;
  return `${host}:${port}/${database}`;
}

export function redisTarget(): string {
  try {
    const parsed = new URL(config.redis.url);
    return `${parsed.hostname}:${parsed.port || "6379"}`;
  } catch {
    return config.redis.url;
  }
}
