import { APP_NAME, KNOWN_ISSUES, SEED_REPORTS, STEPS } from "@/data/seed";
import type { Report, Store } from "./types";

/** A fresh store built from the demo data (before analysis). */
export function emptyStoreFrom(reports: Omit<Report, "createdAt">[]): Store {
  const start = Date.parse("2026-10-28T09:00:00Z");
  return {
    appName: APP_NAME,
    steps: STEPS,
    knownIssues: KNOWN_ISSUES,
    reports: reports.map((r, i) => ({
      ...r,
      createdAt: new Date(start + i * 7 * 60_000).toISOString(),
    })),
    groups: [],
    log: [],
    cannotLink: [],
    nextTicket: 101,
    nextId: 1,
  };
}

export function seedStore(): Store {
  return emptyStoreFrom(SEED_REPORTS);
}
