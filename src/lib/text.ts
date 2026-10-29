// Text helpers shared by the server engine and the browser (for highlighting).
// No Node-only imports here.

import { GLOSSARY, CONCEPT_BY_ID } from "./glossary";

const STOPWORDS = new Set(
  (
    "a an the and or but if then so to of in on at by for with from into onto up down out over " +
    "i me my we our you your it its it's this that these those there here is are was were be been being " +
    "am do does did doing done have has had having just only very really also too as than when while " +
    "after before again all any some each every both more most other such no nor not own same can could " +
    "would should will shall may might must get got gets make makes made which who whom what where why how " +
    "step page bit thing things one whole about like still even ever let"
  ).split(" "),
);

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Phrase matchers, longest phrase first so "stopped responding" wins over "responding".
const PHRASE_MATCHERS: { conceptId: string; re: RegExp; len: number }[] = GLOSSARY.flatMap(
  (c) =>
    c.phrases.map((p) => ({
      conceptId: c.id,
      len: p.length,
      re: new RegExp(`(?<![a-z0-9])${escapeRegex(p)}(?![a-z0-9])`, "gi"),
    })),
).sort((a, b) => b.len - a.len);

export interface Span {
  start: number;
  end: number;
  conceptId?: string;
}

/** Find glossary phrases in the text (non-overlapping, longest first). */
export function conceptSpans(text: string): Span[] {
  const taken: Span[] = [];
  for (const m of PHRASE_MATCHERS) {
    m.re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = m.re.exec(text))) {
      const s = match.index;
      const e = s + match[0].length;
      if (!taken.some((t) => s < t.end && e > t.start)) {
        taken.push({ start: s, end: e, conceptId: m.conceptId });
      }
    }
  }
  return taken.sort((a, b) => a.start - b.start);
}

export function concepts(text: string): Set<string> {
  return new Set(conceptSpans(text).map((s) => s.conceptId!));
}

export function stem(word: string): string {
  let w = word.toLowerCase();
  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith("es")) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  else if (w.length > 4 && w.endsWith("ly")) w = w.slice(0, -2);
  return w;
}

/**
 * Turn a comment into comparable terms:
 *  - glossary concepts become "c:<id>"
 *  - remaining words are lower-cased, stop-words removed, lightly stemmed
 */
export function terms(text: string): string[] {
  const spans = conceptSpans(text);
  const out: string[] = spans.map((s) => `c:${s.conceptId}`);
  // Blank out matched phrases, then tokenise the rest.
  let rest = text;
  for (const s of [...spans].reverse()) {
    rest = rest.slice(0, s.start) + " ".repeat(s.end - s.start) + rest.slice(s.end);
  }
  for (const raw of rest.toLowerCase().split(/[^a-z0-9']+/)) {
    const w = raw.replace(/^'+|'+$/g, "");
    if (!w || w.length < 3 || STOPWORDS.has(w) || /^\d+$/.test(w)) continue;
    out.push(stem(w));
  }
  return out;
}

export function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Human-friendly label for a term ("c:freeze" -> "freezes / stops responding"). */
export function termLabel(term: string): string {
  if (term.startsWith("c:")) return CONCEPT_BY_ID[term.slice(2)]?.label ?? term.slice(2);
  return term;
}

/**
 * Split text into segments, marking the parts that match any shared term.
 * Used by the UI to highlight "why these were grouped".
 */
export function highlightSegments(
  text: string,
  shared: string[],
): { text: string; hit: boolean }[] {
  const sharedSet = new Set(shared);
  const spans: Span[] = conceptSpans(text).filter((s) => sharedSet.has(`c:${s.conceptId}`));
  // Plain words
  const wordRe = /[A-Za-z0-9']+/g;
  let m: RegExpExecArray | null;
  while ((m = wordRe.exec(text))) {
    const s = m.index;
    const e = s + m[0].length;
    if (m[0].length < 3) continue;
    if (sharedSet.has(stem(m[0])) && !spans.some((t) => s < t.end && e > t.start)) {
      spans.push({ start: s, end: e });
    }
  }
  spans.sort((a, b) => a.start - b.start);
  const out: { text: string; hit: boolean }[] = [];
  let pos = 0;
  for (const s of spans) {
    if (s.start < pos) continue;
    if (s.start > pos) out.push({ text: text.slice(pos, s.start), hit: false });
    out.push({ text: text.slice(s.start, s.end), hit: true });
    pos = s.end;
  }
  if (pos < text.length) out.push({ text: text.slice(pos), hit: false });
  return out;
}
