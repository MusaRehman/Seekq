import express from "express";
import { config } from "./shared/config.js";
import {
  connectPostgres,
  disconnectPostgres,
  pool,
} from "./shared/postgres.js";
import { connectRedis, disconnectRedis, redis } from "./shared/redis.js";

const app = express();

app.use(express.json());

let httpServer: ReturnType<typeof app.listen> | undefined;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  console.log(`[seekq] ${signal} received, shutting down gracefully…`);
  await new Promise<void>((resolve, reject) => {
    if (!httpServer) {
      resolve();
      return;
    }
    httpServer.close((err) => (err ? reject(err) : resolve()));
  });
  await disconnectPostgres();
  await disconnectRedis();
  console.log("[seekq] shutdown complete");
  process.exit(0);
}

async function start(): Promise<void> {
  await connectPostgres();
  await connectRedis();

  httpServer = app.listen(config.port, () => {
    console.log(`[seekq] HTTP server listening on port ${config.port}`);
  });
}

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});
process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});

start().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error("[seekq] failed to start:", message);
  process.exit(1);
});
