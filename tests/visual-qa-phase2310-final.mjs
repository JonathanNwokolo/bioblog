/** Pass B: evidência final do Living Slide em navegador Chromium real (GL por software). */
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { EVIDENCE, VIEWPORTS, ensureDir, launch, openJourney, seek } from "./qa2310-lib.mjs";

const out = await ensureDir(`${EVIDENCE}/final-pass-b`);
const browser = await launch();
const report = { viewports: {}, interactions: {}, regression: {}, performance: {} };
const midpoints = { giardia: 0.45, "t-cruzi": 0.63, trichuris: 0.82 };
const chapterFrames = [
  ["giardia-environment", 0.36], ["giardia-first-reveal", 0.39], ["giardia-full", 0.42],
  ["giardia-contemplation", 0.45], ["giardia-departure", 0.505], ["transition-to-blood", 0.54],
  ["blood-begins", 0.56], ["t-cruzi-first-reveal", 0.57], ["t-cruzi-full", 0.60],
  ["t-cruzi-contemplation", 0.63], ["t-cruzi-departure", 0.695], ["transition-to-stool", 0.73],
  ["stool-begins", 0.75], ["trichuris-first-reveal", 0.765], ["trichuris-full", 0.79],
  ["trichuris-contemplation", 0.82], ["trichuris-departure", 0.885], ["empty-before-discovery", 0.915],
  ["discovery", 0.975],
];

for (const viewport of Object.keys(VIEWPORTS)) {
  const { context, page, errors } = await openJourney(browser, VIEWPORTS[viewport]);
  const states = [];
  for (const [name, progress] of chapterFrames) {
    await seek(page, progress, 260);
    const state = await page.evaluate(() => ({
      progress: window.__MICROCOSMOS_CINEMATIC__.getProgress(),
      stage: window.__MICROCOSMOS_CINEMATIC__.getStageId(),
      optical: window.__MICROCOSMOS_CINEMATIC__.getOptical(),
      screen: window.__MICROCOSMOS_CINEMATIC__.screen(),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    states.push({ name, requested: progress, ...state });
    if (viewport === "1440" || ((viewport === "390" || viewport === "320") && Object.values(midpoints).includes(progress))) {
      await page.screenshot({ path: `${out}/${name}-${viewport}.png` });
    }
  }
  report.viewports[viewport] = { errors, states };
  await context.close();
}

// Campos vazios finais e comparação lado a lado.
const emptyPaths = [];
{
  const { context, page, errors } = await openJourney(browser, { ...VIEWPORTS["1440"], query: "debug=specimen" });
  for (const [name, progress] of Object.entries(midpoints)) {
    await seek(page, progress);
    const path = `${out}/${name}-empty-1440.png`;
    await page.screenshot({ path });
    emptyPaths.push(path);
  }
  report.regression.specimenDebugErrors = errors;
  await context.close();
}
const panels = await Promise.all(emptyPaths.map((path) => sharp(path).resize(720, 450, { fit: "cover" }).toBuffer()));
await sharp({ create: { width: 2160, height: 450, channels: 4, background: "#080c0b" } })
  .composite(panels.map((input, index) => ({ input, left: index * 720, top: 0 })))
  .webp({ quality: 92 })
  .toFile(`${out}/three-worlds-empty-side-by-side.webp`);

// Interações: um contexto por hotspot evita que foco/restauração de um painel
// contamine a medição do capítulo seguinte.
const interactionBrowser = await launch();
for (const [id, progress] of Object.entries(midpoints)) {
  const { context, page, errors } = await openJourney(interactionBrowser, VIEWPORTS["1440"]);
    await seek(page, progress);
    const marker = page.locator(`[data-parasite-id="${id}"]`);
    await marker.focus();
    const before = await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.getProgress());
    await marker.click();
    await page.locator('[role="dialog"]').waitFor({ state: "visible" });
    await page.screenshot({ path: `${out}/${id}-hotspot-panel-1440.png` });
    await page.keyboard.press("Escape");
    await page.locator('[role="dialog"]').waitFor({ state: "detached" });
    await page.waitForFunction(
      (expected) => Math.abs(window.__MICROCOSMOS_CINEMATIC__.getProgress() - expected) < 0.00012,
      before,
      { timeout: 5_000 },
    );
    const after = await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.getProgress());
    report.interactions[id] = { before, after, delta: Math.abs(after - before), focusReturned: await marker.evaluate((node) => node === document.activeElement), errors };
    await context.close();
}

// Pausa e retomada em sessão própria.
{
  const { context, page, errors } = await openJourney(interactionBrowser, VIEWPORTS["1440"]);
  await seek(page, 0.45);
  await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.motion.pause());
  const pausedA = await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.motion.diagnostics());
  await page.waitForTimeout(900);
  const pausedB = await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.motion.diagnostics());
  await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.motion.resume());
  await page.waitForTimeout(450);
  const resumed = await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.motion.diagnostics());
  report.interactions.motion = { pausedA, pausedB, resumed };
  report.interactions.motionErrors = errors;
  await context.close();
}
await interactionBrowser.close();

// Reversibilidade por pixels com relógio local congelado (sessão isolada).
{
  const { context, page, errors } = await openJourney(browser, VIEWPORTS["1440"]);
  await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.motion.freezeAt(1.25));
  await seek(page, 0.45);
  const a = await page.screenshot();
  await seek(page, 0.82);
  await seek(page, 0.45);
  const b = await page.screenshot();
  report.regression.reversePixelIdentical = Buffer.compare(a, b) === 0;
  report.regression.reverseErrors = errors;
  await context.close();
}

// Repouso entre capítulos: nenhuma renderização contínua (sessão isolada).
{
  const { context, page, errors } = await openJourney(browser, VIEWPORTS["1440"]);
  await seek(page, 0.54);
  const idleA = await page.evaluate(() => ({ renders: window.__MICROCOSMOS_CINEMATIC__.getRenderCount(), motion: window.__MICROCOSMOS_CINEMATIC__.motion.diagnostics() }));
  await page.waitForTimeout(1200);
  const idleB = await page.evaluate(() => ({ renders: window.__MICROCOSMOS_CINEMATIC__.getRenderCount(), motion: window.__MICROCOSMOS_CINEMATIC__.motion.diagnostics() }));
  report.performance.idle = { before: idleA, after: idleB };
  report.performance.frames = {};
  for (const [id, progress] of Object.entries(midpoints)) {
    await seek(page, progress);
    report.performance.frames[id] = await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.getMetrics());
  }
  report.performance.errors = errors;
  await context.close();
}

// Reduced motion.
{
  const { context, page, errors } = await openJourney(browser, { ...VIEWPORTS["390"], reducedMotion: true });
  report.regression.reducedMotion = await page.evaluate(() => ({
    canvas: document.querySelectorAll("canvas").length,
    staticVisible: getComputedStyle(document.querySelector("[data-static-view]")).display !== "none",
    preparations: document.querySelectorAll("[data-static-view] ol li").length,
  }));
  report.regression.reducedMotion.errors = errors;
  await page.screenshot({ path: `${out}/reduced-motion-390.png`, fullPage: true });
  await context.close();
}

// WebGL indisponível.
{
  const context = await browser.newContext({ viewport: VIEWPORTS["390"] });
  await context.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      if (String(kind).startsWith("webgl")) return null;
      return original.call(this, kind, ...args);
    };
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${process.env.QA_BASE_URL ?? "http://localhost:3000"}/explorar`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => getComputedStyle(document.querySelector("[data-static-view]")).display !== "none");
  report.regression.noWebgl = await page.evaluate(() => ({
    canvas: document.querySelectorAll("canvas").length,
    preparations: document.querySelectorAll("[data-static-view] ol li").length,
  }));
  report.regression.noWebgl.errors = errors;
  await page.screenshot({ path: `${out}/no-webgl-390.png`, fullPage: true });
  await context.close();
}

// A imagem final side-by-side deve ser legível e não vazia.
report.regression.sideBySideBytes = (await readFile(`${out}/three-worlds-empty-side-by-side.webp`)).byteLength;
await writeFile(`${out}/final.json`, JSON.stringify(report, null, 2));
await browser.close();
console.log("phase2310 final pass B ok");
