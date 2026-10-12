// Summarises Lighthouse JSON reports (lab data only) into a compact table + JSON evidence file.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
const dir = process.argv[2];
const out = process.argv[3];
const rows = [];
for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
  const r = JSON.parse(readFileSync(`${dir}/${file}`, "utf8"));
  const a = r.audits;
  const num = (id) => a[id]?.numericValue;
  rows.push({
    page: file.replace(".json", ""),
    form: r.configSettings.formFactor,
    throttling: r.configSettings.throttlingMethod,
    perf: Math.round((r.categories.performance?.score ?? 0) * 100),
    a11y: Math.round((r.categories.accessibility?.score ?? 0) * 100),
    bestPractices: Math.round((r.categories["best-practices"]?.score ?? 0) * 100),
    seo: Math.round((r.categories.seo?.score ?? 0) * 100),
    fcpMs: Math.round(num("first-contentful-paint")),
    lcpMs: Math.round(num("largest-contentful-paint")),
    tbtMs: Math.round(num("total-blocking-time")),
    cls: +(num("cumulative-layout-shift") ?? 0).toFixed(3),
    ttfbMs: Math.round(num("server-response-time") ?? 0),
    transferKB: Math.round((num("total-byte-weight") ?? 0) / 1024),
    jsKB: Math.round((a["network-requests"]?.details?.items ?? []).filter((i) => i.resourceType === "Script").reduce((s, i) => s + (i.transferSize ?? 0), 0) / 1024),
    lcpElement: a["largest-contentful-paint-element"]?.details?.items?.[0]?.items?.[0]?.node?.snippet?.slice(0, 80) ?? null,
    failedAudits: Object.values(a).filter((x) => x.score !== null && x.score !== undefined && x.score < 0.9 && x.scoreDisplayMode === "binary").map((x) => x.id),
    opportunities: Object.values(a).filter((x) => x.details?.type === "opportunity" && (x.details.overallSavingsMs ?? 0) > 100).map((x) => `${x.id}(${Math.round(x.details.overallSavingsMs)}ms)`),
  });
}
console.table(rows.map(({ lcpElement, failedAudits, opportunities, ...r }) => r));
for (const r of rows) { console.log(`\n${r.page}\n  LCP el: ${r.lcpElement}\n  fail: ${r.failedAudits.join(", ")}\n  opp: ${r.opportunities.join(", ")}`); }
if (out) writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), note: "Lighthouse lab data, localhost production build, simulated throttling (mobile preset: Slow 4G / 4x CPU). Not field data.", rows }, null, 2));
