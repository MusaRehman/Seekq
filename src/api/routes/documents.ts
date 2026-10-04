import { Router } from "express";
import pg from "pg";
import type { AppDeps } from "../../shared/types.js";
import {
  INDEX_DOCUMENT_JOB,
  INDEX_QUEUE,
  type IndexDocumentPayload,
} from "../../queue/jobs.js";
import { enqueue } from "../../queue/redis-ops.js";
import { parseCreateDocumentBody } from "../schemas.js";

export function createDocumentsRouter(deps: AppDeps): Router {
  const router = Router();

  router.post("/", async (req, res) => {
    const parsed = parseCreateDocumentBody(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    const { external_id, title, body } = parsed.data;

    try {
      const result = await deps.db.query<{ id: string }>(
        `INSERT INTO documents (external_id, title, body, status)
         VALUES ($1, $2, $3, 'pending')
         RETURNING id`,
        [external_id, title, body],
      );

      const documentId = Number(result.rows[0].id);
      const payload: IndexDocumentPayload = { documentId };

      const { jobId, created } = await enqueue(
        deps,
        INDEX_QUEUE,
        INDEX_DOCUMENT_JOB,
        payload,
        { jobId: `index-doc-${documentId}` },
      );

      res.status(202).json({
        documentId,
        jobId,
        enqueued: created,
        status: "pending",
      });
    } catch (err) {
      if (err instanceof pg.DatabaseError && err.code === "23505") {
        res.status(409).json({ error: "document with this external_id already exists" });
        return;
      }
      console.error("[documents] upload failed:", err);
      res.status(500).json({ error: "failed to save document" });
    }
  });

  return router;
}
