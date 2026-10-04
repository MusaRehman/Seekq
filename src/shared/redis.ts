import { createClient, type RedisClientType } from "redis";
import { config, redisTarget } from "./config.js";

export const redis: RedisClientType = createClient({
  url: config.redis.url,
  socket: {
    connectTimeout: 5_000,
    reconnectStrategy: (retries) => {
      if (retries > 20) {
        return new Error("Redis max reconnect attempts reached");
      }
      return Math.min(retries * 100, 3_000);
    },
  },
});

redis.on("error", (err) => {
  console.error("[redis] client error:", err.message);
});

redis.on("reconnecting", () => {
  console.warn("[redis] reconnecting…");
});

redis.on("ready", () => {
  if (redis.isOpen) {
    console.log("[redis] ready");
  }
});

export async function connectRedis(): Promise<void> {
  const target = redisTarget();
  console.log(`[redis] connecting to ${target}…`);
  if (!redis.isOpen) {
    await redis.connect();
  }
  const pong = await redis.ping();
  if (pong !== "PONG") {
    throw new Error(`unexpected PING response: ${pong}`);
  }
  console.log(`[redis] connected (${target})`);
}

export async function disconnectRedis(): Promise<void> {
  if (redis.isOpen) {
    await redis.quit();
  }
  console.log("[redis] disconnected");
}
