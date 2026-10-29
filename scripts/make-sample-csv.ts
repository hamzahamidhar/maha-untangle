// Writes public/sample-feedback.csv from the demo data (the "messy spreadsheet").
import fs from "node:fs";
import { SEED_REPORTS, STEPS } from "../src/data/seed";
const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
const rows = ["tester,step,browser,comment", ...SEED_REPORTS.map((r) => [q(r.tester), STEPS.find((s) => s.id === r.stepId)!.number, r.browser ?? "", q(r.comment)].join(","))];
fs.writeFileSync("public/sample-feedback.csv", rows.join("\n") + "\n");
console.log(`Wrote ${SEED_REPORTS.length} rows`);
