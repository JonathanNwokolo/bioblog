/**
 * Fase 2.3.9 — matriz de viewports (1440/1280/768/390/320) por organismo:
 * revelação plena, movimento ativo/pausado/retomado, rolagem adiante/atrás, enquadramento
 * (nenhum corte lateral em toda a janela), vistas frontal/oblíqua e hub.
 *   QA_OUT=viewports
 */
import { mkdir, writeFile } from "node:fs/promises";
import { launch, openJourney, seek, EVIDENCE, VIEWPORTS } from "./qa239-lib.mjs";

const out = `${EVIDENCE}/${process.env.QA_OUT ?? "viewports"}`;
await mkdir(out, { recursive: true });
const browser = await launch();
const report = { viewports: {} };
const organisms = [
  { id: "giardia", peak: 0.745, window: [0.68, 0.775] },
  { id: "t-cruzi", peak: 0.815, window: [0.76, 0.85] },
  { id: "trichuris", peak: 0.872, window: [0.84, 0.895] },
];

for (const vp of (process.env.QA_VPS ?? "1440,1280,768,390,320").split(",")) {
  const { context, page, errors } = await openJourney(browser, VIEWPORTS[vp]);
  const entry = { overflowX: false, organisms: {}, errors };
  entry.overflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  for (const { id, peak, window: range } of organisms) {
    const o = {};
    await seek(page, peak, 900);
    await page.screenshot({ path: `${out}/${id}-${vp}-full.png` });
    // Enquadramento: o retângulo projetado inteiro dentro do palco em toda a janela de leitura.
    const sweep = [];
    for (let p = range[0]; p <= range[1] + 1e-9; p += (range[1] - range[0]) / 12) {
      await seek(page, p, 250);
      sweep.push(
        await page.evaluate(([id, p]) => {
          const h = window.__MICROCOSMOS_CINEMATIC__;
          const s = h.screen().find((x) => x.id === id);
          const stage = document.querySelector("section[data-explorar-journey]").firstElementChild;
          const w = stage.clientWidth;
          const hgt = stage.clientHeight;
          const reveal = h.getOptical().reveals[id];
          const aspect = { giardia: 1.094, "t-cruzi": 0.5, trichuris: 0.458 }[id];
          const halfW = s.widthPx / 2;
          const halfH = (s.widthPx * aspect) / 2;
          return {
            p: Number(p.toFixed(3)),
            reveal,
            visible: s.visible,
            left: Number((s.x - halfW).toFixed(1)),
            right: Number((s.x + halfW).toFixed(1)),
            top: Number((s.y - halfH).toFixed(1)),
            bottom: Number((s.y + halfH).toFixed(1)),
            stage: [w, hgt],
          };
        }, [id, p]),
      );
    }
    const readable = sweep.filter((f) => f.reveal >= 0.5);
    o.framing = {
      samples: readable.length,
      clipped: readable.filter((f) => f.left < -0.5 || f.right > f.stage[0] + 0.5 || f.top < -0.5 || f.bottom > f.stage[1] + 0.5).length,
      minLeft: Math.min(...readable.map((f) => f.left)),
      maxRight: Math.max(...readable.map((f) => f.right - f.stage[0])),
    };
    await seek(page, peak, 700);
    // Movimento ativo → pausado → retomado (estado e captura).
    o.motion = {};
    if (id !== "trichuris") {
      const a = await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.motion.diagnostics());
      await page.waitForTimeout(900);
      const b = await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.motion.diagnostics());
      o.motion.active = { advanced: Number((b.motionTime - a.motionTime).toFixed(3)), running: b.running };
      await page.screenshot({ path: `${out}/${id}-${vp}-motion-active.png` });
      await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.motion.pause());
      await page.waitForTimeout(500);
      const c = await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.motion.diagnostics());
      await page.waitForTimeout(700);
      const d = await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.motion.diagnostics());
      o.motion.paused = { advanced: Number((d.motionTime - c.motionTime).toFixed(3)), running: d.running };
      await page.screenshot({ path: `${out}/${id}-${vp}-motion-paused.png` });
      await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.motion.resume());
      await page.waitForTimeout(900);
      const e = await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.motion.diagnostics());
      o.motion.resumed = { advanced: Number((e.motionTime - d.motionTime).toFixed(3)), running: e.running };
    }
    // Vistas de inspeção: frontal, oblíqua e lateral (relevo 2,5D).
    if (vp === "1440" || vp === "390") {
      await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.motion.pause());
      for (const [name, state] of [
        ["front", { yaw: 0, pitch: 0 }],
        ["oblique", { yaw: 0.6, pitch: 0.18 }],
        ["side", { yaw: 1.0, pitch: 0 }],
      ]) {
        await page.evaluate(([id, state]) => {
          const h = window.__MICROCOSMOS_CINEMATIC__;
          h.motion.freezeAt(1.2);
          h.inspect({ active: id, ...state });
        }, [id, state]);
        await page.waitForTimeout(1100);
        await page.screenshot({ path: `${out}/${id}-${vp}-view-${name}.png` });
      }
      await page.evaluate(() => {
        const h = window.__MICROCOSMOS_CINEMATIC__;
        h.inspect({ active: null, yaw: 0, pitch: 0, zoom: 1 });
        h.motion.freezeAt(null);
        h.motion.resume();
      });
    }
    entry.organisms[id] = o;
  }
  // Composição final.
  await seek(page, 0.975, 900);
  await page.screenshot({ path: `${out}/hub-${vp}.png` });
  entry.hub = await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.screen().map((s) => ({ id: s.id, visible: s.visible, x: Math.round(s.x), y: Math.round(s.y), w: Math.round(s.widthPx) })));
  report.viewports[vp] = entry;
  await context.close();
}
await writeFile(`${out}/viewports.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(Object.fromEntries(Object.entries(report.viewports).map(([k, v]) => [k, { overflowX: v.overflowX, errors: v.errors.length, framing: Object.fromEntries(Object.entries(v.organisms).map(([id, o]) => [id, o.framing])) }])), null, 1));
await browser.close();
