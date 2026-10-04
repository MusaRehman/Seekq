import type { DbDeps } from "../shared/types.js";
import type { IndexDocumentPayload } from "../queue/jobs.js";
import { analyze, documentWordLength, groupByTerm } from "./analyzer.js";
import { saveIndex } from "./index-repo.js";

export function indexDocument(deps: DbDeps) {
  const persist = saveIndex(deps);

  return async (payload: IndexDocumentPayload): Promise<void> => {
    const result = await deps.db.query<{
      id: string;
      title: string;
      body: string;
    }>("SELECT id, title, body FROM documents WHERE id = $1", [
      payload.documentId,
    ]);

    if (result.rowCount === 0) {
      throw new Error(`document ${payload.documentId} not found`);
    }

    const doc = result.rows[0];
    const text = `${doc.title}\n${doc.body}`;
    const tokens = analyze(text);
    const termData = groupByTerm(tokens);
    const docLength = documentWordLength(text);

    await persist(Number(doc.id), termData, docLength);
  };
}
