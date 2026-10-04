import type { DbDeps } from "../shared/types.js";
import { analyze } from "./analyzer.js";
import { rankDocuments, scoreWord } from "./bm25.js";
import { highlight } from "./highlight.js";

export type SearchHit = {
  id: number;
  title: string;
  score: number;
  snippet: string;
};

export function searchDocuments(deps: DbDeps) {
  return async (
    query: string,
    limit: number,
    offset: number,
  ): Promise<SearchHit[]> => {
    const tokens = analyze(query);
    if (tokens.length === 0) {
      return [];
    }

    const terms = [...new Set(tokens.map((t) => t.term))];

    const stats = await deps.db.query<{ doc_count: number; total_length: string }>(
      "SELECT doc_count, total_length FROM index_stats WHERE id = 1",
    );
    const N = stats.rows[0]?.doc_count ?? 0;
    if (N === 0) {
      return [];
    }
    const totalLength = Number(stats.rows[0]?.total_length ?? 0);
    const avgLength = totalLength / N;

    const perDocScores = new Map<number, number>();
    const perDocMatchPositions = new Map<number, Set<number>>();

    for (const term of terms) {
      const postingRows = await deps.db.query<{
        doc_id: string;
        tf: number;
        length: number;
        positions: number[];
      }>(
        `SELECT p.doc_id, p.tf, p.positions, d.length
         FROM postings p
         INNER JOIN documents d ON d.id = p.doc_id
         WHERE p.term = $1 AND d.status = 'indexed'`,
        [term],
      );

      const df = postingRows.rowCount ?? 0;
      if (df === 0) continue;

      for (const row of postingRows.rows) {
        const docId = Number(row.doc_id);
        const wordScore = scoreWord(row.tf, df, N, row.length, avgLength);
        perDocScores.set(docId, (perDocScores.get(docId) ?? 0) + wordScore);

        if (!perDocMatchPositions.has(docId)) {
          perDocMatchPositions.set(docId, new Set());
        }
        const set = perDocMatchPositions.get(docId)!;
        for (const p of row.positions) {
          set.add(p);
        }
      }
    }

    const ranked = rankDocuments(perDocScores);
    const page = ranked.slice(offset, offset + limit);

    const hits: SearchHit[] = [];
    for (const { docId, score } of page) {
      const doc = await deps.db.query<{ title: string; body: string }>(
        "SELECT title, body FROM documents WHERE id = $1",
        [docId],
      );
      if (doc.rowCount === 0) continue;
      const { title, body } = doc.rows[0];
      const text = `${title}\n${body}`;
      const matchPositions = [...(perDocMatchPositions.get(docId) ?? [])];
      hits.push({
        id: docId,
        title,
        score: Math.round(score * 1000) / 1000,
        snippet: highlight(text, matchPositions),
      });
    }

    return hits;
  };
}
