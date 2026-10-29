"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "/", label: "Review queue", who: "UAT manager" },
  { href: "/tester", label: "Tester view", who: "Tester" },
  { href: "/log", label: "Decision log", who: "Everyone" },
];

export function Header() {
  const path = usePathname();
  const [ai, setAi] = useState<{ enabled: boolean; model: string; error: string | null } | null>(null);
  useEffect(() => {
    fetch("/api/state")
      .then((r) => r.json())
      .then((s) => setAi(s.ai))
      .catch(() => {});
  }, []);
  return (
    <header className="h-14 shrink-0 bg-white border-b border-slate-200 flex items-center px-5 gap-6">
      <Link href="/" className="flex items-baseline gap-2">
        <span className="text-lg font-bold text-brand tracking-tight">Untangle</span>
        <span className="text-xs text-slate-500 hidden md:inline">UAT feedback, untangled · MAHA Systems</span>
      </Link>
      <nav className="flex gap-1">
        {LINKS.map((l) => {
          const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-1.5 rounded-md text-sm ${active ? "bg-brand-soft text-brand font-semibold" : "text-slate-600 hover:bg-slate-100"}`}
              title={`For: ${l.who}`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
      <div className="ml-auto text-xs">
        {ai &&
          (ai.enabled ? (
            <span className={`px-2 py-1 rounded-full ${ai.error ? "bg-amber-100 text-amber-800" : "bg-emerald-50 text-emerald-700"}`} title={ai.error ?? ""}>
              {ai.error ? "AI unreachable, using local similarity" : `AI on · ${ai.model}`}
            </span>
          ) : (
            <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600" title="Set AI_API_KEY in .env.local to turn on AI">
              Local similarity · no AI key
            </span>
          ))}
      </div>
    </header>
  );
}
