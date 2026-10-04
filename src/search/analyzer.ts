import { stemWord } from "./porter.js";

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
  "has", "he", "in", "is", "it", "its", "of", "on", "that", "the",
  "to", "was", "were", "will", "with",
]);

export type AnalyzedToken = { term: string; position: number };

export type TermData = { term: string; tf: number; positions: number[] };

const WORD_RE = /[\p{L}\p{N}]+/gu;

/** Raw words with positions (includes stop words). */
export function tokenizeWithPositions(text: string): { word: string; position: number }[] {
  const out: { word: string; position: number }[] = [];
  let position = 0;
  for (const match of text.matchAll(WORD_RE)) {
    const word = match[0];
    if (!word) continue;
    out.push({ word: word.toLowerCase(), position });
    position += 1;
  }
  return out;
}

/** Same pipeline for documents and queries. */
export function analyze(text: string): AnalyzedToken[] {
  const tokens = tokenizeWithPositions(text);
  const out: AnalyzedToken[] = [];
  for (const { word, position } of tokens) {
    if (STOP_WORDS.has(word)) continue;
    const term = stemWord(word);
    if (!term) continue;
    out.push({ term, position });
  }
  return out;
}

export function groupByTerm(tokens: AnalyzedToken[]): TermData[] {
  const map = new Map<string, TermData>();
  for (const { term, position } of tokens) {
    const existing = map.get(term);
    if (!existing) {
      map.set(term, { term, tf: 1, positions: [position] });
      continue;
    }
    existing.tf += 1;
    existing.positions.push(position);
  }
  return [...map.values()];
}

export function documentWordLength(text: string): number {
  return tokenizeWithPositions(text).length;
}
