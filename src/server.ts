import express from "express";
import { createAdminRouter } from "./api/routes/admin.js";
import { createDocumentsRouter } from "./api/routes/documents.js";
import { createJobsRouter } from "./api/routes/jobs.js";
import { createSearchRouter } from "./api/routes/search.js";
import { config } from "./shared/config.js";
import { runMigrations } from "./shared/migrate.js";
import {
  attachPoolErrorLogging,
  connectPostgres,
  createPool,
  disconnectPostgres,
} from "./shared/postgres.js";
import {
  attachRedisLogging,
  connectRedis,
  createRedis,
  disconnectRedis,
} from "./shared/redis.js";
import { INDEX_QUEUE } from "./queue/jobs.js";
import { getQueueStats } from "./queue/redis-ops.js";
import type { AppDeps } from "./shared/types.js";

const db = createPool();
attachPoolErrorLogging(db);
const redis = createRedis();
attachRedisLogging(redis);
const deps: AppDeps = { db, redis };

const app = express();
app.use(express.json());

app.get("/health", async (_req, res) => {
  try {
    await deps.db.query("SELECT 1");
    await deps.redis.ping();
    res.json({ status: "ok", service: "seekq" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    res.status(503).json({ status: "degraded", error: message });
  }
});

app.use("/documents", createDocumentsRouter(deps));
app.use("/jobs", createJobsRouter(deps));
app.use("/search", createSearchRouter(deps));
app.use("/admin", createAdminRouter(deps));
app.get("/stats", async (_req, res) => {
  const queues = await getQueueStats(deps, INDEX_QUEUE);
  res.json({ queue: INDEX_QUEUE, ...queues });
});

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
  await disconnectPostgres(deps);
  await disconnectRedis(deps);
  console.log("[seekq] shutdown complete");
  process.exit(0);
}

async function start(): Promise<void> {
  await connectPostgres(deps);
  await runMigrations(deps);
  await connectRedis(deps);

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
