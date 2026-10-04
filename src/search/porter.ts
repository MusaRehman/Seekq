/** Porter stemmer (English), pure functions. */

function cons(word: string, i: number): boolean {
  const c = word[i];
  if (!c) return false;
  if ("aeiou".includes(c)) return false;
  if (c === "y" && i > 0) return !cons(word, i - 1);
  return true;
}

function mCount(word: string): number {
  let n = 0;
  let i = 0;
  if (cons(word, 0)) return 0;
  while (i < word.length && !cons(word, i)) i++;
  while (i < word.length) {
    while (i < word.length && cons(word, i)) i++;
    if (i >= word.length) return n;
    n++;
    while (i < word.length && !cons(word, i)) i++;
  }
  return n;
}

function vowelInStem(stem: string): boolean {
  for (let i = 0; i < stem.length; i++) {
    if (!cons(stem, i)) return true;
  }
  return false;
}

function doublec(word: string): boolean {
  if (word.length < 2) return false;
  return word.at(-1) === word.at(-2) && cons(word, word.length - 1);
}

function cvc(word: string): boolean {
  if (word.length < 3) return false;
  const i = word.length - 1;
  return cons(word, i - 2) && !cons(word, i - 1) && cons(word, i) && !"wxy".includes(word[i] ?? "");
}

function replaceEnd(word: string, suffix: string, repl: string): string {
  if (!word.endsWith(suffix)) return word;
  return word.slice(0, -suffix.length) + repl;
}

function step1a(word: string): string {
  if (word.endsWith("sses")) return word.slice(0, -2);
  if (word.endsWith("ies")) return word.slice(0, -2);
  if (word.endsWith("ss")) return word;
  if (word.endsWith("s")) return word.slice(0, -1);
  return word;
}

function step1b(word: string): string {
  let w = word;
  if (w.endsWith("eed")) {
    if (mCount(w.slice(0, -3)) > 0) return w.slice(0, -1);
    return w;
  }
  if (w.endsWith("ed") && vowelInStem(w.slice(0, -2))) {
    w = w.slice(0, -2);
    if (w.endsWith("at") || w.endsWith("bl") || w.endsWith("iz")) return `${w}e`;
    if (doublec(w)) return w.slice(0, -1);
    if (mCount(w) === 1 && cvc(w)) return `${w}e`;
    return w;
  }
  if (w.endsWith("ing") && vowelInStem(w.slice(0, -3))) {
    w = w.slice(0, -3);
    if (w.endsWith("at") || w.endsWith("bl") || w.endsWith("iz")) return `${w}e`;
    if (doublec(w)) return w.slice(0, -1);
    if (mCount(w) === 1 && cvc(w)) return `${w}e`;
    return w;
  }
  return w;
}

function step1c(word: string): string {
  if (!word.endsWith("y")) return word;
  if (vowelInStem(word.slice(0, -1))) return `${word.slice(0, -1)}i`;
  return word;
}

function step2(word: string): string {
  const map: [string, string][] = [
    ["ational", "ate"],
    ["tional", "tion"],
    ["enci", "ence"],
    ["anci", "ance"],
    ["izer", "ize"],
    ["abli", "able"],
    ["alli", "al"],
    ["entli", "ent"],
    ["eli", "e"],
    ["ousli", "ous"],
    ["ization", "ize"],
    ["ation", "ate"],
    ["ator", "ate"],
    ["alism", "al"],
    ["iveness", "ive"],
    ["fulness", "ful"],
    ["ousness", "ous"],
    ["aliti", "al"],
    ["iviti", "ive"],
    ["biliti", "ble"],
  ];
  for (const [suf, repl] of map) {
    if (word.endsWith(suf) && mCount(word.slice(0, -suf.length)) > 0) {
      return replaceEnd(word, suf, repl);
    }
  }
  return word;
}

function step3(word: string): string {
  const map: [string, string][] = [
    ["icate", "ic"],
    ["ative", ""],
    ["alize", "al"],
    ["iciti", "ic"],
    ["ical", "ic"],
    ["ful", ""],
    ["ness", ""],
  ];
  for (const [suf, repl] of map) {
    if (word.endsWith(suf) && mCount(word.slice(0, -suf.length)) > 0) {
      return replaceEnd(word, suf, repl);
    }
  }
  return word;
}

function step4(word: string): string {
  const suffixes = [
    "al", "ance", "ence", "er", "ic", "able", "ible", "ant", "ement",
    "ment", "ent", "ion", "ou", "ism", "ate", "iti", "ous", "ive", "ize",
  ];
  for (const suf of suffixes) {
    if (!word.endsWith(suf)) continue;
    const stem = word.slice(0, -suf.length);
    if (suf === "ion" && !/(s|t)$/.test(stem)) continue;
    if (mCount(stem) > 1) return stem;
  }
  return word;
}

function step5(word: string): string {
  let w = word;
  if (w.endsWith("e")) {
    const stem = w.slice(0, -1);
    if (mCount(stem) > 1 || (mCount(stem) === 1 && !cvc(stem))) {
      w = stem;
    }
  }
  if (w.endsWith("ll") && mCount(w) > 1) {
    w = w.slice(0, -1);
  }
  return w;
}

export function stemWord(word: string): string {
  if (word.length < 3) return word;
  let w = word.toLowerCase();
  if (!/^[a-z]+$/.test(w)) return w;
  w = step1a(w);
  w = step1b(w);
  w = step1c(w);
  if (mCount(w) > 0) w = step2(w);
  if (mCount(w) > 0) w = step3(w);
  if (mCount(w) > 0) w = step4(w);
  w = step5(w);
  return w;
}
