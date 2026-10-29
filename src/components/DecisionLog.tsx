"use client";

import { useState } from "react";
import { Card, timeAgo } from "./ui";
import { useAppState } from "./useAppState";

export function DecisionLog() {
  const { state } = useAppState();
  const [who, setWho] = useState<"all" | "UAT manager" | "Tester" | "System">("all");
  if (!state) return <div className="p-8 text-slate-500">Loading…</div>;
  const rows = state.log.filter((l) => who === "all" || l.actor === who);
  const overrules = state.log.filter((l) => l.toolSuggested).length;
  const approved = state.groups.filter((g) => g.status === "approved");
  const covered = approved.reduce((n, g) => n + g.reportIds.length, 0);
  return (
    <div className="max-w-6xl mx-auto w-full p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Decision log</h1>
        <p className="text-sm text-slate-600">Every suggestion, every human decision, and every time a person overruled the tool.</p>
      </div>
      <div className="grid sm:grid-cols-4 gap-3">
        <Stat label="Reports received" value={state.reports.length} />
        <Stat label="Tickets approved by a person" value={approved.length} sub={covered ? `covering ${covered} reports` : undefined} />
        <Stat label="Times a person overruled the tool" value={overrules} />
        <Stat label="Still waiting for a person" value={state.groups.filter((g) => g.status === "pending").length} />
      </div>
      <Card
        right={
          <select value={who} onChange={(e) => setWho(e.target.value as typeof who)} className="text-sm border border-slate-300 rounded-md px-2 py-1">
            <option value="all">Everyone</option>
            <option>UAT manager</option>
            <option>Tester</option>
            <option>System</option>
          </select>
        }
        title={`${rows.length} entries`}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
              <th className="py-2 pr-3 font-medium w-32">When</th>
              <th className="py-2 pr-3 font-medium w-28">Who</th>
              <th className="py-2 pr-3 font-medium w-40">Action</th>
              <th className="py-2 pr-3 font-medium">What happened</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id} className="border-b border-slate-100 align-top">
                <td className="py-2 pr-3 text-slate-500 whitespace-nowrap">{timeAgo(l.at)}</td>
                <td className="py-2 pr-3">{l.actor}</td>
                <td className="py-2 pr-3 font-medium">{l.action}</td>
                <td className="py-2 pr-3 text-slate-700">
                  {l.detail}
                  {l.reason && <div className="text-xs text-slate-500 mt-0.5">Reason given: {l.reason}</div>}
                  {l.toolSuggested && <div className="text-xs text-amber-700 mt-0.5">Overruled the tool (it suggested: {l.toolSuggested})</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="text-2xl font-semibold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  );
}
