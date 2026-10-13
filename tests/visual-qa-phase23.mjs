/**
 * OBSOLETO (Fase 2.3.2). Este script validava a linha do tempo de 14,5 s da Fase 2.3.1
 * (`seek`, "Iniciar travessia", Pausar/Retomar/Pular/Rever). Esses controles e a API de
 * seek deixaram de existir: a rolagem real é a fonte de verdade.
 * Use `tests/visual-qa-phase23-scroll.mjs`. Mantido apenas como registro da Rodada 2.
 */
console.error("tests/visual-qa-phase23.mjs está obsoleto; use tests/visual-qa-phase23-scroll.mjs");
process.exit(1);

import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const BASE_URL = process.env.PHASE23_BASE_URL ?? "http://localhost:3000";
const OUTPUT = "docs/evidence/phase23/round-2";
const VIEWPORTS = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "desktop-1280", width: 1280, height: 800 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-320", width: 320, height: 568 },
];
const STAGES = [
  { name: "01-invitation", progress: 0 },
  { name: "02-approach", progress: 0.27 },
  { name: "03-optical-traversal", progress: 0.46 },
  { name: "04-microscopic-reveal", progress: 0.78 },
  { name: "05-discovery", progress: 1 },
];

async function waitForExperience(page) {
  await page.goto(`${BASE_URL}/explorar`, { waitUntil: "domcontentloaded" });
  await page.locator("canvas").waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(() => Boolean(window.__MICROCOSMOS_CINEMATIC__), null, { timeout: 15_000 });
}

async function seek(page, progress) {
  await page.evaluate((value) => window.__MICROCOSMOS_CINEMATIC__?.seek(value), progress);
  await page.waitForTimeout(950);
}

async function run() {
  await mkdir(OUTPUT, { recursive: true });
  const browser = await chromium.launch({
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  let transferredBytes = 0;
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    const length = Number(response.headers()["content-length"] ?? 0);
    if (Number.isFinite(length)) transferredBytes += length;
  });

  await waitForExperience(page);
  for (const stage of STAGES) {
    if (stage.progress > 0) await seek(page, stage.progress);
    await page.screenshot({ path: `${OUTPUT}/stage-${stage.name}-1440.png` });
  }

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.__MICROCOSMOS_CINEMATIC__), null, { timeout: 15_000 });
  await page.getByRole("button", { name: "Iniciar travessia" }).click();
  await page.waitForTimeout(2_000);
  await page.getByRole("button", { name: "Pausar" }).click();
  const pausedVisible = await page.getByRole("button", { name: "Retomar" }).isVisible();
  await page.screenshot({ path: `${OUTPUT}/interaction-paused-1440.png` });
  await page.getByRole("button", { name: "Retomar" }).click();
  await page.waitForTimeout(2_200);
  const metrics = await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__?.getMetrics());
  await page.getByRole("button", { name: "Pular" }).click();
  const discoveryLinks = await page.locator("main a[href]").evaluateAll((links) =>
    links.map((link) => link.getAttribute("href")),
  );
  await page.getByRole("button", { name: "Rever jornada" }).click();
  const replayState = await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__?.getState());

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`${BASE_URL}/explorar`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(window.__MICROCOSMOS_CINEMATIC__), null, { timeout: 15_000 });
    await page.screenshot({ path: `${OUTPUT}/responsive-invitation-${viewport.name}.png` });
    await seek(page, 1);
    await page.screenshot({ path: `${OUTPUT}/responsive-discovery-${viewport.name}.png` });
  }

  const reducedContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const reducedPage = await reducedContext.newPage();
  await reducedPage.goto(`${BASE_URL}/explorar`, { waitUntil: "domcontentloaded" });
  await reducedPage.getByText("Movimento reduzido").waitFor({ state: "attached", timeout: 15_000 });
  await reducedPage.waitForTimeout(950);
  const reducedLinks = await reducedPage.locator("main a[href]").evaluateAll((links) =>
    links.map((link) => link.getAttribute("href")),
  );
  await reducedPage.screenshot({ path: `${OUTPUT}/fallback-reduced-motion-390.png` });
  await reducedContext.close();

  const fallbackContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await fallbackContext.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function patched(type, ...args) {
      if (String(type).startsWith("webgl")) return null;
      return original.call(this, type, ...args);
    };
  });
  const fallbackPage = await fallbackContext.newPage();
  await fallbackPage.goto(`${BASE_URL}/explorar`, { waitUntil: "domcontentloaded" });
  await fallbackPage.getByText("Modo estático").waitFor({ state: "visible", timeout: 15_000 });
  await fallbackPage.waitForTimeout(950);
  await fallbackPage.screenshot({ path: `${OUTPUT}/fallback-no-webgl-1440.png` });
  const fallbackLinks = await fallbackPage.locator("main a[href]").count();
  await fallbackContext.close();

  const report = {
    capturedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    runtime: "Chromium headless with ANGLE/SwiftShader; not physical-device evidence",
    viewportChecks: VIEWPORTS,
    interaction: {
      pausedVisible,
      replayState,
      discoveryLinks,
    },
    accessibility: {
      reducedMotionLinks: reducedLinks,
      noWebglLinkCount: fallbackLinks,
    },
    performance: {
      ...metrics,
      observedResponseContentLengthBytes: transferredBytes,
      note: "Frame data reflects headless software rendering and must not be presented as physical GPU performance.",
    },
    consoleErrors,
    pageErrors,
  };
  await writeFile(`${OUTPUT}/qa-metrics.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await context.close();
  await browser.close();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
