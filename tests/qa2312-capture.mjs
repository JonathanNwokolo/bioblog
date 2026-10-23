/**
 * Fase 2.3.12 — captura rápida de quadros da jornada em progressos arbitrários.
 * Uso: node tests/qa2312-capture.mjs <outDir> <width>x<height> p1,p2,... [query]
 */
import { launch, openJourney, seek, ensureDir } from "./qa2311-lib.mjs";

const [outDir = "docs/evidence/phase23/round-12/scratch", size = "1440x900", list = "0.3,0.37,0.5,0.68,0.85", query = ""] = process.argv.slice(2);
const [width, height] = size.split("x").map(Number);
const points = list.split(",").map(Number);

await ensureDir(outDir);
const browser = await launch();
const { context, page, errors } = await openJourney(browser, { width, height, query });
await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__?.motion?.freezeAt?.(1.2));
const report = [];
for (const p of points) {
  await seek(page, p, 500);
  const file = `${outDir}/${width}-p${p.toFixed(3)}.png`;
  await page.screenshot({ path: file });
  const info = await page.evaluate(() => {
    const api = window.__MICROCOSMOS_CINEMATIC__;
    const optics = api.getOpticalDiagnostics?.();
    const organisms = api.getOrganismScreenStates?.() ?? [];
    return {
      phase: optics?.phase,
      worlds: optics?.specimenWorlds,
      organisms: organisms.filter((o) => o.visible).map((o) => ({ id: o.id, w: Math.round(o.widthPx), x: Math.round(o.x), y: Math.round(o.y) })),
      hotspots: [...document.querySelectorAll("[data-parasite-id]")].filter((el) => el.dataset.visible === "true").map((el) => el.getAttribute("data-parasite-id")),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  report.push({ p, file, ...info });
}
console.log(JSON.stringify({ errors, report }, null, 1));
await context.close();
await browser.close();
