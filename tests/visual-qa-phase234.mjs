/** Evidência visual e de interação da Fase 2.3.4. */
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const BASE = process.env.PHASE234_BASE_URL ?? "http://127.0.0.1:3104";
const OUT = "docs/evidence/phase23/round-6-optical-morphology";
const hash = (buffer) => createHash("sha256").update(buffer).digest("hex").slice(0, 16);

async function open(context, suffix = "?quality=high") {
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(`${BASE}/explorar${suffix}`, { waitUntil: "networkidle", timeout: 120_000 });
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
  await page.evaluate(({ top, travel, progress }) => window.scrollTo({ top: top + travel * progress, behavior: "instant" }), {
    ...geometry,
    progress,
  });
  await page.waitForFunction(
    (target) => Math.abs(window.__MICROCOSMOS_CINEMATIC__.getProgress() - target) < 0.003,
    progress,
    { timeout: 90_000 },
  );
  await page.waitForTimeout(420);
}

async function captureJourney(browser, viewport, label, points) {
  const context = await browser.newContext({ viewport });
  const { page, consoleErrors, pageErrors } = await open(context);
  page.setDefaultTimeout(90_000);
  const captures = [];
  for (const [name, progress] of points) {
    await seek(page, progress);
    const path = `${OUT}/${label}-${name}.png`;
    const bytes = await page.screenshot({ path, timeout: 90_000 });
    const frameMetrics = await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.getMetrics());
    captures.push({ name, progress, path, hash: hash(bytes), frameMetrics });
  }
  const metrics = await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.getMetrics());
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  await context.close();
  return { viewport, captures, metrics, overflow, consoleErrors, pageErrors };
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});

try {
  const desktop = await captureJourney(browser, { width: 1440, height: 900 }, "desktop", [
    ["opening", 0],
    ["objective", 0.2],
    ["objective-macro", 0.3],
    ["optical-transition", 0.4],
    ["microworld-entry", 0.56],
    ["giardia", 0.62],
    ["t-cruzi", 0.72],
    ["trichuris", 0.83],
    ["discovery", 0.94],
  ]);
  const mobile = await captureJourney(browser, { width: 390, height: 844 }, "mobile", [
    ["opening", 0],
    ["giardia", 0.62],
    ["discovery", 0.94],
  ]);
  const tablet = await captureJourney(browser, { width: 768, height: 1024 }, "tablet", [
    ["opening", 0],
    ["giardia", 0.62],
    ["discovery", 0.94],
  ]);

  const interactionContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const { page: interactionPage, consoleErrors, pageErrors } = await open(interactionContext);
  await seek(interactionPage, 0.62);
  const beforeOpen = await interactionPage.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.getProgress());
  await interactionPage.locator('[data-parasite-id="giardia"]').click();
  await interactionPage.waitForTimeout(300);
  await interactionPage.screenshot({ path: `${OUT}/desktop-giardia-panel.png`, timeout: 90_000 });
  await interactionPage.mouse.wheel(0, 1300);
  await interactionPage.waitForTimeout(250);
  const whileOpen = await interactionPage.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.getProgress());
  await interactionPage.keyboard.press("Escape");
  await interactionPage.waitForTimeout(250);
  const afterClose = await interactionPage.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.getProgress());
  const focusedAfterClose = await interactionPage.evaluate(() => document.activeElement?.getAttribute("data-parasite-id"));
  const panelContract = {
    beforeOpen,
    whileOpen,
    afterClose,
    preserved: Math.abs(beforeOpen - whileOpen) < 0.001 && Math.abs(beforeOpen - afterClose) < 0.003,
    escapeClosed: await interactionPage.locator('[role="dialog"]').count() === 0,
    focusReturnedTo: focusedAfterClose,
    consoleErrors,
    pageErrors,
  };
  await interactionContext.close();

  const mobilePanelContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const { page: mobilePanelPage, consoleErrors: mobilePanelConsoleErrors, pageErrors: mobilePanelPageErrors } = await open(mobilePanelContext);
  await seek(mobilePanelPage, 0.62);
  await mobilePanelPage.locator('[data-parasite-id="giardia"]').click();
  await mobilePanelPage.waitForTimeout(300);
  await mobilePanelPage.screenshot({ path: `${OUT}/mobile-giardia-panel.png`, timeout: 90_000 });
  const mobilePanel = await mobilePanelPage.evaluate(() => ({
    dialogVisible: document.querySelector('[role="dialog"]') !== null,
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    panelOverflow: (() => {
      const dialog = document.querySelector('[role="dialog"]');
      return dialog ? dialog.scrollWidth > dialog.clientWidth : null;
    })(),
  }));
  mobilePanel.consoleErrors = mobilePanelConsoleErrors;
  mobilePanel.pageErrors = mobilePanelPageErrors;
  await mobilePanelContext.close();

  const reverseContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const { page: reversePage } = await open(reverseContext);
  await seek(reversePage, 0.62);
  const direct = hash(await reversePage.screenshot({ timeout: 90_000 }));
  await seek(reversePage, 0.94);
  await seek(reversePage, 0.62);
  const reverse = hash(await reversePage.screenshot({ timeout: 90_000 }));
  await reverseContext.close();

  const reducedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const reducedPage = await reducedContext.newPage();
  await reducedPage.goto(`${BASE}/explorar`, { waitUntil: "networkidle", timeout: 120_000 });
  await reducedPage.screenshot({ path: `${OUT}/fallback-reduced-motion-390.png`, timeout: 90_000 });
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
  await fallbackPage.screenshot({ path: `${OUT}/fallback-no-webgl-1440.png`, timeout: 90_000 });
  const noWebgl = await fallbackPage.evaluate(() => ({
    canvases: document.querySelectorAll("canvas").length,
    destinations: [...document.querySelectorAll("[data-static-view] a")].filter((link) =>
      ["/atlas", "/laboratorio", "/onde-vivem"].includes(new URL(link.href).pathname),
    ).length,
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }));
  await fallbackContext.close();

  const regressionContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const routeRegression = [];
  for (const path of ["/", "/atlas", "/laboratorio", "/onde-vivem", "/diario", "/admin/login"]) {
    const page = await regressionContext.newPage();
    const routeConsoleErrors = [];
    const routePageErrors = [];
    page.on("console", (message) => { if (message.type() === "error") routeConsoleErrors.push(message.text()); });
    page.on("pageerror", (error) => routePageErrors.push(error.message));
    const response = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 120_000 });
    routeRegression.push({
      path,
      status: response?.status() ?? null,
      horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
      consoleErrors: routeConsoleErrors,
      pageErrors: routePageErrors,
    });
    await page.close();
  }
  await regressionContext.close();

  await writeFile(`${OUT}/qa-metrics.json`, JSON.stringify({
    capturedAt: new Date().toISOString(),
    runtime: "Chromium headless with ANGLE/SwiftShader; CPU timing is not physical-device GPU evidence",
    desktop,
    tablet,
    mobile,
    panelContract,
    mobilePanel,
    reducedMotion,
    noWebgl,
    routeRegression,
    reversibility: { progress: 0.62, direct, reverse, sameImage: direct === reverse },
  }, null, 2));
} finally {
  await browser.close();
}
