/** Baseline da Fase 2.3.9: aparência atual (imagens DOM estáticas) dos três organismos, desktop e mobile. */
import { writeFile } from "node:fs/promises";
import { launch, openJourney, seek, ensureDir, EVIDENCE, VIEWPORTS } from "./qa239-lib.mjs";

const out = await ensureDir(`${EVIDENCE}/baseline`);
const browser = await launch();
const report = { frames: [] };
const shots = [
  ["giardia", 0.74], ["giardia-exit", 0.775],
  ["t-cruzi-enter", 0.775], ["t-cruzi", 0.815], ["t-cruzi-exit-a", 0.84], ["t-cruzi-exit-b", 0.852],
  ["trichuris", 0.865],
];
for (const vp of ["1440", "390"]) {
  const { context, page, errors } = await openJourney(browser, VIEWPORTS[vp]);
  for (const [name, p] of shots) {
    await seek(page, p, 500);
    await page.screenshot({ path: `${out}/${name}-${vp}.png` });
    const info = await page.evaluate(() => {
      const rect = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; };
      return [...document.querySelectorAll("[data-parasite-visual]")].map((el) => ({
        id: el.dataset.parasiteVisual, visible: el.dataset.visible, opacity: getComputedStyle(el).opacity, rect: rect(el),
      }));
    });
    report.frames.push({ vp, name, p, info });
  }
  report[`errors-${vp}`] = errors;
  await context.close();
}
await writeFile(`${out}/baseline.json`, JSON.stringify(report, null, 1));
await browser.close();
console.log("baseline ok", report.frames.length);
