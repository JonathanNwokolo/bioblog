/**
 * Fase 2.3.9 — contrato de movimento local dos organismos (navegador real, SwiftShader).
 *
 *  A  repouso sem laço: nenhum requestAnimationFrame quando nada está ativo
 *  B  movimento ativo/pausado/retomado e aba oculta; progresso narrativo e câmera não avançam
 *  C  determinismo: com o movimento congelado numa fase fixa, mesmo progresso → mesmos pixels
 *  D  alinhamento: o ponto projetado das anotações segue a anatomia renderizada durante o movimento
 *  E  memória/alocações: geometrias, texturas e heap estáveis durante a observação
 *  F  movimento reduzido e WebGL indisponível
 *
 *   QA_VP=1440  QA_OUT=contract
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const sharp = require("sharp");
import { launch, openJourney, seek, EVIDENCE, VIEWPORTS } from "./qa239-lib.mjs";

const vp = process.env.QA_VP ?? "1440";
const out = `${EVIDENCE}/${process.env.QA_OUT ?? "contract"}`;
await mkdir(out, { recursive: true });
const browser = await launch();
const report = { vp, checks: {} };
const sha = (buffer) => createHash("sha256").update(buffer).digest("hex").slice(0, 16);

/** Conta chamadas a requestAnimationFrame durante `ms`. */
async function countRaf(page, ms) {
  return page.evaluate(
    (ms) =>
      new Promise((resolve) => {
        const original = window.requestAnimationFrame.bind(window);
        let count = 0;
        window.requestAnimationFrame = (callback) => {
          count += 1;
          return original(callback);
        };
        setTimeout(() => {
          window.requestAnimationFrame = original;
          resolve(count);
        }, ms);
      }),
    ms,
  );
}

const motion = (page) => page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.motion.diagnostics());
const world = (page) =>
  page.evaluate(() => {
    const h = window.__MICROCOSMOS_CINEMATIC__;
    return { progress: h.getProgress(), pose: h.getPose(), scrollY: window.scrollY, renders: h.getRenderCount() };
  });

{
  const { context, page, errors } = await openJourney(browser, VIEWPORTS[vp]);

  // ---- A: repouso. Fora das janelas dos organismos nada pede quadros.
  const idle = {};
  for (const p of [0.2, 0.5, 0.63, 0.795, 0.9, 0.97]) {
    await seek(page, p, 600);
    const m = await motion(page);
    idle[p] = { rafIn1500ms: await countRaf(page, 1500), running: m.running, observable: m.observable };
  }
  report.checks.A_idle = idle;

  // ---- B: movimento ativo → pausa → retomada → aba oculta.
  await seek(page, 0.745, 900);
  const B = {};
  const before = await world(page);
  const m0 = await motion(page);
  B.activeRafIn1500ms = await countRaf(page, 1500);
  const m1 = await motion(page);
  const after = await world(page);
  B.active = { running: m1.running, motionAdvanced: m1.motionTime - m0.motionTime, framesDelta: m1.motionFrames - m0.motionFrames };
  B.narrativeUnchangedWhileMoving = {
    progressDelta: Math.abs(after.progress - before.progress),
    poseEqual: JSON.stringify(after.pose) === JSON.stringify(before.pose),
    scrollDelta: Math.abs(after.scrollY - before.scrollY),
    sceneRendersDelta: after.renders - before.renders,
  };
  await page.getByRole("button", { name: "Pausar movimento" }).first().click();
  await page.waitForTimeout(500);
  const m2 = await motion(page);
  B.pausedRafIn1500ms = await countRaf(page, 1500);
  const m3 = await motion(page);
  B.paused = { userPaused: m2.userPaused, running: m3.running, motionAdvanced: m3.motionTime - m2.motionTime };
  await page.screenshot({ path: `${out}/B-paused-${vp}.png` });
  await page.getByRole("button", { name: "Retomar movimento" }).first().click();
  await page.waitForTimeout(700);
  const m4 = await motion(page);
  B.resumedRafIn1500ms = await countRaf(page, 1500);
  const m5 = await motion(page);
  B.resumed = { running: m5.running, motionAdvanced: m5.motionTime - m4.motionTime };
  // Aba oculta (simulada pelo mesmo evento que o navegador dispara).
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(300);
  const m6 = await motion(page);
  B.hiddenRafIn1500ms = await countRaf(page, 1500);
  B.hidden = { running: (await motion(page)).running, observable: m6.observable };
  await page.evaluate(() => {
    delete document.visibilityState;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(500);
  B.visibleAgain = { running: (await motion(page)).running };
  report.checks.B_motion = B;

  // ---- C: determinismo com movimento congelado.
  await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.motion.pause());
  const C = [];
  for (const [name, route] of [
    ["giardia", [0.74, 0.3, 0.74]],
    ["t-cruzi", [0.81, 0.95, 0.81]],
    ["trichuis-ovo", [0.86, 0.1, 0.86]],
    ["hub", [0.97, 0.5, 0.97]],
  ]) {
    await seek(page, route[0], 700);
    await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.motion.freezeAt(2.5));
    await page.waitForTimeout(400);
    const a = await page.screenshot();
    const poseA = await world(page);
    await seek(page, route[1], 500);
    await seek(page, route[2], 700);
    await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.motion.freezeAt(2.5));
    await page.waitForTimeout(400);
    const b = await page.screenshot();
    const poseB = await world(page);
    C.push({
      route: `${name} ${route.join("→")}`,
      pixelsEqual: a.equals(b),
      hash: [sha(a), sha(b)],
      poseEqual: JSON.stringify(poseA.pose) === JSON.stringify(poseB.pose),
    });
  }
  report.checks.C_determinism = C;
  await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.motion.freezeAt(null));

  // ---- D: alinhamento anatomia ↔ ponto projetado durante o movimento.
  const D = [];
  await seek(page, 0.745, 800);
  for (const [id, p, label, color] of [
    ["giardia", 0.745, "nuclei", { r: [90, 190], g: [50, 140], b: [140, 255] }],
    ["t-cruzi", 0.815, "nucleus", { r: [80, 190], g: [50, 140], b: [120, 230] }],
  ]) {
    await seek(page, p, 700);
    for (const t of [0, 0.7, 1.4, 2.1, 2.8, 3.5]) {
      await page.evaluate((t) => window.__MICROCOSMOS_CINEMATIC__.motion.freezeAt(t), t);
      await page.waitForTimeout(250);
      const screen = await page.evaluate(([id, label]) => {
        const s = window.__MICROCOSMOS_CINEMATIC__.screen().find((x) => x.id === id);
        return { ...s.labels.find((l) => l.key === label), widthPx: s.widthPx };
      }, [id, label]);
      // Janela proporcional ao espécime: em telas estreitas o outro núcleo cairia dentro de ±38 px.
      const half = Math.max(8, Math.min(38, Math.round((screen.widthPx ?? 400) * 0.045)));
      const clip = { x: Math.max(0, Math.round(screen.x - half)), y: Math.max(0, Math.round(screen.y - half)), width: half * 2, height: half * 2 };
      const shot = await page.screenshot({ clip });
      const { data, info } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
      let n = 0;
      let sx = 0;
      let sy = 0;
      for (let y = 0; y < info.height; y += 1) {
        for (let x = 0; x < info.width; x += 1) {
          const i = (y * info.width + x) * info.channels;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          // Nucléolo: o ponto mais escuro e arroxeado do núcleo.
          if (lum < 62 && b > g + 6) {
            n += 1;
            sx += x;
            sy += y;
          }
        }
      }
      const centroid = n > 12 ? { x: clip.x + sx / n, y: clip.y + sy / n, pixels: n } : null;
      D.push({
        id, t, anchor: screen, shotHash: sha(shot), nucleolus: centroid,
        errorPx: centroid ? Number(Math.hypot(centroid.x - screen.x, centroid.y - screen.y).toFixed(1)) : null,
      });
      if (t === 0 || t === 2.1) await page.screenshot({ path: `${out}/D-${id}-t${t}-${vp}.png`, clip: { x: Math.max(0, screen.x - 140), y: Math.max(0, screen.y - 110), width: 280, height: 220 } });
    }
  }
  report.checks.D_alignment = D;
  await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.motion.freezeAt(null));

  // ---- E: memória e alocações durante 6 s de movimento.
  await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.motion.resume());
  await seek(page, 0.745, 800);
  const E = [];
  for (let i = 0; i < 4; i += 1) {
    await page.waitForTimeout(1500);
    E.push(
      await page.evaluate(() => {
        const h = window.__MICROCOSMOS_CINEMATIC__;
        const m = h.getMetrics();
        return {
          geometries: m.geometries,
          textures: m.textures,
          calls: m.calls,
          triangles: m.triangles,
          heapMB: performance.memory ? Number((performance.memory.usedJSHeapSize / 1048576).toFixed(1)) : null,
          motionFrames: h.motion.diagnostics().motionFrames,
        };
      }),
    );
  }
  report.checks.E_memory = E;

  report.errors = errors;
  await context.close();
}

// ---- F: movimento reduzido e WebGL indisponível.
{
  const { context, page, errors } = await openJourney(browser, { ...VIEWPORTS[vp], reducedMotion: true });
  await page.waitForTimeout(800);
  report.checks.F_reducedMotion = await page.evaluate(() => ({
    canvases: document.querySelectorAll("canvas").length,
    staticView: Boolean(document.querySelector("[data-static-view]")),
    debugHandle: Boolean(window.__MICROCOSMOS_CINEMATIC__),
    destinations: document.querySelectorAll('a[href="/atlas"], a[href="/laboratorio"], a[href="/onde-vivem"]').length,
    motionButtonsVisible: [...document.querySelectorAll("button")].filter((b) => /Pausar movimento|Retomar movimento/.test(b.textContent ?? "") && b.getClientRects().length > 0 && getComputedStyle(b).visibility !== "hidden").length,
  }));
  await page.screenshot({ path: `${out}/F-reduced-${vp}.png` });
  report.checks.F_reducedMotion.errors = errors;
  await context.close();
}
{
  const context = await browser.newContext({ viewport: VIEWPORTS[vp] });
  await context.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") return null;
      return original.call(this, type, ...rest);
    };
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${process.env.QA_BASE_URL ?? "http://localhost:3000"}/explorar`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(1500);
  report.checks.F_noWebGL = await page.evaluate(() => ({
    staticView: Boolean(document.querySelector("[data-static-view]")) && getComputedStyle(document.querySelector("[data-static-view]")).display !== "none",
    canvases: document.querySelectorAll("canvas").length,
    destinations: document.querySelectorAll('a[href="/atlas"], a[href="/laboratorio"], a[href="/onde-vivem"]').length,
  }));
  report.checks.F_noWebGL.errors = errors;
  await page.screenshot({ path: `${out}/F-nowebgl-${vp}.png` });
  await context.close();
}

await writeFile(`${out}/contract-${vp}.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report.checks, null, 1).slice(0, 6000));
await browser.close();
