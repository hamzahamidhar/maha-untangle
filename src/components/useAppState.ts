"use client";

import { useCallback, useEffect, useState } from "react";
import type { Action } from "@/lib/actions";
import type { Group, Store } from "@/lib/types";

export type ViewGroup = Group & { title: string; outcome: string };
export type AppState = Omit<Store, "groups"> & {
  groups: ViewGroup[];
  ai: { enabled: boolean; model: string; embeddings: boolean; error: string | null };
};

/** Loads shared state from the server and keeps it fresh across tabs. */
export function useAppState() {
  const [state, setState] = useState<AppState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/state", { cache: "no-store" });
    if (res.ok) setState(await res.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load
    refresh();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    const t = setInterval(refresh, 5000); // so the tester tab and manager tab stay in sync
    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(t);
    };
  }, [refresh]);

  const act = useCallback(
    async <T = Record<string, unknown>,>(action: Action): Promise<T | null> => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action),
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? "Something went wrong.");
          return null;
        }
        if (action.type !== "testerCheck") await refresh();
        return json as T;
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  return { state, error, setError, busy, act, refresh };
}

/** Dry-run check used while a tester types (doesn't touch busy/error state). */
export async function checkFeedback(action: Extract<Action, { type: "testerCheck" }>) {
  const res = await fetch("/api/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(action),
  });
  return res.ok ? res.json() : null;
}
