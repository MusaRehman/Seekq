import { Router } from "express";
import type { RedisDeps } from "../../shared/types.js";
import { getJob } from "../../queue/redis-ops.js";

export function createJobsRouter(deps: RedisDeps): Router {
  const router = Router();

  router.get("/:id", async (req, res) => {
    const job = await getJob(deps, req.params.id);
    if (!job) {
      res.status(404).json({ error: "job not found" });
      return;
    }
    res.json(job);
  });

  return router;
}
