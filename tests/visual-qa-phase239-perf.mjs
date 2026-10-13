/**
 * Fase 2.3.9 — métricas de desempenho do movimento local (SwiftShader/CPU; NÃO é GPU física).
 *   QA_OUT=perf
 */
import { mkdir, writeFile } from "node:fs/promises";
import { launch, seek, BASE, EVIDENCE } from "./qa239-lib.mjs";

const out = `${EVIDENCE}/${process.env.QA_OUT ?? "perf"}`;
await mkdir(out, { recursive: true });
const browser = await launch();
const report = {
  note: "Chromium headless com ANGLE/SwiftShader (GL por software). Não representa GPU de desktop nem de celular.",
  runs: [],
};

for (const [name, viewport, dsf] of [
  ["desktop-1440", { width: 1440, height: 900 }, 1],
  ["mobile-390-dpr2", { width: 390, height: 844 }, 2],
]) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: dsf });
  const page = await context.newPage();
  page.setDefaultTimeout(180_000);
  await page.goto(`${BASE}/explorar?quality=high`, { waitUntil: "networkidle", timeout: 180_000 });
  await page.waitForFunction(() => window.__MICROCOSMOS_CINEMATIC__?.getRenderCount() > 0);
  const run = { name, viewport, deviceScaleFactor: dsf, points: {} };
  for (const [label, p] of [["giardia", 0.745], ["t-cruzi", 0.815], ["trichuris", 0.872], ["hub", 0.975]]) {
    const g = await page.evaluate(() => {
      const track = document.querySelector("section[data-explorar-journey]");
      const stage = track.firstElementChild;
      return { top: track.getBoundingClientRect().top + window.scrollY, travel: track.offsetHeight - stage.clientHeight };
    });
    await page.evaluate(({ top, travel, p }) => window.scrollTo({ top: top + travel * p, behavior: "instant" }), { ...g, p });
    await page.waitForFunction((t) => Math.abs(window.__MICROCOSMOS_CINEMATIC__.getProgress() - t) < 0.003, p);
    await page.waitForTimeout(1500);
    const before = await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.motion.diagnostics());
    await page.waitForTimeout(6000);
    run.points[label] = await page.evaluate((before) => {
      const h = window.__MICROCOSMOS_CINEMATIC__;
      const m = h.getMetrics();
      const d = h.motion.diagnostics();
      const o = h.organisms();
      return {
        running: d.running,
        motionFramesIn6s: d.motionFrames - before.motionFrames,
        frameCpuMs: d.frameCpuMs,
        frameIntervalMs: d.frameIntervalMs,
        drawCalls: m.calls,
        triangles: m.triangles,
        organismTriangles: o.triangles,
        geometries: m.geometries,
        textures: m.textures,
        pixelRatio: m.pixelRatio,
        heapMB: performance.memory ? Number((performance.memory.usedJSHeapSize / 1048576).toFixed(1)) : null,
      };
    }, before);
  }
  report.runs.push(run);
  await context.close();
}
await writeFile(`${out}/perf.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
await browser.close();
