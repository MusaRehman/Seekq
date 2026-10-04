/** BM25 word score (pure). k1=2.2, b=0.75 per spec. */
export function scoreWord(
  termFreqInDoc: number,
  docFrequency: number,
  corpusDocCount: number,
  docLength: number,
  avgDocLength: number,
): number {
  const N = corpusDocCount;
  const df = docFrequency;
  const count = termFreqInDoc;
  const myLength = docLength;
  const avgLength = avgDocLength <= 0 ? 1 : avgDocLength;

  const weight = Math.log(1 + (N - df + 0.5) / (df + 0.5));
  const strength =
    (count * 2.2) /
    (count + 1.2 * (0.25 + 0.75 * (myLength / avgLength)));

  return weight * strength;
}

export type DocScore = { docId: number; score: number };

export function rankDocuments(
  perDocScores: Map<number, number>,
): DocScore[] {
  return [...perDocScores.entries()]
    .map(([docId, score]) => ({ docId, score }))
    .sort((a, b) => b.score - a.score);
}
