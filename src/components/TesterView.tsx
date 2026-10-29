"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, StatusBadge, timeAgo } from "./ui";
import { checkFeedback, useAppState } from "./useAppState";

type Check = {
  thin: boolean;
  prompts: string[];
  similar: { groupId: string; title: string; count: number; status: string; ticketId?: string; sure: string }[];
};

const BROWSERS = ["Chrome", "Edge", "Firefox", "Safari", "Other"];

export function TesterView() {
  const { state, error, busy, act } = useAppState();
  const [tester, setTester] = useState("Priya S.");
  const [stepId, setStepId] = useState("S4");
  const [comment, setComment] = useState("");
  const [browser, setBrowser] = useState("Chrome");
  const [check, setCheck] = useState<Check | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [sent, setSent] = useState<string | null>(null);

  const testers = useMemo(() => [...new Set(state?.reports.map((r) => r.tester) ?? [])].sort(), [state]);

  // Live, gentle check while typing (debounced). Never blocks sending.
  useEffect(() => {
    if (comment.trim().length < 3) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear stale check
      setCheck(null);
      return;
    }
    const t = setTimeout(async () => {
      const r = await checkFeedback({ type: "testerCheck", tester, stepId, comment });
      if (r) setCheck(r);
    }, 600);
    return () => clearTimeout(t);
  }, [comment, stepId, tester]);

  if (!state) return <div className="p-8 text-slate-500">Loading…</div>;
  const step = state.steps.find((s) => s.id === stepId)!;
  const mine = state.reports.filter((r) => r.tester === tester).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const similar = check?.similar.filter((s) => !dismissed.includes(s.groupId)) ?? [];

  const submit = async (sameAsGroupId?: string) => {
    const r = await act({ type: "testerSubmit", tester, stepId, comment, browser, sameAsGroupId });
    if (r) {
      setSent(sameAsGroupId ? "Thanks! We've added your report to the existing one. It helps show how many people hit this." : "Thanks! Your feedback has been sent. A person will review it.");
      setComment("");
      setCheck(null);
      setDismissed([]);
    }
  };

  return (
    <div className="max-w-6xl mx-auto w-full p-6 grid lg:grid-cols-[280px_1fr] gap-6">
      {/* Test script */}
      <aside className="space-y-4">
        <Card title="You are testing as">
          <input
            list="testers"
            value={tester}
            onChange={(e) => setTester(e.target.value)}
            className="w-full text-sm border border-slate-300 rounded-md px-2 py-1.5"
          />
          <datalist id="testers">
            {testers.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          <p className="text-xs text-slate-500 mt-1">Demo only: pick any tester to see their view.</p>
        </Card>
        <Card title={`${state.appName} test script`}>
          <ol className="space-y-0.5">
            {state.steps.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => setStepId(s.id)}
                  className={`w-full text-left text-sm px-2 py-1.5 rounded-md ${s.id === stepId ? "bg-brand-soft text-brand font-semibold" : "hover:bg-slate-50 text-slate-700"}`}
                >
                  {s.number}. {s.name}
                </button>
              </li>
            ))}
          </ol>
        </Card>
      </aside>

      <div className="space-y-4">
        {/* Feedback form */}
        <Card>
          <div className="text-xs text-slate-500">Step {step.number}</div>
          <h1 className="text-lg font-semibold mb-1">{step.name}</h1>
          <p className="text-sm text-slate-700">
            <span className="font-medium">Do this:</span> {step.instruction}
          </p>
          <p className="text-sm text-slate-700 mb-4">
            <span className="font-medium">You should see:</span> {step.expected}
          </p>
          <label className="text-sm font-medium text-slate-800">
            Did anything go wrong, or do you have an idea? Use your own words.
            <textarea
              rows={4}
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                setSent(null);
              }}
              placeholder="e.g. When I typed in the cost centre box, the page stopped responding…"
              className="mt-1 w-full text-sm border border-slate-300 rounded-md px-3 py-2 font-normal"
            />
          </label>

          {/* Gentle prompts, not gatekeeping */}
          {check && check.prompts.length > 0 && (
            <div className="mt-2 rounded-lg bg-amber-50 ring-1 ring-amber-200 p-3 text-sm text-amber-900">
              <div className="font-medium mb-1">To help the team fix this faster, you could add:</div>
              <ul className="list-disc pl-5 space-y-0.5">
                {check.prompts.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <div className="text-xs mt-1 text-amber-800">Optional. You can still send it as it is.</div>
            </div>
          )}

          {/* "Is this the same?" asked of the tester */}
          {similar.length > 0 && (
            <div className="mt-2 rounded-lg bg-sky-50 ring-1 ring-sky-200 p-3 text-sm text-sky-950">
              <div className="font-medium mb-2">Someone may have reported this already. Is it the same thing you saw?</div>
              {similar.map((s) => (
                <div key={s.groupId} className="flex flex-wrap items-center gap-2 py-1">
                  <span className="flex-1 min-w-60">
                    &ldquo;{s.title}&rdquo;{" "}
                    <span className="text-sky-800/70">
                      ({s.count} tester{s.count > 1 ? "s" : ""}
                      {s.ticketId ? `, ${s.ticketId}` : ""})
                    </span>
                  </span>
                  <Button kind="primary" disabled={busy} onClick={() => submit(s.groupId)}>
                    Yes, same thing
                  </Button>
                  <Button disabled={busy} onClick={() => setDismissed([...dismissed, s.groupId])}>
                    No, mine is different
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 flex items-center gap-3">
            <select value={browser} onChange={(e) => setBrowser(e.target.value)} className="text-sm border border-slate-300 rounded-md px-2 py-1.5" aria-label="Browser">
              {BROWSERS.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
            <Button kind="primary" disabled={busy || !comment.trim()} onClick={() => submit()}>
              Send feedback
            </Button>
            {sent && <span className="text-sm text-emerald-700">✓ {sent}</span>}
            {error && <span className="text-sm text-rose-700">{error}</span>}
          </div>
        </Card>

        {/* What happened to my feedback */}
        <Card title={`What happened to your feedback (${mine.length})`}>
          {!mine.length && <p className="text-sm text-slate-500">Nothing yet. Your reports will appear here with what happened to each one.</p>}
          <ul className="divide-y divide-slate-100">
            {mine.map((r) => {
              const g = state.groups.find((x) => x.reportIds.includes(r.id));
              const s = state.steps.find((x) => x.id === r.stepId);
              const lastQ = [...(r.thread ?? [])].reverse().find((m) => m.from === "manager");
              const lastIsQuestion = r.thread?.length && r.thread[r.thread.length - 1].from === "manager";
              return (
                <li key={r.id} className="py-3">
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                    <span>
                      Step {s?.number} · {s?.name}
                    </span>
                    <span>· {timeAgo(r.createdAt)}</span>
                    {g && (
                      <span className="ml-auto">
                        <StatusBadge s={g.status} ticketId={g.ticketId} />
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-800">&ldquo;{r.comment}&rdquo;</p>
                  {r.thread
                    ?.filter((m) => m.from === "tester")
                    .map((m, i) => (
                      <p key={i} className="text-sm text-slate-600 mt-1">
                        You added: &ldquo;{m.text}&rdquo;
                      </p>
                    ))}
                  {g && <p className="text-sm mt-1 text-slate-700 bg-slate-50 rounded-md px-3 py-2">{g.outcome}</p>}
                  {g?.status === "question_sent" && lastQ && lastIsQuestion && <ReplyBox question={lastQ.text} busy={busy} onSend={(text) => act({ type: "testerReply", reportId: r.id, text })} />}
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function ReplyBox({ question, busy, onSend }: { question: string; busy: boolean; onSend: (t: string) => void }) {
  const [t, setT] = useState("");
  return (
    <div className="mt-2 rounded-lg ring-1 ring-amber-200 bg-amber-50 p-3">
      <div className="text-xs font-semibold text-amber-900 mb-1">A question from the UAT team</div>
      <p className="text-sm text-amber-950 mb-2">{question}</p>
      <textarea rows={2} value={t} onChange={(e) => setT(e.target.value)} className="w-full text-sm border border-amber-300 rounded-md px-2 py-1.5 bg-white" placeholder="Your reply…" />
      <Button kind="primary" className="mt-2" disabled={busy || !t.trim()} onClick={() => onSend(t)}>
        Send reply
      </Button>
    </div>
  );
}
