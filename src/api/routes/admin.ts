import { Router } from "express";
import type { AppDeps } from "../../shared/types.js";
import {
  INDEX_DOCUMENT_JOB,
  INDEX_QUEUE,
  type IndexDocumentPayload,
} from "../../queue/jobs.js";
import { nowMs } from "../../shared/clock.js";
import {
  enqueue,
  getQueueStats,
  listDeadJobs,
  retryDeadJob,
} from "../../queue/redis-ops.js";

export function createAdminRouter(deps: AppDeps): Router {
  const router = Router();

  router.post("/reindex", async (_req, res) => {
    const batchSize = 50;
    let offset = 0;
    let total = 0;

    for (;;) {
      const batch = await deps.db.query<{ id: string }>(
        `SELECT id FROM documents ORDER BY id ASC LIMIT $1 OFFSET $2`,
        [batchSize, offset],
      );
      if ((batch.rowCount ?? 0) === 0) break;

      for (const row of batch.rows) {
        const documentId = Number(row.id);
        const payload: IndexDocumentPayload = { documentId };
        await enqueue(deps, INDEX_QUEUE, INDEX_DOCUMENT_JOB, payload, {
          jobId: `index-doc-${documentId}-${nowMs()}`,
        });
        total += 1;
      }

      offset += batchSize;
      if ((batch.rowCount ?? 0) < batchSize) break;
    }

    res.json({ enqueued: total });
  });

  router.get("/dead", async (_req, res) => {
    const jobs = await listDeadJobs(deps, INDEX_QUEUE);
    res.json({ jobs });
  });

  router.post("/dead/:jobId/retry", async (req, res) => {
    const ok = await retryDeadJob(deps, INDEX_QUEUE, req.params.jobId);
    if (!ok) {
      res.status(404).json({ error: "job not found in dead list" });
      return;
    }
    res.json({ jobId: req.params.jobId, status: "waiting" });
  });

  router.get("/stats", async (_req, res) => {
    const queues = await getQueueStats(deps, INDEX_QUEUE);
    res.json({ queue: INDEX_QUEUE, ...queues });
  });

  return router;
}
