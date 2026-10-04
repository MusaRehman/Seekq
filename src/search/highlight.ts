import { tokenizeWithPositions } from "./analyzer.js";

/** Short snippet with ** around matched word positions. */
export function highlight(
  originalText: string,
  matchPositions: number[],
  snippetSize = 12,
): string {
  if (matchPositions.length === 0) {
    return originalText.slice(0, 80);
  }

  const words = tokenizeWithPositions(originalText);
  if (words.length === 0) {
    return "";
  }

  const matchSet = new Set(matchPositions);
  const firstMatch = Math.min(...matchPositions);
  const half = Math.floor(snippetSize / 2);
  const start = Math.max(0, firstMatch - half);
  const end = Math.min(words.length, start + snippetSize);

  const slice = words.slice(start, end);
  const parts = slice.map(({ word, position }) =>
    matchSet.has(position) ? `**${word}**` : word,
  );

  let snippet = parts.join(" ");
  if (start > 0) snippet = `… ${snippet}`;
  if (end < words.length) snippet = `${snippet} …`;
  return snippet;
}
