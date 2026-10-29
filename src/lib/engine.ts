// The Untangle engine: sorts feedback, groups duplicates, explains itself,
// and drafts tickets / kind questions. It never makes a decision — every
// output here is a SUGGESTION that a person approves, edits or overrules.
//
// Works with no API key (TF-IDF + glossary). If embeddings are supplied
// (see ai.ts), they replace the TF-IDF text similarity.

import { CONCEPT_BY_ID } from "./glossary";
import { concepts, stem, terms, termLabel, wordCount } from "./text";
import type {
  Category,
  Confidence,
  Group,
  KnownIssue,
  Report,
  Signal,
  Store,
  TestStep,
  TicketDraft,
} from "./types";

// ---------- Tunable thresholds (tweak these while testing) ----------
export const MERGE_THRESHOLD = 0.42; // average match needed to group reports
export const KNOWN_ISSUE_THRESHOLD = 0.42;
export const RELATED_THRESHOLD = 0.28; // shown as "possibly related"
const HIGH = 0.6;
const MEDIUM = 0.45;

const W_TEXT = 0.45;
const W_STEP = 0.25;
const W_CONCEPT = 0.3;

// ---------- Patterns ----------
const NOT_ACTIONABLE =
  /^\s*(n\/?a|none|nothing to report|all (good|fine)|no (issues?|problems?)|worked( fine)?|looks (good|fine)|fine|ok|okay)\b|ran out of time|didn'?t (get to|finish)|skipped/i;
const IDEA =
  /\b(would be (nice|great|good|useful|handy)|it'?d be (nice|great|good|useful)|would love|could you add|could we|can we have|suggest(ion)?|maybe add|nice to have|feature request|i wish)\b/i;
const VAGUE =
  /\b(weird|strange|odd|confusing|off|broken|doesn'?t work|not working|not great|bad|issue|problem)\b/i;
const FAILURE =
  /\b(error|fails?|failed|can'?t|cannot|couldn'?t|doesn'?t|won'?t|isn'?t|instead of|wrong|missing|lost|typo|ignores?|blank|rejected)\b/i;
const BLOCKING = /\b(can'?t|cannot|couldn'?t|unable|lost|stuck|froze|freezes|hangs|nothing happened|never appears|two|duplicate)\b/i;

// ---------- Context ----------
export interface Ctx {
  steps: Map<string, TestStep>;
  knownIssues: KnownIssue[];
  idf: Map<string, number>;
  vec: Map<string, Map<string, number>>; // id -> tf-idf vector
  conceptSet: Map<string, Set<string>>;
  stepOf: Map<string, string>;
  embeddings?: Record<string, number[]>;
}

/** The text we analyse for a report: the comment plus the tester's own replies. */
export function fullText(r: Report): string {
  const replies = (r.thread ?? []).filter((m) => m.from === "tester").map((m) => m.text);
  // End each part with punctuation so titles and sentences don't run together.
  return [r.comment, ...replies].map((t) => (/[.!?]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`)).join(" ");
}

function kiText(k: KnownIssue) {
  return `${k.title}. ${k.description}`;
}

export function buildCtx(store: Store, embeddings?: Record<string, number[]>): Ctx {
  const docs: { id: string; text: string; stepId: string }[] = [
    ...store.reports.map((r) => ({ id: r.id, text: fullText(r), stepId: r.stepId })),
    ...store.knownIssues.map((k) => ({ id: `ki:${k.id}`, text: kiText(k), stepId: k.stepId })),
  ];
  const df = new Map<string, number>();
  const tfs = new Map<string, Map<string, number>>();
  for (const d of docs) {
    const tf = new Map<string, number>();
    for (const t of terms(d.text)) tf.set(t, (tf.get(t) ?? 0) + 1);
    tfs.set(d.id, tf);
    for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const n = docs.length;
  const idf = new Map<string, number>();
  for (const [t, c] of df) idf.set(t, Math.log((n + 1) / (c + 0.5)));
  const vec = new Map<string, Map<string, number>>();
  for (const [id, tf] of tfs) {
    const v = new Map<string, number>();
    for (const [t, c] of tf) v.set(t, c * (idf.get(t) ?? 0));
    vec.set(id, v);
  }
  return {
    steps: new Map(store.steps.map((s) => [s.id, s])),
    knownIssues: store.knownIssues,
    idf,
    vec,
    conceptSet: new Map(docs.map((d) => [d.id, concepts(d.text)])),
    stepOf: new Map(docs.map((d) => [d.id, d.stepId])),
    embeddings,
  };
}

function cosineSparse(a?: Map<string, number>, b?: Map<string, number>) {
  if (!a || !b) return 0;
  let dot = 0,
    na = 0,
    nb = 0;
  for (const [t, x] of a) {
    na += x * x;
    const y = b.get(t);
    if (y) dot += x * y;
  }
  for (const y of b.values()) nb += y * y;
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

function cosineDense(a: number[], b: number[]) {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

function conceptOverlap(a: Set<string>, b: Set<string>) {
  const w = (id: string) => (CONCEPT_BY_ID[id]?.symptom ? 2 : 1);
  let inter = 0,
    union = 0;
  for (const id of new Set([...a, ...b])) {
    union += w(id);
    if (a.has(id) && b.has(id)) inter += w(id);
  }
  return union ? inter / union : 0;
}

export interface PairScore {
  score: number;
  text: number;
  sameStep: boolean;
  concept: number;
}

/** How alike are two documents (reports or known issues)? 0..1 */
export function pair(ctx: Ctx, a: string, b: string): PairScore {
  let text: number;
  const ea = ctx.embeddings?.[a];
  const eb = ctx.embeddings?.[b];
  if (ea && eb) {
    // Embedding cosines bunch up between ~0.3 and 0.9; stretch to 0..1.
    text = Math.min(1, Math.max(0, (cosineDense(ea, eb) - 0.3) / 0.55));
  } else {
    text = cosineSparse(ctx.vec.get(a), ctx.vec.get(b));
  }
  const sameStep = ctx.stepOf.get(a) === ctx.stepOf.get(b);
  const concept = conceptOverlap(ctx.conceptSet.get(a) ?? new Set(), ctx.conceptSet.get(b) ?? new Set());
  const score = W_TEXT * text + W_STEP * (sameStep ? 1 : 0) + W_CONCEPT * concept;
  return { score, text, sameStep, concept };
}

export function band(score: number): Confidence {
  return score >= HIGH ? "high" : score >= MEDIUM ? "medium" : "low";
}

// ---------- 1. Sort each report into a category ----------
export interface Classification {
  category: Category;
  confidence: Confidence;
  reasons: Signal[];
  knownIssueId?: string;
}

export function classify(ctx: Ctx, r: Report): Classification {
  const text = fullText(r);
  const wc = wordCount(text);
  const cs = ctx.conceptSet.get(r.id) ?? new Set();
  const hasSymptom = [...cs].some((c) => CONCEPT_BY_ID[c]?.symptom);

  if (NOT_ACTIONABLE.test(text) && wc <= 10) {
    return {
      category: "not_actionable",
      confidence: "high",
      reasons: [{ text: "Reads as a pass or a note that the step wasn't tested, not a problem.", strength: "strong" }],
    };
  }
  if (IDEA.test(text)) {
    const m = text.match(IDEA)?.[0];
    return {
      category: "idea",
      confidence: FAILURE.test(text) ? "medium" : "high",
      reasons: [
        { text: `Phrased as a suggestion ("${m}").`, strength: "strong" },
        ...(FAILURE.test(text)
          ? [{ text: "Also contains failure words, so it might hide a bug.", strength: "weak" as const }]
          : []),
      ],
    };
  }
  if (wc <= 3 || (wc <= 7 && VAGUE.test(text) && !hasSymptom)) {
    return {
      category: "needs_detail",
      confidence: wc <= 3 ? "high" : "medium",
      reasons: [
        { text: `Only ${wc} word${wc === 1 ? "" : "s"}, with no description of what happened or what was expected.`, strength: "strong" },
      ],
    };
  }

  // Already known?
  let best: { ki: KnownIssue; s: PairScore } | null = null;
  for (const ki of ctx.knownIssues) {
    const s = pair(ctx, r.id, `ki:${ki.id}`);
    if (!best || s.score > best.s.score) best = { ki, s };
  }
  if (best && best.s.score >= KNOWN_ISSUE_THRESHOLD) {
    const shared = [...(ctx.conceptSet.get(`ki:${best.ki.id}`) ?? [])].filter((c) => cs.has(c));
    return {
      category: "known_issue",
      confidence: band(best.s.score),
      knownIssueId: best.ki.id,
      reasons: [
        { text: `Matches known issue "${best.ki.title}".`, strength: best.s.score >= HIGH ? "strong" : "medium" },
        ...(best.s.sameStep ? [{ text: "Same test step as the known issue.", strength: "medium" as const }] : []),
        ...(shared.length
          ? [{ text: `Both mention: ${shared.map((c) => CONCEPT_BY_ID[c].label).join(", ")}.`, strength: "medium" as const }]
          : []),
      ],
    };
  }

  const failure = FAILURE.test(text);
  const reasons: Signal[] = [];
  if (hasSymptom)
    reasons.push({
      text: `Describes a symptom: ${[...cs].filter((c) => CONCEPT_BY_ID[c]?.symptom).map((c) => CONCEPT_BY_ID[c].label).join(", ")}.`,
      strength: "strong",
    });
  if (failure) reasons.push({ text: `Uses failure language ("${text.match(FAILURE)?.[0]}").`, strength: "medium" });
  if (!hasSymptom && !failure) reasons.push({ text: "No clear failure words — could also be an opinion.", strength: "weak" });
  const confidence: Confidence = (hasSymptom || failure) && wc >= 6 ? "high" : hasSymptom || failure ? "medium" : "low";
  return { category: "bug", confidence, reasons };
}

// ---------- 2. Group reports that describe the same thing ----------
const GROUPABLE: Category[] = ["bug", "idea", "known_issue"];

function cannot(store: Store, a: string, b: string) {
  return store.cannotLink.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

function avgLink(ctx: Ctx, A: string[], B: string[]) {
  let sum = 0;
  for (const a of A) for (const b of B) sum += pair(ctx, a, b).score;
  return sum / (A.length * B.length);
}

/** Rebuild every unlocked group from scratch (used on import / reset). */
export function fullAnalyse(store: Store, ctx: Ctx) {
  const locked = store.groups.filter((g) => g.locked || g.status !== "pending");
  const lockedIds = new Set(locked.flatMap((g) => g.reportIds));
  const free = store.reports.filter((r) => !lockedIds.has(r.id));

  const cls = new Map(free.map((r) => [r.id, classify(ctx, r)]));
  // Start with one cluster per report, then merge the closest compatible pair.
  let clusters: string[][] = free.map((r) => [r.id]);
  const compatible = (A: string[], B: string[]) => {
    const ca = cls.get(A[0])!;
    const cb = cls.get(B[0])!;
    if (ca.category !== cb.category || !GROUPABLE.includes(ca.category)) return false;
    if (ca.category === "known_issue" && ca.knownIssueId !== cb.knownIssueId) return false;
    return !A.some((a) => B.some((b) => cannot(store, a, b)));
  };
  for (;;) {
    let best: { i: number; j: number; s: number } | null = null;
    for (let i = 0; i < clusters.length; i++)
      for (let j = i + 1; j < clusters.length; j++) {
        if (!compatible(clusters[i], clusters[j])) continue;
        const s = avgLink(ctx, clusters[i], clusters[j]);
        if (!best || s > best.s) best = { i, j, s };
      }
    if (!best || best.s < MERGE_THRESHOLD) break;
    const merged = [...clusters[best.i], ...clusters[best.j]];
    clusters = clusters.filter((_, k) => k !== best!.i && k !== best!.j);
    clusters.push(merged);
  }
  const order = new Map(store.reports.map((r, i) => [r.id, i]));
  clusters.forEach((c) => c.sort((a, b) => order.get(a)! - order.get(b)!));
  clusters.sort((a, b) => order.get(a[0])! - order.get(b[0])!);

  const fresh: Group[] = clusters.map((ids) => {
    const c = cls.get(ids[0])!;
    const g: Group = {
      id: `g${store.nextId++}`,
      reportIds: ids,
      stepId: store.reports.find((r) => r.id === ids[0])!.stepId,
      aiCategory: c.category,
      category: c.category,
      categoryOverridden: false,
      categoryConfidence: c.confidence,
      categoryReasons: c.reasons,
      knownIssueId: c.knownIssueId,
      groupConfidence: null,
      groupReasons: [],
      missingEvidence: [],
      sharedTerms: [],
      memberScores: {},
      relatedGroups: [],
      status: "pending",
      locked: false,
    };
    return g;
  });
  store.groups = [...locked, ...fresh];
  for (const g of store.groups) refreshGroup(store, ctx, g, { keepCategory: true });
}

/** Recalculate everything derived about a group (after any change). */
export function refreshGroup(store: Store, ctx: Ctx, g: Group, opts: { keepCategory?: boolean; reclassify?: boolean } = {}) {
  const reports = g.reportIds.map((id) => store.reports.find((r) => r.id === id)!).filter(Boolean);
  if (!reports.length) return;
  g.stepId = mostCommon(reports.map((r) => r.stepId));

  if (opts.reclassify || !opts.keepCategory) {
    // Classify the group by its most detailed report.
    const lead = [...reports].sort((a, b) => wordCount(fullText(b)) - wordCount(fullText(a)))[0];
    const c = classify(ctx, lead);
    g.aiCategory = c.category;
    g.categoryConfidence = c.confidence;
    g.categoryReasons = c.reasons;
    g.knownIssueId = c.knownIssueId;
    if (!g.categoryOverridden) g.category = c.category;
  }

  // Member scores + group confidence
  g.memberScores = {};
  if (reports.length > 1) {
    let total = 0,
      pairs = 0;
    for (const a of reports) {
      let s = 0;
      for (const b of reports) if (a !== b) s += pair(ctx, a.id, b.id).score;
      g.memberScores[a.id] = s / (reports.length - 1);
    }
    for (let i = 0; i < reports.length; i++)
      for (let j = i + 1; j < reports.length; j++) {
        total += pair(ctx, reports[i].id, reports[j].id).score;
        pairs++;
      }
    const avg = total / pairs;
    g.groupConfidence = band(avg);
    const tc = reports.filter((r) => r.testerConfirmedGroupId === g.id).length;
    if (tc && g.groupConfidence !== "high") g.groupConfidence = g.groupConfidence === "low" ? "medium" : "high";
  } else {
    g.groupConfidence = null;
  }

  // Shared terms: appear in 2+ reports
  const counts = new Map<string, number>();
  for (const r of reports) for (const t of new Set(terms(fullText(r)))) counts.set(t, (counts.get(t) ?? 0) + 1);
  g.sharedTerms = reports.length > 1 ? [...counts].filter(([, c]) => c >= 2).map(([t]) => t) : [];

  // Why grouped
  const step = ctx.steps.get(g.stepId);
  g.groupReasons = [];
  if (reports.length > 1) {
    const allSameStep = reports.every((r) => r.stepId === g.stepId);
    if (allSameStep)
      g.groupReasons.push({ text: `All ${reports.length} reports are on step ${step?.number} (${step?.name}).`, strength: "strong" });
    else g.groupReasons.push({ text: "Reports come from different test steps.", strength: "weak" });
    const sharedConcepts = g.sharedTerms.filter((t) => t.startsWith("c:"));
    if (sharedConcepts.length)
      g.groupReasons.push({
        text: `They describe the same things: ${sharedConcepts.map(termLabel).join(", ")}.`,
        strength: sharedConcepts.some((t) => CONCEPT_BY_ID[t.slice(2)]?.symptom) ? "strong" : "medium",
      });
    const words = g.sharedTerms.filter((t) => !t.startsWith("c:")).map((t) => displayWord(reports, t));
    if (words.length) g.groupReasons.push({ text: `Shared words: ${words.slice(0, 6).join(", ")}.`, strength: "weak" });
    const browsers = [...new Set(reports.map((r) => r.browser).filter(Boolean))];
    if (browsers.length > 1)
      g.groupReasons.push({ text: `Seen on ${browsers.length} browsers (${browsers.join(", ")}), so it isn't browser-specific.`, strength: "medium" });
    const confirmed = reports.filter((r) => r.testerConfirmedGroupId === g.id);
    for (const r of confirmed)
      g.groupReasons.push({ text: `${r.tester} said their report is the same issue.`, strength: "strong" });
  }

  // What's missing (honest uncertainty)
  g.missingEvidence = [];
  if (reports.length > 1) {
    const weakest = Object.entries(g.memberScores).sort((a, b) => a[1] - b[1])[0];
    if (weakest && weakest[1] < MEDIUM) {
      const r = reports.find((x) => x.id === weakest[0])!;
      g.missingEvidence.push(`${r.tester}'s report matches less strongly than the others. Check it belongs.`);
    }
    const browsers = new Set(reports.map((r) => r.browser).filter(Boolean));
    if (browsers.size === 1) g.missingEvidence.push(`All reports are from ${[...browsers][0]}, so it may be browser-specific.`);
  }
  if (g.category === "bug") {
    if (reports.length === 1) g.missingEvidence.push("Only one tester has reported this so far.");
    if (!reports.some((r) => /error|message|says|shows ['"]/i.test(fullText(r))))
      g.missingEvidence.push("No tester quoted an error message.");
  }
  if (g.category === "needs_detail")
    g.missingEvidence.push("We don't know what the tester expected, or what actually happened.");

  // Possibly related groups (incl. decided ones), for merge suggestions
  g.relatedGroups = store.groups
    .filter((o) => o.id !== g.id && o.reportIds.length && o.category !== "not_actionable")
    .map((o) => ({ id: o.id, score: avgLink(ctx, g.reportIds, o.reportIds) }))
    .filter((x) => x.score >= RELATED_THRESHOLD)
    .filter((x) => !g.reportIds.some((a) => store.groups.find((o) => o.id === x.id)!.reportIds.some((b) => cannot(store, a, b))))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  // Drafts (unless a person already edited them)
  if (g.category === "bug" && !g.draftEditedByPerson) g.draft = draftTicket(ctx, g, reports);
  if (g.category === "needs_detail" && g.status === "pending") g.question = kindQuestion(store, ctx, g, reports);
  if (!g.aiWritten) g.plainExplanation = explain(ctx, g, reports);
}

/** Show a stemmed term as a real word a tester used ("typ" -> "typing"). */
function displayWord(reports: Report[], stemmed: string) {
  for (const r of reports)
    for (const w of fullText(r).toLowerCase().match(/[a-z0-9']+/g) ?? []) if (stem(w) === stemmed) return w;
  return stemmed;
}

function mostCommon<T>(xs: T[]): T {
  const m = new Map<T, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1])[0][0];
}

// ---------- 3. Drafts and explanations ----------
function firstSentence(s: string, max = 90) {
  const one = s.split(/(?<=[.!?])\s|\s-\s/)[0].trim().replace(/[.!?]$/, "");
  const cap = one.charAt(0).toUpperCase() + one.slice(1);
  return cap.length > max ? cap.slice(0, max - 1).trimEnd() + "…" : cap;
}

/** The most "central" report — best matched to the rest, then most detailed. */
export function leadReport(g: Group, reports: Report[]) {
  return [...reports].sort(
    (a, b) =>
      (g.memberScores[b.id] ?? 0) - (g.memberScores[a.id] ?? 0) ||
      wordCount(fullText(b)) - wordCount(fullText(a)),
  )[0];
}

export function groupTitle(store: Store, g: Group): string {
  if (g.category === "bug" && g.draft?.title) return g.draft.title;
  const reports = g.reportIds.map((id) => store.reports.find((r) => r.id === id)!).filter(Boolean);
  if (!reports.length) return "(empty)";
  return firstSentence(fullText(leadReport(g, reports)), 80);
}

function draftTicket(ctx: Ctx, g: Group, reports: Report[]): TicketDraft {
  const step = ctx.steps.get(g.stepId);
  const before = [...ctx.steps.values()].filter((s) => step && s.number < step.number);
  const lead = leadReport(g, reports);
  const text = reports.map(fullText).join(" ");
  const severity: TicketDraft["severity"] = /typo|spelling/i.test(text)
    ? "Low"
    : BLOCKING.test(text)
      ? "High"
      : "Medium";
  return {
    title: `${step ? `${step.name}: ` : ""}${firstSentence(fullText(lead), 70)}`,
    stepsToReproduce: [
      ...(before.length ? [`Complete steps 1–${before.length} of the test script (${before.map((s) => s.name).join(" → ")}).`] : []),
      ...(step ? [`Step ${step.number}: ${step.instruction}`] : []),
    ],
    expected: step?.expected ?? "",
    actual: reports.map((r) => `${r.tester}: "${fullText(r)}"`),
    severity,
    environment: [...new Set(reports.map((r) => r.browser).filter(Boolean) as string[])],
  };
}

function firstName(t: string) {
  return t.split(/\s+/)[0];
}

function kindQuestion(store: Store, ctx: Ctx, g: Group, reports: Report[]) {
  const step = ctx.steps.get(g.stepId);
  const r = reports[0];
  const related = g.relatedGroups[0] ? store.groups.find((x) => x.id === g.relatedGroups[0].id) : undefined;
  const lines = [
    `Hi ${firstName(r.tester)}, thanks for flagging something on step ${step?.number} (${step?.name}). It's really helpful.`,
    `Could you tell us a little more? What did you expect to happen, and what happened instead?`,
  ];
  if (related) lines.push(`Is it similar to this report from another tester: "${groupTitle(store, related)}"?`);
  lines.push("If you saw an error message or can take a screenshot, that would help us fix it faster.");
  return lines.join(" ");
}

function explain(ctx: Ctx, g: Group, reports: Report[]) {
  const step = ctx.steps.get(g.stepId);
  if (reports.length > 1) {
    const cs = g.sharedTerms.filter((t) => t.startsWith("c:")).map(termLabel);
    const allSame = reports.every((r) => r.stepId === g.stepId);
    return `Grouped because ${allSame ? `all ${reports.length} reports are on step ${step?.number} (${step?.name})` : "the reports use similar wording"}${
      cs.length ? ` and they all point to the same thing: ${cs.join(", ")}` : ""
    }. Wording differs, but the problem described looks the same.`;
  }
  const c = g.categoryReasons[0]?.text ?? "";
  return `A single report on step ${step?.number} (${step?.name}). ${c}`;
}

/** What the tester sees once a person has decided. Always kind, never "rejected". */
export function outcomeNote(store: Store, g: Group): string {
  const n = g.reportIds.length;
  const others = n > 1 ? ` You were one of ${n} testers who spotted this, which helped us see how much it matters.` : "";
  switch (g.status) {
    case "approved":
      return `Thank you! This is now ticket ${g.ticketId} and the developers will pick it up.${others}`;
    case "closed_known": {
      const ki = store.knownIssues.find((k) => k.id === g.knownIssueId);
      return `Thanks, this is a problem we already know about${ki ? ` ("${ki.title}")` : ""}. It's being worked on, and your report adds weight to the fix.`;
    }
    case "logged_idea":
      return `Great suggestion. It's not a bug, so it's been added to the ideas backlog for the product team.${n > 1 ? ` ${n} testers suggested something similar.` : ""}`;
    case "question_sent":
      return "We'd love a little more detail. Please see the question below.";
    case "closed":
      return g.outcomeNote ?? "Thanks for testing this step. Your note has been recorded.";
    default:
      return "Waiting for review. A person reads every report.";
  }
}
