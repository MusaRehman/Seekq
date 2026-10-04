import type { DbDeps } from "../shared/types.js";
import type { TermData } from "./analyzer.js";

export function saveIndex(deps: DbDeps) {
  return async (
    docId: number,
    termData: TermData[],
    docLength: number,
  ): Promise<void> => {
    const client = await deps.db.connect();
    try {
      await client.query("BEGIN");

      const prev = await client.query<{ length: number; status: string }>(
        "SELECT length, status FROM documents WHERE id = $1 FOR UPDATE",
        [docId],
      );
      if (prev.rowCount === 0) {
        throw new Error(`document ${docId} not found`);
      }

      const oldLength = prev.rows[0].length;
      const wasIndexed = prev.rows[0].status === "indexed";

      await client.query("DELETE FROM postings WHERE doc_id = $1", [docId]);

      for (const row of termData) {
        await client.query(
          `INSERT INTO postings (term, doc_id, tf, positions)
           VALUES ($1, $2, $3, $4)`,
          [row.term, docId, row.tf, row.positions],
        );
      }

      await client.query(
        `UPDATE documents
         SET length = $2, status = 'indexed', indexed_at = NOW()
         WHERE id = $1`,
        [docId, docLength],
      );

      if (wasIndexed) {
        await client.query(
          `UPDATE index_stats
           SET total_length = total_length - $1 + $2
           WHERE id = 1`,
          [oldLength, docLength],
        );
      } else {
        await client.query(
          `UPDATE index_stats
           SET doc_count = doc_count + 1,
               total_length = total_length + $1
           WHERE id = 1`,
          [docLength],
        );
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  };
}
