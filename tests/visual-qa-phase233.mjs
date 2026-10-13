/** Evidência visual isolada da Fase 2.3.3. Executar contra `next start -p 3100`. */
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const BASE = process.env.PHASE23_BASE_URL ?? "http://localhost:3100";
const OUT = "docs/evidence/phase23/round-4-morphology";
const hash = (buffer) => createHash("sha256").update(buffer).digest("hex").slice(0, 16);

async function open(context) {
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(`${BASE}/explorar?quality=high`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForFunction(() => window.__MICROCOSMOS_CINEMATIC__?.getRenderCount() > 0, null, { timeout: 90_000 });
  return { page, consoleErrors, pageErrors };
}

async function seek(page, progress) {
  const geometry = await page.evaluate(() => {
    const track = document.querySelector("section[data-explorar-journey]");
    const stage = track.firstElementChild;
    return {
      top: track.getBoundingClientRect().top + window.scrollY,
      travel: track.offsetHeight - stage.clientHeight,
    };
  });
  await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), geometry.top + geometry.travel * progress);
  await page.waitForFunction(
    (target) => Math.abs(window.__MICROCOSMOS_CINEMATIC__.getProgress() - target) < 0.002,
    progress,
    { timeout: 90_000 },
  );
  await page.waitForTimeout(900);
}

async function captureViewport(browser, viewport, label, points) {
  const context = await browser.newContext({ viewport });
  const { page, consoleErrors, pageErrors } = await open(context);
  const captures = [];
  for (const progress of points) {
    await seek(page, progress);
    const slug = String(Math.round(progress * 100)).padStart(3, "0");
    const path = `${OUT}/${label}-${slug}.png`;
    const bytes = await page.screenshot({ path });
    captures.push({ progress, path, hash: hash(bytes) });
  }
  const metrics = await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.getMetrics());
  await context.close();
  return { viewport, captures, metrics, consoleErrors, pageErrors };
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});
try {
  const desktop = await captureViewport(browser, { width: 1440, height: 900 }, "desktop", [0, 0.35, 0.65, 0.82, 1]);
  const mobile = await captureViewport(browser, { width: 390, height: 844 }, "mobile", [0, 0.65, 1]);
  const reducedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const reducedPage = await reducedContext.newPage();
  await reducedPage.goto(`${BASE}/explorar`, { waitUntil: "networkidle", timeout: 120_000 });
  await reducedPage.screenshot({ path: `${OUT}/fallback-reduced-motion-390.png` });
  const reducedMotion = await reducedPage.evaluate(() => ({
    canvases: document.querySelectorAll("canvas").length,
    destinations: [...document.querySelectorAll("[data-static-view] a")].filter((link) =>
      ["/atlas", "/laboratorio", "/onde-vivem"].includes(new URL(link.href).pathname),
    ).length,
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }));
  await reducedContext.close();

  const fallbackContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await fallbackContext.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function getContext(type, ...args) {
      if (type === "webgl" || type === "webgl2") return null;
      return original.call(this, type, ...args);
    };
  });
  const fallbackPage = await fallbackContext.newPage();
  await fallbackPage.goto(`${BASE}/explorar`, { waitUntil: "networkidle", timeout: 120_000 });
  await fallbackPage.waitForFunction(() => getComputedStyle(document.querySelector("[data-static-view]")).display !== "none");
  await fallbackPage.screenshot({ path: `${OUT}/fallback-no-webgl-1440.png` });
  const noWebgl = await fallbackPage.evaluate(() => ({
    canvases: document.querySelectorAll("canvas").length,
    destinations: [...document.querySelectorAll("[data-static-view] a")].filter((link) =>
      ["/atlas", "/laboratorio", "/onde-vivem"].includes(new URL(link.href).pathname),
    ).length,
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }));
  await fallbackContext.close();

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const { page } = await open(context);
  await seek(page, 0.65);
  const direct = hash(await page.screenshot());
  await seek(page, 1);
  await seek(page, 0.65);
  const reverse = hash(await page.screenshot());
  await context.close();

  const homeContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const homePage = await homeContext.newPage();
  const scripts = [];
  homePage.on("response", (response) => {
    if (response.url().endsWith(".js") || response.url().includes("/_next/static/chunks")) scripts.push(response.url());
  });
  await homePage.goto(BASE, { waitUntil: "networkidle", timeout: 120_000 });
  const engineChunks = [];
  for (const url of new Set(scripts)) {
    const text = await (await homeContext.request.get(url)).text();
    if (/WebGLRenderer|PMREMGenerator|RoomEnvironment/.test(text)) engineChunks.push(url);
  }
  const homepage = {
    scriptsChecked: new Set(scripts).size,
    engineChunks,
    canvases: await homePage.evaluate(() => document.querySelectorAll("canvas").length),
  };
  await homeContext.close();

  await writeFile(`${OUT}/qa-metrics.json`, JSON.stringify({
    capturedAt: new Date().toISOString(),
    runtime: "Chromium headless with ANGLE/SwiftShader; not physical-device evidence",
    desktop,
    mobile,
    reducedMotion,
    noWebgl,
    homepage,
    reversibility: { progress: 0.65, direct, reverse, sameImage: direct === reverse },
  }, null, 2));
} finally {
  await browser.close();
}
