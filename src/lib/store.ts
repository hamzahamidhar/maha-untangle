// Persistence: a JSON file in .data/ (good for a demo on one laptop).
// To move to Supabase, replace loadStore/saveStore with table reads/writes —
// see supabase/schema.sql. Nothing else needs to change.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { aiConfig, embed } from "./ai";
import { buildCtx, fullAnalyse, fullText, type Ctx } from "./engine";
import { seedStore } from "./seedStore";
import type { Store } from "./types";

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_FILE = path.join(DATA_DIR, "store.json");
const EMBED_FILE = path.join(DATA_DIR, "embeddings.json");

export let lastAiError: string | null = null;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function saveStore(store: Store) {
  ensureDir();
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
}

export async function loadStore(): Promise<Store> {
  if (fs.existsSync(STORE_FILE)) {
    return JSON.parse(fs.readFileSync(STORE_FILE, "utf8")) as Store;
  }
  const store = seedStore();
  await analyseFresh(store, "Loaded the demo data");
  saveStore(store);
  return store;
}

/** Group everything from scratch and write a log line. */
export async function analyseFresh(store: Store, what: string) {
  const ctx = await makeCtx(store);
  fullAnalyse(store, ctx);
  const bugs = store.groups.filter((g) => g.reportIds.length > 1).length;
  store.log.unshift({
    id: `l${store.nextId++}`,
    at: new Date().toISOString(),
    actor: "System",
    action: "Analysed feedback",
    detail: `${what}: ${store.reports.length} reports sorted into ${store.groups.length} items to review (${bugs} contain possible duplicates). Nothing is decided until a person reviews it.`,
  });
}

// ---------- Embeddings (only when AI is configured) ----------
type EmbedCache = Record<string, { hash: string; v: number[] }>;

function hash(s: string) {
  return crypto.createHash("sha1").update(`${aiConfig.embedModel}|${s}`).digest("hex");
}

async function embeddingsFor(store: Store): Promise<Record<string, number[]> | undefined> {
  if (!aiConfig.enabled || !aiConfig.useEmbeddings) return undefined;
  ensureDir();
  const cache: EmbedCache = fs.existsSync(EMBED_FILE) ? JSON.parse(fs.readFileSync(EMBED_FILE, "utf8")) : {};
  const docs = [
    ...store.reports.map((r) => ({ id: r.id, text: fullText(r) })),
    ...store.knownIssues.map((k) => ({ id: `ki:${k.id}`, text: `${k.title}. ${k.description}` })),
  ];
  const missing = docs.filter((d) => cache[d.id]?.hash !== hash(d.text));
  try {
    for (let i = 0; i < missing.length; i += 64) {
      const batch = missing.slice(i, i + 64);
      const vs = await embed(batch.map((d) => d.text));
      batch.forEach((d, k) => (cache[d.id] = { hash: hash(d.text), v: vs[k] }));
    }
    fs.writeFileSync(EMBED_FILE, JSON.stringify(cache));
    lastAiError = null;
    return Object.fromEntries(docs.map((d) => [d.id, cache[d.id].v]));
  } catch (e) {
    lastAiError = e instanceof Error ? e.message : String(e);
    console.warn("[untangle] Embeddings unavailable, using local similarity:", lastAiError);
    return undefined;
  }
}

export async function makeCtx(store: Store): Promise<Ctx> {
  return buildCtx(store, await embeddingsFor(store));
}

// Serialise writes so two quick clicks can't clobber each other.
let queue: Promise<unknown> = Promise.resolve();
export function withStore<T>(fn: (s: Store) => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const s = await loadStore();
    const out = await fn(s);
    saveStore(s);
    return out;
  });
  queue = run.catch(() => undefined);
  return run;
}
