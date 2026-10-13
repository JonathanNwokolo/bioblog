/**
 * Fase 2.3.9 — ciclo de vida: montar/desmontar o motor várias vezes (alternando a versão sem
 * movimento), com contagem líquida de listeners e de quadros pendentes.
 *   QA_OUT=lifecycle
 */
import { mkdir, writeFile } from "node:fs/promises";
import { launch, BASE, seek, EVIDENCE } from "./qa239-lib.mjs";

const out = `${EVIDENCE}/${process.env.QA_OUT ?? "lifecycle"}`;
await mkdir(out, { recursive: true });
const browser = await launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await context.addInitScript(() => {
  const net = {};
  const wrap = (target, name) => {
    const add = target.addEventListener.bind(target);
    const remove = target.removeEventListener.bind(target);
    target.addEventListener = (type, listener, options) => {
      net[`${name}:${type}`] = (net[`${name}:${type}`] ?? 0) + 1;
      return add(type, listener, options);
    };
    target.removeEventListener = (type, listener, options) => {
      net[`${name}:${type}`] = (net[`${name}:${type}`] ?? 0) - 1;
      return remove(type, listener, options);
    };
  };
  wrap(window, "window");
  wrap(document, "document");
  window.__LISTENERS__ = net;
  let raf = 0;
  const original = window.requestAnimationFrame.bind(window);
  window.__RAF_COUNT__ = () => raf;
  window.requestAnimationFrame = (cb) => {
    raf += 1;
    return original(cb);
  };
});
const page = await context.newPage();
page.setDefaultTimeout(180_000);
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/explorar?quality=high`, { waitUntil: "networkidle", timeout: 180_000 });
await page.waitForFunction(() => window.__MICROCOSMOS_CINEMATIC__?.getRenderCount() > 0);
await seek(page, 0.745, 800);

const snapshot = () =>
  page.evaluate(() => {
    const h = window.__MICROCOSMOS_CINEMATIC__;
    const interesting = Object.fromEntries(
      Object.entries(window.__LISTENERS__).filter(([key]) => /visibilitychange|scroll|resize|pageshow|keydown|wheel|touchmove|webglcontext/.test(key)),
    );
    return {
      canvases: document.querySelectorAll("canvas").length,
      engine: Boolean(h),
      listeners: interesting,
      metrics: h ? { geometries: h.getMetrics().geometries, textures: h.getMetrics().textures } : null,
      heapMB: performance.memory ? Number((performance.memory.usedJSHeapSize / 1048576).toFixed(1)) : null,
    };
  });

const rounds = [await snapshot()];
for (let i = 0; i < 4; i += 1) {
  await page.getByRole("button", { name: "Ativar a versão sem movimento" }).click();
  await page.waitForTimeout(800);
  const staticState = await snapshot();
  const rafBefore = await page.evaluate(() => window.__RAF_COUNT__());
  await page.waitForTimeout(1500);
  const rafAfter = await page.evaluate(() => window.__RAF_COUNT__());
  staticState.rafIn1500msWhileStatic = rafAfter - rafBefore;
  rounds.push({ phase: `static-${i + 1}`, ...staticState });
  await page.getByRole("button", { name: "Ativar travessia" }).click();
  await page.waitForFunction(() => window.__MICROCOSMOS_CINEMATIC__?.getRenderCount() > 0);
  await seek(page, 0.745, 800);
  rounds.push({ phase: `journey-${i + 1}`, ...(await snapshot()) });
}
await writeFile(`${out}/lifecycle.json`, JSON.stringify({ rounds, errors }, null, 1));
console.log(JSON.stringify({ rounds: rounds.map((r) => ({ phase: r.phase ?? "start", canvases: r.canvases, engine: r.engine, textures: r.metrics?.textures, geometries: r.metrics?.geometries, heapMB: r.heapMB, rafStatic: r.rafIn1500msWhileStatic, listeners: r.listeners })), errors }, null, 1));
await context.close();
await browser.close();
