/** Evidência visual e funcional da Fase 2.3.11 em Chromium real. */
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { EVIDENCE, VIEWPORTS, ensureDir, launch, openJourney, seek } from "./qa2311-lib.mjs";

const chapters = {
  giardia: {
    folder: "giardia",
    frames: [0.252, 0.276, 0.298, 0.312, 0.337, 0.370, 0.425, 0.463],
  },
  "t-cruzi": {
    folder: "tcruzi",
    frames: [0.610, 0.622, 0.634, 0.643, 0.660, 0.680, 0.724, 0.742],
  },
  trichuris: {
    folder: "trichuris-pilot",
    frames: [0.755, 0.780, 0.800, 0.812, 0.835, 0.858, 0.902, 0.938],
  },
};
const labels = ["01-field", "02-exploration", "03-first-hint", "04-partial", "05-full", "06-inspection", "07-departure", "08-post-discovery"];
const browser = await launch();
const report = { sequences: {}, fieldOnly: {}, viewports: {}, regression: {}, performance: {} };

for (const [chapter, config] of Object.entries(chapters)) {
  const out = await ensureDir(`${EVIDENCE}/${config.folder}`);
  const { context, page, errors } = await openJourney(browser, VIEWPORTS[1440]);
  report.sequences[chapter] = { errors, frames: [] };
  const sequencePaths = [];
  for (let index = 0; index < config.frames.length; index += 1) {
    const progress = config.frames[index];
    await seek(page, progress);
    const state = await page.evaluate(() => ({
      progress: window.__MICROCOSMOS_CINEMATIC__.getProgress(),
      stage: window.__MICROCOSMOS_CINEMATIC__.getStageId(),
      optical: window.__MICROCOSMOS_CINEMATIC__.getOptical(),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    const framePath = `${out}/${labels[index]}-1440.png`;
    await page.screenshot({ path: framePath });
    sequencePaths.push(framePath);
    report.sequences[chapter].frames.push({ label: labels[index], requested: progress, ...state });
  }
  const sequencePanels = await Promise.all(sequencePaths.map((path) => sharp(path).resize(480, 300, { fit: "cover" }).toBuffer()));
  await sharp({ create: { width: 1920, height: 600, channels: 4, background: "#080c0b" } })
    .composite(sequencePanels.map((input, index) => ({ input, left: (index % 4) * 480, top: Math.floor(index / 4) * 300 })))
    .webp({ quality: 90 })
    .toFile(`${out}/discovery-sequence.webp`);
  await context.close();
}

const emptyPaths = [];
for (const [chapter, config] of Object.entries(chapters)) {
  const { context, page, errors } = await openJourney(browser, {
    ...VIEWPORTS[1440],
    query: `debug=specimen&chapter=${chapter}&subject=off`,
  });
  await seek(page, config.frames[5], 120);
  const path = `${EVIDENCE}/${config.folder}/field-only-1440.png`;
  await page.screenshot({ path });
  emptyPaths.push({ chapter, path });
  report.fieldOnly[chapter] = await page.evaluate(() => ({
    progress: window.__MICROCOSMOS_CINEMATIC__.getProgress(),
    optical: window.__MICROCOSMOS_CINEMATIC__.getOptical(),
    canvas: document.querySelector("canvas")?.getBoundingClientRect().toJSON(),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  report.fieldOnly[chapter].errors = errors;
  await context.close();
}

const sideBySide = await ensureDir(`${EVIDENCE}/side-by-side`);
const panels = await Promise.all(emptyPaths.map(({ path }) => sharp(path).resize(720, 450, { fit: "cover" }).toBuffer()));
await sharp({ create: { width: 2160, height: 450, channels: 4, background: "#080c0b" } })
  .composite(panels.map((input, index) => ({ input, left: index * 720, top: 0 })))
  .webp({ quality: 92 })
  .toFile(`${sideBySide}/three-preparations-field-only.webp`);

const mobileOut = await ensureDir(`${EVIDENCE}/mobile`);
for (const viewport of [390, 320]) {
  const dimensions = VIEWPORTS[viewport];
  const { context, page, errors } = await openJourney(browser, dimensions);
  report.viewports[viewport] = { errors, frames: [] };
  for (const [chapter, config] of Object.entries(chapters)) {
    const progress = config.frames[5];
    await seek(page, progress);
    await page.screenshot({ path: `${mobileOut}/${chapter}-inspection-${viewport}.png` });
    report.viewports[viewport].frames.push({ chapter, progress });
  }
  await context.close();
}

for (const viewport of [1280, 768]) {
  const { context, page, errors } = await openJourney(browser, VIEWPORTS[viewport]);
  const measurements = [];
  for (const { frames } of Object.values(chapters)) {
    await seek(page, frames[5], 180);
    measurements.push(await page.evaluate(() => ({
      progress: window.__MICROCOSMOS_CINEMATIC__.getProgress(),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      metrics: window.__MICROCOSMOS_CINEMATIC__.getMetrics(),
    })));
  }
  report.viewports[viewport] = { errors, frames: measurements };
  await context.close();
}

{
  const { context, page, errors } = await openJourney(browser, VIEWPORTS[1440]);
  await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.motion.freezeAt(1.25));
  await seek(page, 0.858);
  const direct = await page.screenshot();
  await seek(page, 0.37);
  await seek(page, 0.858);
  const reverse = await page.screenshot();
  report.regression.reversePixelIdentical = Buffer.compare(direct, reverse) === 0;
  report.regression.reverseErrors = errors;

  await seek(page, 0.707);
  const idleA = await page.evaluate(() => ({ renders: window.__MICROCOSMOS_CINEMATIC__.getRenderCount(), motion: window.__MICROCOSMOS_CINEMATIC__.motion.diagnostics() }));
  await page.waitForTimeout(1100);
  const idleB = await page.evaluate(() => ({ renders: window.__MICROCOSMOS_CINEMATIC__.getRenderCount(), motion: window.__MICROCOSMOS_CINEMATIC__.motion.diagnostics() }));
  report.performance.idle = { before: idleA, after: idleB };
  report.performance.metrics = await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.getMetrics());
  await context.close();
}

{
  const { context, page, errors } = await openJourney(browser, { ...VIEWPORTS[390], reducedMotion: true });
  report.regression.reducedMotion = await page.evaluate(() => ({
    canvas: document.querySelectorAll("canvas").length,
    staticVisible: getComputedStyle(document.querySelector("[data-static-view]")).display !== "none",
  }));
  report.regression.reducedMotion.errors = errors;
  await page.screenshot({ path: `${mobileOut}/reduced-motion-390.png`, fullPage: true });
  await context.close();
}

{
  const context = await browser.newContext({ viewport: VIEWPORTS[390] });
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
  report.regression.noWebgl = { canvas: await page.locator("canvas").count(), errors };
  await page.screenshot({ path: `${mobileOut}/no-webgl-390.png`, fullPage: true });
  await context.close();
}

report.regression.sideBySideBytes = (await readFile(`${sideBySide}/three-preparations-field-only.webp`)).byteLength;
const debugOut = await ensureDir(`${EVIDENCE}/debug`);
await writeFile(`${debugOut}/browser-qa.json`, JSON.stringify(report, null, 2));
await browser.close();
console.log("phase2311 visual QA ok");
