import { INDEX_DOCUMENT_JOB, INDEX_QUEUE, type IndexDocumentPayload } from "./queue/jobs.js";
import { runWorker } from "./queue/worker.js";
import { indexDocument } from "./search/indexer.js";
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

const db = createPool();
attachPoolErrorLogging(db);
const dbDeps = { db };

const workerRedis = createRedis();
attachRedisLogging(workerRedis);
const opsRedis = createRedis();
attachRedisLogging(opsRedis);

const runIndex = indexDocument(dbDeps);

await connectPostgres(dbDeps);
await runMigrations(dbDeps);
await connectRedis({ redis: workerRedis });
await connectRedis({ redis: opsRedis });

console.log(`[worker] running queue "${INDEX_QUEUE}"`);

await runWorker(
  { redis: workerRedis },
  { redis: opsRedis },
  INDEX_QUEUE,
  async (_redisDeps, job) => {
    if (job.name !== INDEX_DOCUMENT_JOB) {
      throw new Error(`unknown job name: ${job.name}`);
    }
    const payload = job.payload as IndexDocumentPayload;
    await runIndex(payload);
  },
  { concurrency: 3 },
);

await disconnectPostgres(dbDeps);
await disconnectRedis({ redis: workerRedis });
await disconnectRedis({ redis: opsRedis });
