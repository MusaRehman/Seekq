import { Redis } from "ioredis";
import type { RedisConn, RedisDeps } from "./types.js";
import { config, redisTarget } from "./config.js";

export function createRedis(): RedisConn {
  return new Redis(config.redis.url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
}

export function attachRedisLogging(redis: RedisConn): void {
  redis.on("error", (err: Error) => {
    console.error("[redis] client error:", err.message);
  });
  redis.on("reconnecting", () => {
    console.warn("[redis] reconnecting…");
  });
  redis.on("ready", () => {
    console.log("[redis] ready");
  });
}

export async function connectRedis(deps: RedisDeps): Promise<void> {
  const target = redisTarget();
  console.log(`[redis] connecting to ${target}…`);
  if (deps.redis.status === "wait") {
    await deps.redis.connect();
  }
  const pong = await deps.redis.ping();
  if (pong !== "PONG") {
    throw new Error(`unexpected PING response: ${pong}`);
  }
  console.log(`[redis] connected (${target})`);
}

export async function disconnectRedis(deps: RedisDeps): Promise<void> {
  if (deps.redis.status !== "end") {
    await deps.redis.quit();
  }
  console.log("[redis] disconnected");
}
