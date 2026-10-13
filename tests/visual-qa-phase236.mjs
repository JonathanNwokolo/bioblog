/** Evidência da correção 2.3.6: entrada pela ocular superior. */
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const BASE = process.env.QA_BASE_URL ?? "http://localhost:3000";
const OUT = "docs/evidence/phase23/round-7-eyepiece-entry";
const DEBUG = process.env.QA_DEBUG === "1";
const out = DEBUG ? `${OUT}/debug` : process.env.QA_MOBILE ? `${OUT}/mobile` : OUT;
await mkdir(out, { recursive: true });

const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});
const context = await browser.newContext({ viewport: process.env.QA_MOBILE ? { width: 390, height: 844 } : { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(e.message));
page.setDefaultTimeout(120_000);
await page.goto(`${BASE}/explorar?quality=high${DEBUG ? "&debug=optics" : ""}`, { waitUntil: "networkidle", timeout: 180_000 });
await page.waitForFunction(() => window.__MICROCOSMOS_CINEMATIC__?.getRenderCount() > 0, null, { timeout: 120_000 });

async function seek(progress) {
  const g = await page.evaluate(() => {
    const track = document.querySelector("section[data-explorar-journey]");
    const stage = track.firstElementChild;
    return { top: track.getBoundingClientRect().top + window.scrollY, travel: track.offsetHeight - stage.clientHeight };
  });
  await page.evaluate(({ top, travel, progress }) => window.scrollTo({ top: top + travel * progress, behavior: "instant" }), { ...g, progress });
  await page.waitForFunction((t) => Math.abs(window.__MICROCOSMOS_CINEMATIC__.getProgress() - t) < 0.003, progress, { timeout: 120_000 });
  await page.waitForTimeout(500);
}

const points = (process.env.QA_POINTS ?? "0,0.1,0.2,0.3,0.4,0.48,0.52,0.55,0.58,0.6,0.62,0.66,0.7,0.8,0.95,1")
  .split(",").map(Number);
const report = { debug: DEBUG, frames: [] };
for (const p of points) {
  await seek(p);
  const name = `${String(Math.round(p * 100)).padStart(3, "0")}.png`;
  await page.screenshot({ path: `${out}/${name}` });
  report.frames.push({ p, pose: await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.getPose()) });
}
if (DEBUG) {
  report.optics = await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.optics.describe());
  report.collisions = await page.evaluate(() => ({
    approach: window.__MICROCOSMOS_CINEMATIC__.optics.audit(0.0, 0.56),
    traversal: window.__MICROCOSMOS_CINEMATIC__.optics.audit(0.56, 0.7),
  }));
  // Vistas externas de inspeção: lateral e de topo, com o progresso 0.55 marcado.
  const views = {
    lateral: { position: [14, 0, -4.8], target: [0.66, 1.6, -3.5] },
    frontal: { position: [0.66, 14, -4.8], target: [0.66, 1.6, -4.0] },
    topo: { position: [0.66, 3.0, -16], target: [0.66, 1.6, -4.0] },
  };
  for (const [name, view] of Object.entries(views)) {
    await seek(0.55);
    await page.evaluate((v) => window.__MICROCOSMOS_CINEMATIC__.optics.setView(v), view);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/vista-${name}.png` });
  }
}
report.errors = errors;
await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
await browser.close();
console.log(JSON.stringify({ errors, collisions: report.collisions ? { a: report.collisions.approach.length, t: report.collisions.traversal.length } : null }));
