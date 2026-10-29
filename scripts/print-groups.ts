// Prints how the engine groups the demo data. Handy while tuning thresholds:
//   npm run groups
import { seedStore } from "../src/lib/seedStore";
import { buildCtx, fullAnalyse, groupTitle } from "../src/lib/engine";

const s = seedStore();
fullAnalyse(s, buildCtx(s));
for (const g of s.groups) {
  const conf = g.groupConfidence ? `same issue: ${g.groupConfidence}` : `category: ${g.categoryConfidence}`;
  console.log(`${g.id.padEnd(4)} ${g.category.padEnd(15)} ${conf.padEnd(20)} [${g.reportIds.join(", ")}]  ${groupTitle(s, g)}`);
}
