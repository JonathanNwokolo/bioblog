/**
 * OBSOLETO (Fase 2.3.9): consulta `[data-parasite-visual]`, removido quando os organismos passaram
 * para WebGL. Use `tests/visual-qa-phase239-optical-regression.mjs`.
 *
 * Fase 2.3.8 — varredura do contrato de visibilidade (sem imagens): a cada 0,5 % de progresso
 * confere o que o navegador realmente desenha/expõe, e exercita o marcador de verdade.
 *
 *   QA_MOBILE=1   viewport 390×844
 *   QA_REDUCED=1  prefers-reduced-motion: reduce (espera a versão estática)
 */
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = process.env.QA_BASE_URL ?? "http://localhost:3000";
const mobile = Boolean(process.env.QA_MOBILE);
const out = "docs/evidence/phase23/round-8-optical-transition";
await mkdir(out, { recursive: true });
const tag = mobile ? "-mobile" : "";

const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});
const context = await browser.newContext({
  viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
  reducedMotion: process.env.QA_REDUCED ? "reduce" : "no-preference",
});
const page = await context.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(e.message));
page.setDefaultTimeout(120_000);
await page.goto(`${BASE}/explorar?quality=high`, { waitUntil: "networkidle", timeout: 180_000 });

if (process.env.QA_REDUCED) {
  const staticVisible = await page.evaluate(() => {
    const el = document.querySelector("[data-static-view]");
    return Boolean(el && getComputedStyle(el).display !== "none");
  });
  const journeyHidden = await page.evaluate(() => {
    const el = document.querySelector("[data-explorar-journey]");
    return !el || getComputedStyle(el).display === "none" || el.getBoundingClientRect().height === 0;
  });
  const hasCanvas = await page.evaluate(() => Boolean(document.querySelector("canvas")));
  await page.screenshot({ path: `${out}/reduced-motion${tag}.png` });
  console.log(JSON.stringify({ reducedMotion: true, staticVisible, journeyHidden, hasCanvas, errors }));
  await browser.close();
  process.exit(0);
}

await page.waitForFunction(() => window.__MICROCOSMOS_CINEMATIC__?.getRenderCount() > 0, null, { timeout: 120_000 });

async function seek(progress) {
  const g = await page.evaluate(() => {
    const track = document.querySelector("section[data-explorar-journey]");
    const stage = track.firstElementChild;
    return { top: track.getBoundingClientRect().top + window.scrollY, travel: track.offsetHeight - stage.clientHeight };
  });
  await page.evaluate(({ top, travel, progress }) => window.scrollTo({ top: top + travel * progress, behavior: "instant" }), { ...g, progress });
  await page.waitForFunction((t) => Math.abs(window.__MICROCOSMOS_CINEMATIC__.getProgress() - t) < 0.0015, progress, { timeout: 120_000 });
  await page.waitForTimeout(120);
}

const probe = () =>
  page.evaluate(() => {
    const h = window.__MICROCOSMOS_CINEMATIC__;
    const o = h.getOptical();
    const dom = {};
    document.querySelectorAll("[data-parasite-id]").forEach((el) => {
      const id = el.dataset.parasiteId;
      const visual = document.querySelector(`[data-parasite-visual="${id}"]`);
      dom[id] = {
        marker: el.dataset.visible === "true",
        tab: el.tabIndex,
        visual: visual.dataset.visible === "true",
        opacity: Number(getComputedStyle(visual).opacity),
        markerOpacity: Number(getComputedStyle(el).opacity),
      };
    });
    return { p: h.getProgress(), phase: o.phase, instrument: o.instrumentVisible, world: o.worldVisible, formation: o.formation, glow: o.glow, fieldStop: o.fieldStop, organisms3d: o.organisms3d, reveals: o.reveals, hotspotsActive: o.hotspots, dom };
  });

const violations = [];
const firsts = { organismDom: null, markerActive: {}, instrumentGone: null, worldShown: null };
const rows = [];
for (let p = 0.4; p <= 0.92001; p += 0.005) {
  const q = Number(p.toFixed(3));
  await seek(q);
  const s = await probe();
  rows.push({ p: s.p, phase: s.phase, instrument: s.instrument, world: s.world, g: s.reveals.giardia, t: s.reveals["t-cruzi"], r: s.reveals.trichuris });
  const bad = (msg) => violations.push({ p: s.p, msg });
  if (s.instrument === s.world) bad(`instrumento e amostra ${s.instrument ? "juntos" : "ambos ocultos"}`);
  if (s.p >= 0.555 && s.instrument) bad("instrumento visível depois do corte");
  if (s.p < 0.55 && s.world) bad("amostra visível antes do corte");
  if (s.p < 0.665) {
    for (const [id, d] of Object.entries(s.dom)) {
      if (d.visual || d.marker || d.opacity > 0.001) bad(`${id} visível antes do campo formado (opacity ${d.opacity})`);
    }
    for (const [id, o3] of Object.entries(s.organisms3d)) if (o3.visible) bad(`${id} presente na cena 3D antes do campo formado`);
  }
  for (const [id, d] of Object.entries(s.dom)) {
    if (d.marker && s.reveals[id] < 0.9) bad(`marcador ${id} ativo com reveal ${s.reveals[id]}`);
    if (d.marker && d.tab !== 0) bad(`marcador ${id} visível sem tabIndex 0`);
    if (!d.marker && d.tab === 0) bad(`marcador ${id} focável sem estar ativo`);
    if (d.visual && !firsts.organismDom) firsts.organismDom = { id, p: s.p };
    if (d.marker && !firsts.markerActive[id]) firsts.markerActive[id] = s.p;
  }
  if (!s.instrument && firsts.instrumentGone === null) firsts.instrumentGone = s.p;
  if (s.world && firsts.worldShown === null) firsts.worldShown = s.p;
}

// Interação real: o marcador da Giardia abre a anotação, fixa o progresso e devolve ao fechar.
await seek(0.75);
const before = await probe();
const marker = page.locator('[data-parasite-id="giardia"]');
const clickable = await marker.evaluate((el) => getComputedStyle(el).pointerEvents !== "none" && el.dataset.visible === "true");
const interaction = { clickable, opened: false, closed: false };
if (clickable) {
  await marker.click({ timeout: 20_000 });
  await page.waitForSelector('[role="dialog"]', { timeout: 10_000 });
  interaction.opened = true;
  await page.keyboard.press("Escape");
  await page.waitForSelector('[role="dialog"]', { state: "detached", timeout: 10_000 });
  await page.waitForTimeout(500);
  const after = await probe();
  interaction.closed = true;
  interaction.progressRestored = Math.abs(after.p - before.p) < 0.004;
}
// Marcador oculto antes da hora não pode ser acionado.
await seek(0.6);
const hiddenMarker = await page.locator('[data-parasite-id="giardia"]').evaluate((el) => ({
  visible: el.dataset.visible,
  pointerEvents: getComputedStyle(el).pointerEvents,
  tabIndex: el.tabIndex,
}));

const overflow = await page.evaluate(() => ({
  x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
}));

const result = { mobile, steps: rows.length, violations, firsts, interaction, hiddenMarker, overflow, errors };
await writeFile(`${out}/contract-scan${tag}.json`, JSON.stringify({ ...result, rows }, null, 2));
await browser.close();
console.log(JSON.stringify(result, null, 1));
