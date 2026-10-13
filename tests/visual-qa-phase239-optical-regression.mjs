/**
 * Fase 2.3.9 — regressão da transição óptica aprovada (2.3.8) com os organismos agora em WebGL:
 *   1. varredura de contrato a cada 0,5 % (visibilidade instrumento/amostra/organismos/marcadores)
 *   2. reversibilidade (estado e pixels) com o movimento local CONGELADO numa fase fixa
 *
 * O movimento local dos organismos é independente do progresso. Para comparar pixels, ele é
 * congelado (motion.freezeAt(0)); sem isso, dois instantes diferentes têm poses diferentes de
 * propósito e a igualdade de pixels não se aplica.
 *
 *   QA_VPS=1440,390  QA_OUT=optical-regression
 */
import { mkdir, writeFile } from "node:fs/promises";
import { launch, openJourney, seek, EVIDENCE, VIEWPORTS } from "./qa239-lib.mjs";

const out = `${EVIDENCE}/${process.env.QA_OUT ?? "optical-regression"}`;
await mkdir(out, { recursive: true });
const browser = await launch();
const summary = {};

for (const vp of (process.env.QA_VPS ?? "1440,390").split(",")) {
  const { context, page, errors } = await openJourney(browser, VIEWPORTS[vp]);
  await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.motion.freezeAt(0));
  const fast = async (p) => {
    await seek(page, p, 120);
  };
  const probe = () =>
    page.evaluate(() => {
      const h = window.__MICROCOSMOS_CINEMATIC__;
      const o = h.getOptical();
      const organisms = h.organisms().organisms;
      const markers = {};
      document.querySelectorAll("[data-parasite-id]").forEach((el) => {
        markers[el.dataset.parasiteId] = { active: el.dataset.visible === "true", tab: el.tabIndex, left: el.style.left, top: el.style.top };
      });
      return { p: h.getProgress(), phase: o.phase, instrument: o.instrumentVisible, world: o.worldVisible, reveals: o.reveals, organisms, markers, pose: h.getPose() };
    });

  // 1 — contrato
  const violations = [];
  let rows = 0;
  for (let p = 0.4; p <= 0.92001; p += 0.005) {
    await fast(Number(p.toFixed(3)));
    const s = await probe();
    rows += 1;
    const bad = (msg) => violations.push({ p: s.p, msg });
    if (s.instrument === s.world) bad(`instrumento e amostra ${s.instrument ? "juntos" : "ambos ocultos"}`);
    if (s.p >= 0.555 && s.instrument) bad("instrumento visível depois do corte");
    if (s.p < 0.55 && s.world) bad("amostra visível antes do corte");
    for (const [id, o] of Object.entries(s.organisms)) {
      if (s.p < 0.665 && (o.visible || o.presence > 0)) bad(`${id} presente antes do campo formado`);
      if (s.p < 0.86 && id === "giardia" && s.p > 0.79 && o.visible) bad(`${id} fantasma fora da janela (${s.p})`);
      if (s.p < 0.9 && s.p > 0.86 && id === "t-cruzi" && o.visible) bad(`${id} fantasma fora da janela (${s.p})`);
    }
    for (const [id, m] of Object.entries(s.markers)) {
      if (m.active && s.reveals[id] < 0.9) bad(`marcador ${id} ativo com reveal ${s.reveals[id]}`);
      if (m.active && m.tab !== 0) bad(`marcador ${id} visível sem tabIndex 0`);
      if (!m.active && m.tab === 0) bad(`marcador ${id} focável sem estar ativo`);
    }
  }

  // 2 — reversibilidade
  const routes = [[0.45, 0.6, 0.45], [0.5, 0.75, 0.5], [0.55, 0.95, 0.55], [0.7, 0.3, 0.7], [0.745, 0.5, 0.745], [0.815, 0.97, 0.815], [0, 1, 0]];
  const reverse = [];
  for (const route of routes) {
    const states = [];
    const shots = [];
    for (const p of route) {
      await seek(page, p, 500);
      await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.motion.freezeAt(0));
      await page.waitForTimeout(250);
      states.push(await probe());
      shots.push(await page.screenshot());
    }
    const a = states[0];
    const b = states[states.length - 1];
    const diffs = [];
    const walk = (x, y, path) => {
      if (typeof x === "object" && x !== null) for (const key of Object.keys(x)) walk(x[key], y?.[key], `${path}.${key}`);
      else if (path !== ".p" && x !== y) diffs.push({ path, from: x, to: y });
    };
    walk(a, b, "");
    reverse.push({ route: route.join("→"), structuralDiffs: diffs.length, firstDiffs: diffs.slice(0, 3), pixelsEqual: shots[0].equals(shots[shots.length - 1]) });
  }
  summary[vp] = { steps: rows, violations: violations.length, violationSample: violations.slice(0, 5), reverse, errors };
  await context.close();
}
await writeFile(`${out}/regression.json`, JSON.stringify(summary, null, 1));
console.log(JSON.stringify(summary, null, 1));
await browser.close();
