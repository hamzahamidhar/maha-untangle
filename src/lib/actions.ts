// Every change to the data goes through here, and every change is logged.
// Note what is NOT here: there is no "approve all" and nothing is ever
// approved, merged or closed without a person clicking for that one item.

import { aiConfig, chatJSON, REWRITE_SYSTEM } from "./ai";
import {
  buildCtx,
  classify,
  fullText,
  groupTitle,
  MERGE_THRESHOLD,
  outcomeNote,
  pair,
  refreshGroup,
} from "./engine";
import { analyseFresh, makeCtx } from "./store";
import { emptyStoreFrom, seedStore } from "./seedStore";
import { terms, wordCount } from "./text";
import { CATEGORY_LABEL, type Category, type Group, type Report, type Store, type TicketDraft } from "./types";

export type Action =
  | { type: "reset" }
  | { type: "importCsv"; csv: string }
  | { type: "saveDraft"; groupId: string; draft: TicketDraft }
  | { type: "approve"; groupId: string; draft?: TicketDraft }
  | { type: "setCategory"; groupId: string; category: Category; reason: string; knownIssueId?: string }
  | { type: "split"; groupId: string; reportId: string; reason: string }
  | { type: "merge"; groupId: string; intoId: string }
  | { type: "sendQuestion"; groupId: string; question: string }
  | { type: "logIdea"; groupId: string }
  | { type: "closeKnown"; groupId: string; knownIssueId?: string }
  | { type: "close"; groupId: string; note: string }
  | { type: "reopen"; groupId: string }
  | { type: "aiRewrite"; groupId: string }
  | { type: "testerCheck"; tester: string; stepId: string; comment: string }
  | { type: "testerSubmit"; tester: string; stepId: string; comment: string; browser?: string; sameAsGroupId?: string }
  | { type: "testerReply"; reportId: string; text: string };

export class ActionError extends Error {}

function log(store: Store, entry: Omit<Store["log"][number], "id" | "at">) {
  store.log.unshift({ id: `l${store.nextId++}`, at: new Date().toISOString(), ...entry });
}

function getGroup(store: Store, id: string): Group {
  const g = store.groups.find((x) => x.id === id);
  if (!g) throw new ActionError("That item no longer exists. Refresh the page.");
  return g;
}

function testersOf(store: Store, g: Group) {
  return g.reportIds.map((id) => store.reports.find((r) => r.id === id)?.tester).filter(Boolean).join(", ");
}

function newGroupFor(store: Store, reportIds: string[], stepId: string, category: Category): Group {
  const g: Group = {
    id: `g${store.nextId++}`,
    reportIds,
    stepId,
    aiCategory: category,
    category,
    categoryOverridden: false,
    categoryConfidence: "medium",
    categoryReasons: [],
    groupConfidence: null,
    groupReasons: [],
    missingEvidence: [],
    sharedTerms: [],
    memberScores: {},
    relatedGroups: [],
    status: "pending",
    locked: false,
  };
  store.groups.push(g);
  return g;
}

/** Recompute "possibly related" links for every open item (cheap at demo scale). */
async function refreshAll(store: Store) {
  const ctx = await makeCtx(store);
  for (const g of store.groups) refreshGroup(store, ctx, g, { keepCategory: true });
  return ctx;
}

// ---------- CSV import ----------
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") row.push(cell), (cell = "");
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((x) => x.trim())) rows.push(row);
      (row = []), (cell = "");
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

// ---------- The actions ----------
export async function applyAction(store: Store, a: Action): Promise<unknown> {
  switch (a.type) {
    case "reset": {
      Object.assign(store, seedStore());
      await analyseFresh(store, "Reset to the demo data");
      return { ok: true };
    }

    case "importCsv": {
      const rows = parseCsv(a.csv);
      if (rows.length < 2) throw new ActionError("The CSV needs a header row and at least one report.");
      const head = rows[0].map((h) => h.trim().toLowerCase());
      const col = (name: string) => head.findIndex((h) => h.includes(name));
      const ci = { tester: col("tester"), step: col("step"), comment: col("comment"), browser: col("browser") };
      if (ci.tester < 0 || ci.step < 0 || ci.comment < 0)
        throw new ActionError('The CSV needs columns called "tester", "step" and "comment" (and optionally "browser").');
      const base = seedStore();
      const stepFor = (v: string) => {
        const t = v.trim().toLowerCase();
        return (
          base.steps.find((s) => s.id.toLowerCase() === t || String(s.number) === t.replace(/^step\s*/, "") || s.name.toLowerCase() === t)?.id ??
          base.steps[0].id
        );
      };
      const reports: Omit<Report, "createdAt">[] = rows.slice(1).map((r, i) => ({
        id: `r${i + 1}`,
        tester: r[ci.tester]?.trim() || "Unknown tester",
        stepId: stepFor(r[ci.step] ?? ""),
        comment: r[ci.comment]?.trim() ?? "",
        browser: ci.browser >= 0 ? r[ci.browser]?.trim() : undefined,
      }));
      Object.assign(store, emptyStoreFrom(reports.filter((r) => r.comment)));
      await analyseFresh(store, "Imported a CSV");
      return { ok: true };
    }

    case "saveDraft": {
      const g = getGroup(store, a.groupId);
      g.draft = a.draft;
      g.draftEditedByPerson = true;
      log(store, { actor: "UAT manager", action: "Edited draft", groupId: g.id, detail: `Edited the ticket draft "${a.draft.title}".` });
      return { ok: true };
    }

    case "approve": {
      const g = getGroup(store, a.groupId);
      if (g.category !== "bug") throw new ActionError("Only items marked as a bug become tickets.");
      if (g.status !== "pending") throw new ActionError("This item has already been decided.");
      const edited = a.draft && JSON.stringify(a.draft) !== JSON.stringify(g.draft);
      if (a.draft) g.draft = a.draft;
      if (edited) g.draftEditedByPerson = true;
      g.ticketId = `UAT-${store.nextTicket++}`;
      g.status = "approved";
      g.locked = true;
      log(store, {
        actor: "UAT manager",
        action: "Approved ticket",
        groupId: g.id,
        detail: `Approved ${g.ticketId} "${g.draft?.title}", covering ${g.reportIds.length} report${g.reportIds.length > 1 ? "s" : ""} (${testersOf(store, g)})${edited ? ". Draft edited before approval" : ""}.`,
      });
      return { ok: true, ticketId: g.ticketId };
    }

    case "setCategory": {
      const g = getGroup(store, a.groupId);
      const before = g.category;
      g.category = a.category;
      g.categoryOverridden = a.category !== g.aiCategory;
      if (a.category === "known_issue") g.knownIssueId = a.knownIssueId ?? g.knownIssueId ?? store.knownIssues[0]?.id;
      g.draftEditedByPerson = false;
      const ctx = await makeCtx(store);
      refreshGroup(store, ctx, g, { keepCategory: true });
      log(store, {
        actor: "UAT manager",
        action: "Changed category",
        groupId: g.id,
        detail: `"${groupTitle(store, g)}": ${CATEGORY_LABEL[before]} → ${CATEGORY_LABEL[a.category]}.`,
        reason: a.reason,
        toolSuggested: CATEGORY_LABEL[g.aiCategory],
      });
      return { ok: true };
    }

    case "split": {
      const g = getGroup(store, a.groupId);
      const r = store.reports.find((x) => x.id === a.reportId);
      if (!r || !g.reportIds.includes(r.id)) throw new ActionError("That report isn't in this group.");
      if (g.reportIds.length < 2) throw new ActionError("This report is already on its own.");
      for (const other of g.reportIds) if (other !== r.id) store.cannotLink.push([r.id, other]);
      g.reportIds = g.reportIds.filter((id) => id !== r.id);
      g.locked = true;
      g.draftEditedByPerson = false;
      const ctx = await makeCtx(store);
      const c = classify(ctx, r);
      const ng = newGroupFor(store, [r.id], r.stepId, c.category);
      ng.locked = true;
      refreshGroup(store, ctx, ng, { reclassify: true });
      await refreshAll(store);
      log(store, {
        actor: "UAT manager",
        action: "Split out a report",
        groupId: g.id,
        detail: `Said ${r.tester}'s report is not the same as "${groupTitle(store, g)}". It is now its own item and won't be grouped with these reports again.`,
        reason: a.reason,
        toolSuggested: "Same issue",
      });
      return { ok: true, newGroupId: ng.id };
    }

    case "merge": {
      const g = getGroup(store, a.groupId);
      const into = getGroup(store, a.intoId);
      into.reportIds.push(...g.reportIds);
      store.groups = store.groups.filter((x) => x.id !== g.id);
      into.locked = true;
      into.draftEditedByPerson = false;
      await refreshAll(store);
      log(store, {
        actor: "UAT manager",
        action: "Merged",
        groupId: into.id,
        detail: `Merged "${groupTitle(store, g)}" into "${groupTitle(store, into)}"${into.ticketId ? ` (added as extra evidence on ${into.ticketId})` : ""}.`,
        toolSuggested: "Possibly related",
      });
      return { ok: true, groupId: into.id };
    }

    case "sendQuestion": {
      const g = getGroup(store, a.groupId);
      const now = new Date().toISOString();
      for (const id of g.reportIds) {
        const r = store.reports.find((x) => x.id === id)!;
        r.thread = [...(r.thread ?? []), { from: "manager", text: a.question, at: now }];
      }
      g.question = a.question;
      g.status = "question_sent";
      g.locked = true;
      log(store, { actor: "UAT manager", action: "Asked a kind question", groupId: g.id, detail: `Asked ${testersOf(store, g)}: "${a.question}"` });
      return { ok: true };
    }

    case "logIdea": {
      const g = getGroup(store, a.groupId);
      g.status = "logged_idea";
      g.locked = true;
      log(store, { actor: "UAT manager", action: "Logged idea", groupId: g.id, detail: `Added "${groupTitle(store, g)}" to the ideas backlog (${g.reportIds.length} tester${g.reportIds.length > 1 ? "s" : ""}).` });
      return { ok: true };
    }

    case "closeKnown": {
      const g = getGroup(store, a.groupId);
      if (a.knownIssueId) g.knownIssueId = a.knownIssueId;
      const ki = store.knownIssues.find((k) => k.id === g.knownIssueId);
      g.status = "closed_known";
      g.locked = true;
      log(store, { actor: "UAT manager", action: "Linked to known issue", groupId: g.id, detail: `Confirmed ${g.reportIds.length} report${g.reportIds.length > 1 ? "s" : ""} match the known issue "${ki?.title}".` });
      return { ok: true };
    }

    case "close": {
      const g = getGroup(store, a.groupId);
      g.status = "closed";
      g.outcomeNote = a.note;
      g.locked = true;
      log(store, { actor: "UAT manager", action: "Closed with thanks", groupId: g.id, detail: `Closed "${groupTitle(store, g)}" with a note to the tester: "${a.note}"` });
      return { ok: true };
    }

    case "reopen": {
      const g = getGroup(store, a.groupId);
      const was = g.ticketId;
      g.status = "pending";
      g.ticketId = undefined;
      log(store, { actor: "UAT manager", action: "Reopened", groupId: g.id, detail: `Reopened "${groupTitle(store, g)}"${was ? ` and withdrew ${was}` : ""}.` });
      return { ok: true };
    }

    case "aiRewrite": {
      if (!aiConfig.enabled) throw new ActionError("No AI key is set, so the local drafts are being used.");
      const g = getGroup(store, a.groupId);
      const step = store.steps.find((s) => s.id === g.stepId);
      const reports = g.reportIds.map((id) => store.reports.find((r) => r.id === id)!);
      const prompt = JSON.stringify({
        test_step: step,
        category: g.category,
        reports: reports.map((r) => ({ tester: r.tester, browser: r.browser, text: fullText(r) })),
        why_grouped: g.groupReasons.map((s) => s.text),
        current_title: g.draft?.title,
        want: {
          title: "a clear, specific ticket title under 80 characters (bugs only)",
          explanation: "2-3 plain-English sentences: why these reports were grouped and how sure we are. Mention anything that suggests they might NOT be the same.",
          question: g.category === "needs_detail" ? "a short, warm question asking the tester for the missing detail" : null,
        },
      });
      try {
        const out = await chatJSON<{ title?: string; explanation?: string; question?: string }>(REWRITE_SYSTEM, prompt);
        if (out.title && g.draft) g.draft = { ...g.draft, title: out.title };
        if (out.explanation) g.plainExplanation = out.explanation;
        if (out.question && g.category === "needs_detail") g.question = out.question;
        g.aiWritten = true;
      } catch (e) {
        throw new ActionError(`The AI didn't respond (${e instanceof Error ? e.message.slice(0, 120) : e}). The local draft is still there.`);
      }
      log(store, { actor: "System", action: "AI rewrite", groupId: g.id, detail: `AI suggested new wording for "${groupTitle(store, g)}". A person still has to approve it.` });
      return { ok: true };
    }

    // ---------- Tester side ----------
    case "testerCheck": {
      // Dry run: nothing is saved.
      const probe: Report = { id: "__probe", tester: a.tester, stepId: a.stepId, comment: a.comment, createdAt: "" };
      const tmp: Store = { ...store, reports: [...store.reports, probe] };
      // Live check while typing uses the fast local similarity (no API call per keystroke).
      const ctx = buildCtx(tmp);
      const c = classify(ctx, probe);
      const wc = wordCount(a.comment);
      const prompts: string[] = [];
      if (c.category === "needs_detail" || wc < 10) {
        if (!/expect|should|supposed|wanted/i.test(a.comment)) prompts.push("What did you expect to happen?");
        if (!/error|blank|nothing|froze|freez|crash|hang|stuck|instead|shows|says|wrong|fail|didn'?t|doesn'?t|can'?t|won'?t/i.test(a.comment))
          prompts.push("What happened instead? For example an error message, a blank screen, or nothing at all.");
        if (wc < 8) prompts.push("Which button or field were you using?");
      }
      const similar = store.groups
        .filter((g) => ["bug", "known_issue", "idea"].includes(g.category) && g.reportIds.length)
        .map((g) => {
          let s = 0;
          for (const id of g.reportIds) s += pair(ctx, "__probe", id).score;
          return { g, score: s / g.reportIds.length };
        })
        .filter((x) => x.score >= 0.4 && terms(a.comment).length > 0)
        .sort((x, y) => y.score - x.score)
        .slice(0, 2)
        .map(({ g, score }) => ({
          groupId: g.id,
          title: groupTitle(store, g),
          count: g.reportIds.length,
          status: g.status,
          ticketId: g.ticketId,
          sure: score >= 0.6 ? "high" : score >= 0.45 ? "medium" : "low",
        }));
      return { category: c.category, thin: c.category === "needs_detail", prompts, similar };
    }

    case "testerSubmit": {
      if (!a.comment.trim()) throw new ActionError("Please write a few words first.");
      const r: Report = {
        id: `t${store.nextId++}`,
        tester: a.tester.trim() || "Anonymous tester",
        stepId: a.stepId,
        comment: a.comment.trim(),
        browser: a.browser,
        createdAt: new Date().toISOString(),
      };
      store.reports.push(r);
      let target: Group | undefined;
      const ctx = await makeCtx(store);
      if (a.sameAsGroupId) {
        target = store.groups.find((g) => g.id === a.sameAsGroupId);
        if (target) r.testerConfirmedGroupId = target.id;
      }
      if (!target) {
        const c = classify(ctx, r);
        if (["bug", "idea", "known_issue"].includes(c.category)) {
          const best = store.groups
            .filter((g) => g.status === "pending" && !g.locked && g.category === c.category)
            .map((g) => ({ g, s: g.reportIds.reduce((t, id) => t + pair(ctx, r.id, id).score, 0) / g.reportIds.length }))
            .sort((x, y) => y.s - x.s)[0];
          if (best && best.s >= MERGE_THRESHOLD) target = best.g;
        }
        if (!target) target = newGroupFor(store, [], r.stepId, c.category);
      }
      target.reportIds.push(r.id);
      target.draftEditedByPerson = false;
      refreshGroup(store, ctx, target, { keepCategory: target.reportIds.length > 1, reclassify: target.reportIds.length === 1 });
      await refreshAll(store);
      log(store, {
        actor: "Tester",
        action: "New feedback",
        groupId: target.id,
        detail: `${r.tester} reported on step ${store.steps.find((s) => s.id === r.stepId)?.number}: "${r.comment}"${
          a.sameAsGroupId ? " (tester said it's the same as an existing report)" : target.reportIds.length > 1 ? " (suggested as a possible duplicate)" : ""
        }.`,
      });
      return { ok: true, reportId: r.id, groupId: target.id };
    }

    case "testerReply": {
      const r = store.reports.find((x) => x.id === a.reportId);
      if (!r) throw new ActionError("Report not found.");
      r.thread = [...(r.thread ?? []), { from: "tester", text: a.text.trim(), at: new Date().toISOString() }];
      const g = store.groups.find((x) => x.reportIds.includes(r.id));
      if (g) {
        g.status = "pending";
        g.categoryOverridden = false;
        g.locked = false;
        const ctx = await makeCtx(store);
        refreshGroup(store, ctx, g, { reclassify: true });
        await refreshAll(store);
        log(store, {
          actor: "Tester",
          action: "Replied",
          groupId: g.id,
          detail: `${r.tester} added detail: "${a.text.trim()}". Re-checked: now looks like "${CATEGORY_LABEL[g.category]}". Back in the review queue.`,
        });
      }
      return { ok: true };
    }
  }
}

/** Shape sent to the browser: store plus a few derived fields. */
export function viewOf(store: Store) {
  return {
    ...store,
    groups: store.groups.map((g) => ({ ...g, title: groupTitle(store, g), outcome: outcomeNote(store, g) })),
  };
}
