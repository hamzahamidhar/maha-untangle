"use client";

import { highlightSegments } from "@/lib/text";
import { CATEGORY_LABEL, STATUS_LABEL, type Category, type Confidence, type GroupStatus, type Signal } from "@/lib/types";
import type { ReactNode } from "react";

const CAT_STYLE: Record<Category, string> = {
  bug: "bg-rose-50 text-rose-700 ring-rose-200",
  known_issue: "bg-sky-50 text-sky-700 ring-sky-200",
  idea: "bg-violet-50 text-violet-700 ring-violet-200",
  needs_detail: "bg-amber-50 text-amber-800 ring-amber-200",
  not_actionable: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function CategoryBadge({ c }: { c: Category }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ${CAT_STYLE[c]}`}>{CATEGORY_LABEL[c]}</span>;
}

const STATUS_STYLE: Record<GroupStatus, string> = {
  pending: "bg-white text-slate-700 ring-slate-300",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  question_sent: "bg-amber-50 text-amber-800 ring-amber-200",
  logged_idea: "bg-violet-50 text-violet-700 ring-violet-200",
  closed_known: "bg-sky-50 text-sky-700 ring-sky-200",
  closed: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function StatusBadge({ s, ticketId }: { s: GroupStatus; ticketId?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ring-1 ${STATUS_STYLE[s]}`}>
      {s === "approved" && ticketId ? `${ticketId} approved` : STATUS_LABEL[s]}
    </span>
  );
}

const CONF: Record<Confidence, { label: string; dots: number; cls: string }> = {
  high: { label: "High", dots: 3, cls: "text-emerald-700" },
  medium: { label: "Medium", dots: 2, cls: "text-amber-700" },
  low: { label: "Low", dots: 1, cls: "text-slate-500" },
};

/** Confidence shown as words + dots (never a fake-precise percentage). */
export function ConfidencePill({ c, prefix }: { c: Confidence; prefix?: string }) {
  const k = CONF[c];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${k.cls}`}>
      <span className="inline-flex gap-0.5" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span key={i} className={`h-1.5 w-1.5 rounded-full ${i <= k.dots ? "bg-current" : "bg-slate-200"}`} />
        ))}
      </span>
      {prefix ? `${prefix}: ` : ""}
      {k.label}
    </span>
  );
}

export function Highlight({ text, terms }: { text: string; terms: string[] }) {
  return (
    <>
      {highlightSegments(text, terms).map((s, i) =>
        s.hit ? (
          <mark key={i} className="hit">
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

export function SignalList({ items }: { items: Signal[] }) {
  if (!items.length) return null;
  const mark = { strong: "●", medium: "◐", weak: "○" };
  return (
    <ul className="space-y-1">
      {items.map((s, i) => (
        <li key={i} className="flex gap-2 text-sm text-slate-700">
          <span className="text-brand w-3 shrink-0" title={`${s.strength} evidence`}>
            {mark[s.strength]}
          </span>
          <span>{s.text}</span>
        </li>
      ))}
    </ul>
  );
}

export function Card({ title, children, right, className = "" }: { title?: ReactNode; children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <section className={`bg-white rounded-xl border border-slate-200 p-4 ${className}`}>
      {(title || right) && (
        <div className="flex items-center justify-between mb-3 gap-3">
          {title && <h3 className="text-sm font-semibold text-slate-800">{title}</h3>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

type BtnKind = "primary" | "secondary" | "ghost" | "danger";
export function Button({
  kind = "secondary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: BtnKind }) {
  const k: Record<BtnKind, string> = {
    primary: "bg-brand text-white hover:bg-blue-900 disabled:bg-slate-300",
    secondary: "bg-white text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50 disabled:text-slate-400",
    ghost: "text-slate-600 hover:bg-slate-100",
    danger: "bg-white text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50",
  };
  return <button {...props} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:cursor-not-allowed ${k[kind]} ${className}`} />;
}

export function timeAgo(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
