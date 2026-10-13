/**
 * OBSOLETO (Fase 2.3.9): consulta `[data-parasite-visual]`, removido quando os organismos passaram
 * para WebGL. Use `tests/visual-qa-phase239-optical-regression.mjs`.
 *
 * Fase 2.3.8 — reversibilidade: o mesmo progresso deve reconstruir o mesmo estado
 * (pose, estado óptico, DOM dos organismos e pixels), seja qual for a direção de chegada.
 *
 *   QA_MOBILE=1  viewport 390×844
 */
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = process.env.QA_BASE_URL ?? "http://localhost:3000";
const mobile = Boolean(process.env.QA_MOBILE);
const out = "docs/evidence/phase23/round-8-optical-transition";
await mkdir(out, { recursive: true });

const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});
const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 } });
const page = await context.newPage();
page.setDefaultTimeout(120_000);
await page.goto(`${BASE}/explorar?quality=high`, { waitUntil: "networkidle", timeout: 180_000 });
await page.waitForFunction(() => window.__MICROCOSMOS_CINEMATIC__?.getRenderCount() > 0, null, { timeout: 120_000 });

async function seek(progress) {
  const g = await page.evaluate(() => {
    const track = document.querySelector("section[data-explorar-journey]");
    const stage = track.firstElementChild;
    return { top: track.getBoundingClientRect().top + window.scrollY, travel: track.offsetHeight - stage.clientHeight };
  });
  await page.evaluate(({ top, travel, progress }) => window.scrollTo({ top: top + travel * progress, behavior: "instant" }), { ...g, progress });
  await page.waitForFunction((t) => Math.abs(window.__MICROCOSMOS_CINEMATIC__.getProgress() - t) < 0.003, progress, { timeout: 120_000 });
  await page.waitForTimeout(400);
}

const snapshot = () =>
  page.evaluate(() => {
    const h = window.__MICROCOSMOS_CINEMATIC__;
    const dom = [...document.querySelectorAll("[data-parasite-id]")].map((el) => {
      const visual = document.querySelector(`[data-parasite-visual="${el.dataset.parasiteId}"]`);
      return {
        id: el.dataset.parasiteId,
        marker: el.dataset.visible,
        tab: el.tabIndex,
        visual: visual.dataset.visible,
        reveal: visual.style.getPropertyValue("--reveal"),
        left: el.style.left,
        top: el.style.top,
      };
    });
    const stage = document.querySelector("section[data-explorar-journey]").firstElementChild;
    const css = {};
    for (const k of ["--optic-r", "--optic-f", "--optic-glow", "--optic-g", "--optic-wash", "--optic-field-vignette", "--optic-iris"]) css[k] = stage.style.getPropertyValue(k);
    return { progress: h.getProgress(), pose: h.getPose(), optical: h.getOptical(), dom, css, filter: document.querySelector("canvas").parentElement.style.filter };
  });

const routes = [
  [0.45, 0.6, 0.45],
  [0.5, 0.75, 0.5],
  [0.55, 0.95, 0.55],
  [0.7, 0.3, 0.7],
  [0, 1, 0],
];
const results = [];
for (const route of routes) {
  const states = [];
  const shots = [];
  for (const p of route) {
    await seek(p);
    states.push(await snapshot());
    shots.push(await page.screenshot());
  }
  const a = states[0];
  const b = states[states.length - 1];
  const diffs = [];
  const walk = (x, y, path) => {
    if (typeof x === "object" && x !== null) {
      for (const key of Object.keys(x)) walk(x[key], y?.[key], `${path}.${key}`);
    } else if (x !== y) diffs.push({ path, from: x, to: y });
  };
  walk(a, b, "");
  results.push({
    route: route.join("→"),
    progress: [a.progress, b.progress],
    structuralDiffs: diffs,
    pixelsEqual: shots[0].equals(shots[shots.length - 1]),
  });
}
await writeFile(`${out}/reversibility${mobile ? "-mobile" : ""}.json`, JSON.stringify(results, null, 2));
await browser.close();
console.log(JSON.stringify(results.map((r) => ({ route: r.route, progress: r.progress, diffs: r.structuralDiffs.length, pixelsEqual: r.pixelsEqual })), null, 1));
console.log(JSON.stringify(results.flatMap((r) => r.structuralDiffs.slice(0, 4).map((d) => ({ route: r.route, ...d })))));
