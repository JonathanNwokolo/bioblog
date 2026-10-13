/**
 * Biblioteca de QA da Fase 2.3.9 (movimento científico dos organismos).
 * Playwright + Chromium com GL por software (SwiftShader). Não representa GPU física.
 */
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
export const { chromium } = require("playwright");

export const BASE = process.env.QA_BASE_URL ?? "http://localhost:3000";
export const EVIDENCE = "docs/evidence/phase23/round-9-scientific-motion";

export const VIEWPORTS = {
  1440: { width: 1440, height: 900 },
  1280: { width: 1280, height: 800 },
  768: { width: 768, height: 1024 },
  390: { width: 390, height: 844 },
  320: { width: 320, height: 568 },
};

export async function launch() {
  return chromium.launch({
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
  });
}

export async function openJourney(browser, { width = 1440, height = 900, reducedMotion = false, quality = "high", query = "", recordVideo } = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    reducedMotion: reducedMotion ? "reduce" : "no-preference",
    ...(recordVideo ? { recordVideo: { dir: recordVideo, size: { width, height } } } : {}),
  });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.setDefaultTimeout(120_000);
  await page.goto(`${BASE}/explorar?quality=${quality}${query}`, { waitUntil: "networkidle", timeout: 180_000 });
  if (!reducedMotion) {
    await page.waitForFunction(() => window.__MICROCOSMOS_CINEMATIC__?.getRenderCount() > 0, null, { timeout: 120_000 });
  }
  return { context, page, errors };
}

export async function seek(page, progress, settle = 400) {
  const g = await page.evaluate(() => {
    const track = document.querySelector("section[data-explorar-journey]");
    const stage = track.firstElementChild;
    return { top: track.getBoundingClientRect().top + window.scrollY, travel: track.offsetHeight - stage.clientHeight };
  });
  await page.evaluate(({ top, travel, progress }) => window.scrollTo({ top: top + travel * progress, behavior: "instant" }), { ...g, progress });
  await page.waitForFunction((t) => Math.abs(window.__MICROCOSMOS_CINEMATIC__.getProgress() - t) < 0.003, progress, { timeout: 120_000 });
  await page.waitForTimeout(settle);
}

export async function ensureDir(path) {
  await mkdir(path, { recursive: true });
  return path;
}
