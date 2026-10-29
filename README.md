# Untangle: UAT feedback, untangled

**MAHA Systems · Pfizer AI Studio UAT Challenge prototype**

Testers report the same bug five different ways, write comments too vague to act on, and leave good ideas in spreadsheet cells. **Untangle** sorts that feedback, groups the duplicates, shows its working and how sure it is, and drafts tickets. **A person makes every decision, one item at a time.** Testers always hear back, even when their feedback doesn't become a ticket.

## Run it

Needs Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

| Page | For | What it does |
|---|---|---|
| `/` Review queue | UAT manager | Grouped feedback, evidence, confidence, draft ticket, one-at-a-time decisions |
| `/tester` Tester view | Tester | Scripted steps, gentle prompts for thin feedback, "is this the same?", replies, outcomes |
| `/log` Decision log | Everyone | Every suggestion, decision and overrule, with reasons |

Demo data (42 reports on a made-up "TravelDesk" app) loads automatically. **Reset demo** (bottom left of the queue) puts it back. Data is saved in `.data/store.json`, so delete that folder to start fresh. **Import CSV** accepts `tester, step, browser, comment` columns; see `public/sample-feedback.csv`.

No API key is needed. To use AI, copy `.env.example` to `.env.local`, fill in one option, and restart. The header shows which mode is on.

## Demo script for the video (about 3 minutes)

1. **The mess (20s).** Open `public/sample-feedback.csv` in Excel. Rows 1–5 are one bug written five ways.
2. **Five reports, one bug (60s).** In the Review queue, the top item has 5 reports. Show the highlighted words, *Why the tool suggests this*, and *How sure is it?* (Medium, and why). Edit the draft title and click **Approve this ticket**. Point out that there is no "approve all".
3. **Human overrules (30s).** Open *Photos from my iPhone (HEIC)…*. The tool grouped two different photo bugs with only **Medium** confidence, and its reasons show the only shared concept is "photo". Click **Not the same issue → Split it out**. It's logged with your reason and won't be regrouped.
4. **Thin evidence gets a kinder answer (40s).** Open *Numbers look off*. Instead of "rejected", send the drafted question. Switch to **Tester view**, type `Omar F.`, reply "*The total is in dollars, should be pounds*". Back in the queue, it's now a bug, and *Possibly the same as…* suggests the currency ticket. Click **Merge into this**.
5. **Catching duplicates at the source (20s).** In Tester view, as a new tester, step 4, type "*the cost centre box freezes when I type*". The tool asks "*is this the same thing you saw?*" The tester clicks yes, and their report is added to UAT-101 as evidence.
6. **Show the working (10s).** The Decision log shows every decision, and how many times a person overruled the tool.

## How it works

```
CSV / tester form
      │
      ▼
 1. Sort ─────── bug · already known · idea · needs more detail · not actionable
      │             (patterns + match against the known-issues list)
 2. Group ────── average-linkage clustering on a similarity score:
      │             45% text similarity (TF-IDF, or AI embeddings if a key is set)
      │             25% same test step
      │             30% shared concepts from a domain glossary (symptoms count double)
 3. Explain ──── reasons, highlighted shared words, High/Medium/Low + what's missing
 4. Draft ────── ticket (steps from the test script, expected, actual quotes, severity)
      │             or a kind question, or a thank-you note
      ▼
 5. A person decides, one item at a time ── approve / edit / split / merge /
                                           change category / ask / log / close
      │
      ▼
 6. Tester sees the outcome, and can reply to questions (loops back to step 1)
```

Confidence is shown as **High / Medium / Low with reasons**, never a percentage, because a score like "87%" claims more precision than the tool has.

## Where things live

| File | What's in it | Who on the team |
|---|---|---|
| `src/data/seed.ts` | Demo app, test script, known issues, 42 reports | Data / demo |
| `src/lib/glossary.ts` | Words that mean the same thing ("froze" = "hangs") | AI / engine |
| `src/lib/engine.ts` | Sorting, grouping, confidence, explanations, drafts. **Thresholds at the top.** | AI / engine |
| `src/lib/ai.ts` | Optional OpenAI-compatible calls (embeddings + rewording) | AI / engine |
| `src/lib/actions.ts` | Every change + its log entry. No bulk actions on purpose. | Backend |
| `src/lib/store.ts` | JSON-file storage (swap for Supabase via `supabase/schema.sql`) | Backend |
| `src/components/ReviewQueue.tsx` | Manager screen | Frontend |
| `src/components/TesterView.tsx` | Tester screen | Frontend / UX |
| `src/components/DecisionLog.tsx` | Log + headline numbers | Frontend |

`npm run groups` prints how the engine groups the demo data, which helps when tuning thresholds or the glossary.

## Known limits / next steps

- The **AI path** (`src/lib/ai.ts`) is written for any OpenAI-compatible API but **hasn't been tested with a live key yet**. Try it early. If it fails, the app falls back to local similarity and says so in the header.
- The local engine relies on `glossary.ts`. New wording for a symptom may need adding there, or turn on embeddings.
- Stretch ideas: a **test-cycle trends** page (problems per step, by day), screenshot uploads, Supabase storage, a Jira export for approved tickets.
