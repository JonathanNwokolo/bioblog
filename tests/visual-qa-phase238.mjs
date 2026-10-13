/**
 * Evidência da Fase 2.3.8 — transição óptica.
 *
 *   QA_OUT=before|after   subpasta de saída em docs/evidence/phase23/round-8-optical-transition/
 *   QA_POINTS=0.45,0.47   lista de progressos (padrão: 0,45 → 0,75 em passos de 0,02)
 *   QA_MOBILE=1           viewport 390×844
 *   QA_PROBE=1            registra, por progresso, o estado interno (fases, visibilidade, DOM)
 *   QA_REVERSE=1          executa as rotas de reversibilidade e compara os estados
 */
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = process.env.QA_BASE_URL ?? "http://localhost:3000";
const ROOT = "docs/evidence/phase23/round-8-optical-transition";
const mobile = Boolean(process.env.QA_MOBILE);
const sub = `${process.env.QA_OUT ?? "after"}${mobile ? "-mobile" : ""}`;
const out = `${ROOT}/${sub}`;
await mkdir(out, { recursive: true });

const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});
const context = await browser.newContext({
  viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(e.message));
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
  await page.waitForTimeout(350);
}

const probe = () =>
  page.evaluate(() => {
    const h = window.__MICROCOSMOS_CINEMATIC__;
    const visuals = [...document.querySelectorAll("[data-parasite-visual]")].map((el) => ({
      id: el.dataset.parasiteVisual,
      visible: el.dataset.visible,
      opacity: Number(getComputedStyle(el).opacity).toFixed(3),
    }));
    const markers = [...document.querySelectorAll("[data-parasite-id]")].map((el) => ({
      id: el.dataset.parasiteId,
      visible: el.dataset.visible,
      tab: el.tabIndex,
    }));
    return {
      progress: h.getProgress(),
      pose: h.getPose(),
      optical: h.getOptical ? h.getOptical() : null,
      visuals,
      markers,
    };
  });

const points = (process.env.QA_POINTS
  ? process.env.QA_POINTS.split(",").map(Number)
  : Array.from({ length: 16 }, (_, i) => Number((0.45 + i * 0.02).toFixed(2))));
const report = { sub, mobile, frames: [] };
for (const p of points) {
  await seek(p);
  const name = `${String(Math.round(p * 1000)).padStart(4, "0")}.png`;
  await page.screenshot({ path: `${out}/${name}` });
  report.frames.push({ p, ...(await probe()) });
}

if (process.env.QA_REVERSE) {
  const routes = [
    [0.45, 0.6, 0.45],
    [0.5, 0.75, 0.5],
    [0.55, 0.95, 0.55],
    [0.7, 0.3, 0.7],
    [0, 1, 0],
  ];
  report.reverse = [];
  for (const route of routes) {
    const first = [];
    const states = [];
    for (const p of route) {
      await seek(p);
      const s = await probe();
      states.push({ p, s });
    }
    const a = JSON.stringify({ ...states[0].s, pose: states[0].s.pose });
    const b = JSON.stringify({ ...states[states.length - 1].s, pose: states[states.length - 1].s.pose });
    // Compara pose, estado óptico e anotações (progress pode divergir em ±0,003 por arredondamento do scroll).
    const strip = (s) => {
      const { progress, ...rest } = s;
      void progress;
      return JSON.stringify(rest);
    };
    const same = strip(states[0].s) === strip(states[states.length - 1].s);
    report.reverse.push({ route, same, first: first.length, a: a.length, b: b.length });
    // Capturas dos extremos da rota para comparação visual de pixels.
    const bufStart = await (async () => { await seek(route[0]); return page.screenshot(); })();
    await seek(route[1]);
    await seek(route[2]);
    const bufEnd = await page.screenshot();
    report.reverse[report.reverse.length - 1].pixelsEqual = bufStart.equals(bufEnd);
    report.reverse[report.reverse.length - 1].bytes = [bufStart.length, bufEnd.length];
  }
}

report.errors = errors;
await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
await browser.close();
console.log(JSON.stringify({ out, frames: report.frames.length, errors, reverse: report.reverse?.map((r) => ({ r: r.route.join("→"), same: r.same, pixelsEqual: r.pixelsEqual })) }));
