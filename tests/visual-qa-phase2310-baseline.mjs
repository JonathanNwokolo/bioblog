/** Captura comparável da Fase 2.3.9 antes do Living Slide. */
import { writeFile } from "node:fs/promises";
import { EVIDENCE, VIEWPORTS, ensureDir, launch, openJourney, seek } from "./qa2310-lib.mjs";

const out = await ensureDir(`${EVIDENCE}/before`);
const browser = await launch();
const report = { source: "Phase 2.3.9 local dev server", frames: [] };
const frames = [
  ["field-formed", 0.67],
  ["giardia", 0.74],
  ["t-cruzi", 0.815],
  ["trichuris", 0.865],
];

for (const viewport of ["1440", "390"]) {
  const { context, page, errors } = await openJourney(browser, VIEWPORTS[viewport]);
  for (const [name, progress] of frames) {
    await seek(page, progress);
    await page.screenshot({ path: `${out}/${name}-${viewport}.png` });
    const metrics = await page.evaluate(() => {
      const api = window.__MICROCOSMOS_CINEMATIC__;
      const track = document.querySelector("section[data-explorar-journey]");
      const stage = track.firstElementChild;
      return {
        scrollY: Math.round(window.scrollY),
        progress: api.getProgress(),
        stage: api.getStageId(),
        trackHeight: track.offsetHeight,
        viewportHeight: stage.clientHeight,
        travel: track.offsetHeight - stage.clientHeight,
        rendering: api.getMetrics(),
        optical: api.getOptical(),
      };
    });
    report.frames.push({ viewport, name, progress, metrics });
  }
  report[`errors-${viewport}`] = errors;
  await context.close();
}

await writeFile(`${out}/baseline.json`, JSON.stringify(report, null, 2));
await browser.close();
console.log(`phase2310 baseline ok: ${report.frames.length} frames`);
