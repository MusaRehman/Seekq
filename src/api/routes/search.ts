import { Router } from "express";
import type { DbDeps } from "../../shared/types.js";
import { searchDocuments } from "../../search/searcher.js";

export function createSearchRouter(deps: DbDeps): Router {
  const router = Router();
  const search = searchDocuments(deps);

  router.get("/", async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const limit = Math.min(
      100,
      Math.max(1, Number(req.query.limit ?? 10) || 10),
    );
    const offset = Math.max(0, Number(req.query.offset ?? 0) || 0);

    if (!q.trim()) {
      res.status(400).json({ error: "query parameter q is required" });
      return;
    }

    const results = await search(q, limit, offset);
    res.json({ query: q, limit, offset, results });
  });

  return router;
}
