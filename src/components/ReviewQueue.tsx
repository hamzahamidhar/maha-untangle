"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_LABEL, type Category, type Report, type TicketDraft } from "@/lib/types";
import { Button, Card, CategoryBadge, ConfidencePill, Highlight, SignalList, StatusBadge, timeAgo } from "./ui";
import { useAppState, type AppState, type ViewGroup } from "./useAppState";

type Tab = "todo" | "decided" | "all";

export function ReviewQueue() {
  const { state, error, setError, busy, act } = useAppState();
  const [tab, setTab] = useState<Tab>("todo");
  const [catFilter, setCatFilter] = useState<Category | "any">("any");
  const [selected, setSelected] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const list = useMemo(() => {
    if (!state) return [];
    const rank = { high: 0, medium: 1, low: 2 } as const;
    return state.groups
      .filter((g) => (tab === "todo" ? g.status === "pending" : tab === "decided" ? g.status !== "pending" : true))
      .filter((g) => catFilter === "any" || g.category === catFilter)
      .sort(
        (a, b) =>
          Number(a.status !== "pending") - Number(b.status !== "pending") ||
          b.reportIds.length - a.reportIds.length ||
          rank[a.categoryConfidence] - rank[b.categoryConfidence],
      );
  }, [state, tab, catFilter]);

  const current = state?.groups.find((g) => g.id === selected) ?? list[0];

  if (!state) return <div className="p-8 text-slate-500">Loading feedback…</div>;

  const pending = state.groups.filter((g) => g.status === "pending");
  const run = async (action: Parameters<typeof act>[0], msg: string, next?: (r: Record<string, unknown>) => void) => {
    const r = await act(action);
    if (r) {
      setFlash(msg);
      next?.(r);
    }
  };
  const goNext = () => {
    const idx = list.findIndex((g) => g.id === current?.id);
    const nxt = list.slice(idx + 1).find((g) => g.status === "pending") ?? list.find((g) => g.status === "pending" && g.id !== current?.id);
    if (nxt) setSelected(nxt.id);
    setFlash(null);
  };

  return (
    <div className="flex flex-1 min-h-0 h-[calc(100vh-3.5rem)]">
      {/* ---------- Left: the queue ---------- */}
      <aside className="w-[360px] shrink-0 border-r border-slate-200 bg-white flex flex-col">
        <div className="p-4 border-b border-slate-200 space-y-3">
          <div>
            <h1 className="font-semibold">Review queue</h1>
            <p className="text-xs text-slate-500">
              {state.reports.length} reports from {new Set(state.reports.map((r) => r.tester)).size} testers on {state.appName} ·{" "}
              {pending.length} items need a person
            </p>
          </div>
          <div className="flex gap-1 text-sm">
            {(["todo", "decided", "all"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-2.5 py-1 rounded-md ${tab === t ? "bg-brand-soft text-brand font-semibold" : "text-slate-600 hover:bg-slate-100"}`}
              >
                {t === "todo" ? `To review (${pending.length})` : t === "decided" ? `Decided (${state.groups.length - pending.length})` : "All"}
              </button>
            ))}
          </div>
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value as Category | "any")}
            className="w-full text-sm border border-slate-300 rounded-md px-2 py-1.5 bg-white"
            aria-label="Filter by category"
          >
            <option value="any">All categories</option>
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v} ({state.groups.filter((g) => g.category === k && (tab !== "todo" || g.status === "pending")).length})
              </option>
            ))}
          </select>
        </div>
        <ul className="flex-1 overflow-y-auto">
          {list.map((g) => (
            <li key={g.id}>
              <button
                onClick={() => {
                  setSelected(g.id);
                  setFlash(null);
                  setError(null);
                }}
                className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 ${current?.id === g.id ? "bg-brand-soft/70 border-l-4 border-l-brand pl-3" : ""}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <CategoryBadge c={g.category} />
                  {g.reportIds.length > 1 && (
                    <span className="text-xs font-semibold text-slate-700">{g.reportIds.length} reports</span>
                  )}
                  <span className="ml-auto text-xs text-slate-400">Step {state.steps.find((s) => s.id === g.stepId)?.number}</span>
                </div>
                <div className="text-sm text-slate-800 line-clamp-2">{g.title}</div>
                <div className="flex items-center gap-2 mt-1">
                  {g.groupConfidence ? <ConfidencePill c={g.groupConfidence} prefix="Same issue" /> : <ConfidencePill c={g.categoryConfidence} prefix="Category" />}
                  {g.status !== "pending" && (
                    <span className="ml-auto">
                      <StatusBadge s={g.status} ticketId={g.ticketId} />
                    </span>
                  )}
                </div>
              </button>
            </li>
          ))}
          {!list.length && <li className="p-6 text-sm text-slate-500">Nothing here. {tab === "todo" && "Every item has been reviewed by a person. 🎉"}</li>}
        </ul>
        <DataControls act={act} busy={busy} onDone={() => setSelected(null)} />
      </aside>

      {/* ---------- Right: one item at a time ---------- */}
      <main className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="mb-4 rounded-lg bg-rose-50 text-rose-800 px-4 py-3 text-sm ring-1 ring-rose-200">{error}</div>
        )}
        {flash && (
          <div className="mb-4 rounded-lg bg-emerald-50 text-emerald-800 px-4 py-3 text-sm ring-1 ring-emerald-200 flex items-center gap-3">
            <span>✓ {flash}</span>
            <Button kind="secondary" className="ml-auto" onClick={goNext}>
              Next item to review →
            </Button>
          </div>
        )}
        {current ? (
          <GroupReview key={current.id} g={current} state={state} busy={busy} run={run} select={setSelected} />
        ) : (
          <div className="text-slate-500">Select an item on the left.</div>
        )}
      </main>
    </div>
  );
}

type Run = (action: Parameters<ReturnType<typeof useAppState>["act"]>[0], msg: string, next?: (r: Record<string, unknown>) => void) => Promise<void>;

// =====================================================================
function GroupReview({ g, state, busy, run, select }: { g: ViewGroup; state: AppState; busy: boolean; run: Run; select: (id: string) => void }) {
  const step = state.steps.find((s) => s.id === g.stepId)!;
  const reports = g.reportIds.map((id) => state.reports.find((r) => r.id === id)!).filter(Boolean);
  const history = state.log.filter((l) => l.groupId === g.id);
  const decided = g.status !== "pending";

  return (
    <div className="max-w-5xl space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
          <span>
            Step {step.number} · {step.name}
          </span>
          <span>·</span>
          <span>
            {reports.length} report{reports.length > 1 ? "s" : ""}
          </span>
          {decided && (
            <span className="ml-2">
              <StatusBadge s={g.status} ticketId={g.ticketId} />
            </span>
          )}
        </div>
        <h2 className="text-xl font-semibold text-slate-900">{g.title}</h2>
        <CategoryControl g={g} state={state} busy={busy || decided} run={run} />
      </div>

      {decided && (
        <div className="rounded-xl bg-slate-900 text-white p-4 flex gap-4 items-start">
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Decided by a person · what the tester sees</div>
            <p className="text-sm">{g.outcome}</p>
          </div>
          <Button kind="secondary" disabled={busy} onClick={() => run({ type: "reopen", groupId: g.id }, "Reopened. It's back in the queue.")}>
            Reopen
          </Button>
        </div>
      )}

      {/* The reports, side by side */}
      <Card
        title={reports.length > 1 ? `${reports.length} reports, one issue?` : "The report"}
        right={reports.length > 1 ? <span className="text-xs text-slate-500">Highlighted: what they have in common</span> : undefined}
      >
        <div className={`grid gap-3 ${reports.length > 1 ? "md:grid-cols-2 xl:grid-cols-3" : ""}`}>
          {reports.map((r) => (
            <ReportCard key={r.id} r={r} g={g} busy={busy || decided} run={run} />
          ))}
        </div>
      </Card>

      {/* How sure + why */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Why the tool suggests this">
          {g.plainExplanation && (
            <p className="text-sm text-slate-700 mb-3">
              {g.plainExplanation}
              {g.aiWritten && <span className="ml-1 text-xs text-violet-600">(AI-written)</span>}
            </p>
          )}
          <SignalList items={[...g.groupReasons, ...g.categoryReasons]} />
        </Card>
        <Card title="How sure is it?">
          <div className="space-y-2 mb-3">
            {g.groupConfidence && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-700">These are the same issue</span>
                <ConfidencePill c={g.groupConfidence} />
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-700">It&apos;s a {CATEGORY_LABEL[g.aiCategory].toLowerCase()}</span>
              <ConfidencePill c={g.categoryConfidence} />
            </div>
          </div>
          {g.missingEvidence.length > 0 && (
            <>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">What would make it surer</div>
              <ul className="list-disc pl-5 text-sm text-slate-700 space-y-0.5">
                {g.missingEvidence.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      {/* Possibly related */}
      {g.relatedGroups.length > 0 && (
        <Card title="Possibly the same as…" right={<span className="text-xs text-slate-500">The tool didn&apos;t group these. You decide.</span>}>
          <ul className="divide-y divide-slate-100">
            {g.relatedGroups.map((rel) => {
              const o = state.groups.find((x) => x.id === rel.id);
              if (!o) return null;
              return (
                <li key={rel.id} className="py-2 flex items-center gap-3">
                  <CategoryBadge c={o.category} />
                  <button className="text-sm text-left text-slate-800 hover:underline flex-1" onClick={() => select(o.id)}>
                    {o.title} <span className="text-slate-400">({o.reportIds.length} report{o.reportIds.length > 1 ? "s" : ""}, step {state.steps.find((s) => s.id === o.stepId)?.number})</span>
                  </button>
                  <ConfidencePill c={rel.score >= 0.6 ? "high" : rel.score >= 0.45 ? "medium" : "low"} />
                  <Button
                    disabled={busy}
                    onClick={() =>
                      run({ type: "merge", groupId: g.id, intoId: o.id }, o.ticketId ? `Added as extra evidence on ${o.ticketId}.` : "Merged. They're now one item.", (r) => select(String(r.groupId)))
                    }
                  >
                    {o.ticketId ? `Add to ${o.ticketId}` : "Merge into this"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* The decision */}
      {!decided && <DecisionPanel g={g} state={state} busy={busy} run={run} />}

      {/* History */}
      {history.length > 0 && (
        <Card title="History for this item">
          <ul className="space-y-1.5">
            {history.map((l) => (
              <li key={l.id} className="text-sm text-slate-700">
                <span className="text-xs text-slate-400 mr-2">{timeAgo(l.at)}</span>
                <span className="font-medium">{l.actor}</span>: {l.detail}
                {l.reason && <span className="text-slate-500"> Reason: {l.reason}.</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
function ReportCard({ r, g, busy, run }: { r: Report; g: ViewGroup; busy: boolean; run: Run }) {
  const [splitting, setSplitting] = useState(false);
  const [reason, setReason] = useState("It's a different problem");
  const score = g.memberScores[r.id];
  const match = score === undefined ? null : score >= 0.6 ? "Strong match" : score >= 0.45 ? "Medium match" : "Weak match";
  return (
    <div className={`rounded-lg border p-3 flex flex-col ${score !== undefined && score < 0.45 ? "border-amber-300 bg-amber-50/40" : "border-slate-200"}`}>
      <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5">
        <span className="font-semibold text-slate-700">{r.tester}</span>
        {r.browser && <span>· {r.browser}</span>}
        {match && <span className="ml-auto">{match}</span>}
      </div>
      <p className="text-sm text-slate-800 flex-1">
        <Highlight text={r.comment} terms={g.sharedTerms} />
      </p>
      {r.thread?.map((m, i) => (
        <p key={i} className={`mt-2 text-xs rounded-md px-2 py-1 ${m.from === "manager" ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-800"}`}>
          <span className="font-semibold">{m.from === "manager" ? "You asked" : `${r.tester} replied`}:</span> <Highlight text={m.text} terms={g.sharedTerms} />
        </p>
      ))}
      {r.testerConfirmedGroupId === g.id && <p className="mt-2 text-xs text-emerald-700">✓ Tester said this is the same issue</p>}
      {g.reportIds.length > 1 && !busy && (
        <div className="mt-2">
          {!splitting ? (
            <button className="text-xs text-slate-500 hover:text-rose-700 underline" onClick={() => setSplitting(true)}>
              Not the same issue
            </button>
          ) : (
            <div className="space-y-1.5">
              <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full text-xs border border-slate-300 rounded px-1.5 py-1">
                <option>It&apos;s a different problem</option>
                <option>Different screen or step</option>
                <option>Can&apos;t tell, not enough detail</option>
                <option>Other</option>
              </select>
              <div className="flex gap-1.5">
                <Button kind="danger" className="text-xs !px-2 !py-1" onClick={() => run({ type: "split", groupId: g.id, reportId: r.id, reason }, `Split ${r.tester}'s report out. It's now its own item.`)}>
                  Split it out
                </Button>
                <Button kind="ghost" className="text-xs !px-2 !py-1" onClick={() => setSplitting(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
function CategoryControl({ g, state, busy, run }: { g: ViewGroup; state: AppState; busy: boolean; run: Run }) {
  const [editing, setEditing] = useState(false);
  const [cat, setCat] = useState<Category>(g.category);
  const [ki, setKi] = useState(g.knownIssueId ?? state.knownIssues[0]?.id);
  const [reason, setReason] = useState("");
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
      <CategoryBadge c={g.category} />
      {g.categoryOverridden ? (
        <span className="text-xs text-slate-500">Changed by a person (tool suggested: {CATEGORY_LABEL[g.aiCategory]})</span>
      ) : (
        <span className="text-xs text-slate-500">Suggested by the tool</span>
      )}
      {!busy && !editing && (
        <button className="text-xs text-brand underline" onClick={() => setEditing(true)}>
          Change
        </button>
      )}
      {editing && (
        <div className="flex flex-wrap items-center gap-2 bg-white ring-1 ring-slate-200 rounded-lg px-3 py-2">
          <select value={cat} onChange={(e) => setCat(e.target.value as Category)} className="text-sm border border-slate-300 rounded px-1.5 py-1">
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          {cat === "known_issue" && (
            <select value={ki} onChange={(e) => setKi(e.target.value)} className="text-sm border border-slate-300 rounded px-1.5 py-1 max-w-56">
              {state.knownIssues.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.title}
                </option>
              ))}
            </select>
          )}
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why? (one line, for the log)"
            className="text-sm border border-slate-300 rounded px-2 py-1 w-56"
          />
          <Button
            kind="primary"
            disabled={cat === g.category || !reason.trim()}
            onClick={async () => {
              await run({ type: "setCategory", groupId: g.id, category: cat, reason: reason.trim(), knownIssueId: ki }, `Changed to "${CATEGORY_LABEL[cat]}". Logged with your reason.`);
              setEditing(false);
            }}
          >
            Save
          </Button>
          <Button kind="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
function DecisionPanel({ g, state, busy, run }: { g: ViewGroup; state: AppState; busy: boolean; run: Run }) {
  switch (g.category) {
    case "bug":
      return <TicketEditor g={g} state={state} busy={busy} run={run} />;
    case "needs_detail":
      return <QuestionEditor g={g} state={state} busy={busy} run={run} />;
    case "known_issue": {
      const ki = state.knownIssues.find((k) => k.id === g.knownIssueId);
      return (
        <Card title="Your decision: already known?">
          {ki && (
            <div className="rounded-lg bg-sky-50 ring-1 ring-sky-200 p-3 mb-3">
              <div className="text-sm font-semibold text-sky-900">{ki.title}</div>
              <p className="text-sm text-sky-900/80">{ki.description}</p>
            </div>
          )}
          <p className="text-sm text-slate-600 mb-3">Testers will be told it&apos;s a known issue being worked on, and that their report adds weight.</p>
          <Button kind="primary" disabled={busy} onClick={() => run({ type: "closeKnown", groupId: g.id }, "Linked to the known issue. Testers have been thanked.")}>
            Confirm: link to this known issue
          </Button>
        </Card>
      );
    }
    case "idea":
      return (
        <Card title="Your decision: log this idea?">
          <p className="text-sm text-slate-600 mb-3">
            Not a bug, but worth keeping. It goes to the ideas backlog instead of a spreadsheet cell, and {g.reportIds.length > 1 ? "each tester" : "the tester"} is told where it went.
          </p>
          <Button kind="primary" disabled={busy} onClick={() => run({ type: "logIdea", groupId: g.id }, "Logged in the ideas backlog. The tester has been told.")}>
            Log in ideas backlog
          </Button>
        </Card>
      );
    default:
      return <CloseEditor g={g} busy={busy} run={run} />;
  }
}

function TicketEditor({ g, state, busy, run }: { g: ViewGroup; state: AppState; busy: boolean; run: Run }) {
  const [d, setD] = useState<TicketDraft>(g.draft!);
  const base = useRef(JSON.stringify(g.draft));
  useEffect(() => {
    // Pick up a fresh draft (e.g. after an AI rewrite) unless the person has started editing.
    if (JSON.stringify(g.draft) !== base.current) {
      base.current = JSON.stringify(g.draft);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing to new server draft
      setD(g.draft!);
    }
  }, [g.draft]);
  if (!g.draft) return null;
  const dirty = JSON.stringify(d) !== JSON.stringify(g.draft);
  const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
  const field = "w-full text-sm border border-slate-300 rounded-md px-2 py-1.5";
  return (
    <Card
      title="Your decision: draft ticket"
      right={
        state.ai.enabled ? (
          <Button kind="ghost" disabled={busy} onClick={() => run({ type: "aiRewrite", groupId: g.id }, "AI suggested new wording. Check it before you approve.")}>
            ✨ Improve wording with AI
          </Button>
        ) : undefined
      }
    >
      <div className="grid gap-3">
        <label className="text-xs font-semibold text-slate-500">
          Title
          <input className={`${field} mt-1 font-medium text-slate-900`} value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
        </label>
        <div className="grid md:grid-cols-2 gap-3">
          <label className="text-xs font-semibold text-slate-500">
            Steps to reproduce (one per line)
            <textarea rows={4} className={`${field} mt-1`} value={d.stepsToReproduce.join("\n")} onChange={(e) => setD({ ...d, stepsToReproduce: lines(e.target.value) })} />
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Expected (from the test script)
            <textarea rows={4} className={`${field} mt-1`} value={d.expected} onChange={(e) => setD({ ...d, expected: e.target.value })} />
          </label>
        </div>
        <label className="text-xs font-semibold text-slate-500">
          Actual: what testers saw (one per line)
          <textarea rows={Math.min(8, d.actual.length + 1)} className={`${field} mt-1`} value={d.actual.join("\n")} onChange={(e) => setD({ ...d, actual: lines(e.target.value) })} />
        </label>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-xs font-semibold text-slate-500">
            Severity (suggested)
            <select className={`${field} mt-1`} value={d.severity} onChange={(e) => setD({ ...d, severity: e.target.value as TicketDraft["severity"] })}>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-500 flex-1 min-w-48">
            Seen on
            <input className={`${field} mt-1`} value={d.environment.join(", ")} onChange={(e) => setD({ ...d, environment: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
          </label>
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
        <Button kind="primary" disabled={busy} onClick={() => run({ type: "approve", groupId: g.id, draft: d }, `Ticket approved, covering ${g.reportIds.length} report${g.reportIds.length > 1 ? "s" : ""}. Testers have been told.`)}>
          Approve this ticket
        </Button>
        <Button disabled={busy || !dirty} onClick={() => run({ type: "saveDraft", groupId: g.id, draft: d }, "Draft saved.")}>
          Save draft
        </Button>
        <span className="text-xs text-slate-500 ml-auto">One ticket, approved by you. There is no &quot;approve all&quot;.</span>
      </div>
    </Card>
  );
}

function QuestionEditor({ g, state, busy, run }: { g: ViewGroup; state: AppState; busy: boolean; run: Run }) {
  const [q, setQ] = useState(g.question ?? "");
  return (
    <Card
      title="Your decision: ask a kind question"
      right={
        state.ai.enabled ? (
          <Button kind="ghost" disabled={busy} onClick={() => run({ type: "aiRewrite", groupId: g.id }, "AI suggested a new question. Check it before sending.")}>
            ✨ Rewrite with AI
          </Button>
        ) : undefined
      }
    >
      <p className="text-sm text-slate-600 mb-2">
        There isn&apos;t enough here to act on yet, but that&apos;s not the tester&apos;s fault. Instead of rejecting it, send a friendly question. Their reply comes back to this queue.
      </p>
      <textarea rows={4} className="w-full text-sm border border-slate-300 rounded-md px-2 py-1.5" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-3 flex gap-2">
        <Button kind="primary" disabled={busy || !q.trim()} onClick={() => run({ type: "sendQuestion", groupId: g.id, question: q.trim() }, "Question sent. You'll see the reply here.")}>
          Send question to tester
        </Button>
      </div>
    </Card>
  );
}

function CloseEditor({ g, busy, run }: { g: ViewGroup; busy: boolean; run: Run }) {
  const [note, setNote] = useState("Thanks for testing this step. Your note has been recorded and nothing more is needed from you.");
  return (
    <Card title="Your decision: close with thanks">
      <p className="text-sm text-slate-600 mb-2">Nothing to fix here. The tester still gets a reply so they know it was read.</p>
      <textarea rows={2} className="w-full text-sm border border-slate-300 rounded-md px-2 py-1.5" value={note} onChange={(e) => setNote(e.target.value)} />
      <Button kind="primary" className="mt-3" disabled={busy || !note.trim()} onClick={() => run({ type: "close", groupId: g.id, note: note.trim() }, "Closed with a thank-you note.")}>
        Close with thanks
      </Button>
    </Card>
  );
}

// ---------------------------------------------------------------------
function DataControls({ act, busy, onDone }: { act: ReturnType<typeof useAppState>["act"]; busy: boolean; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="border-t border-slate-200 p-3 flex gap-2 items-center text-xs text-slate-500">
      <span>Data:</span>
      <button
        className="underline hover:text-slate-800 disabled:opacity-50"
        disabled={busy}
        onClick={async () => {
          if (confirm("Reset to the demo data? All decisions will be cleared.")) {
            await act({ type: "reset" });
            onDone();
          }
        }}
      >
        Reset demo
      </button>
      <button className="underline hover:text-slate-800" onClick={() => fileRef.current?.click()}>
        Import CSV
      </button>
      <a className="underline hover:text-slate-800" href="/sample-feedback.csv" download>
        Sample CSV
      </a>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          await act({ type: "importCsv", csv: await f.text() });
          e.target.value = "";
          onDone();
        }}
      />
    </div>
  );
}
