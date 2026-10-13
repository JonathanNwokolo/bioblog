/** Biblioteca de QA da Fase 2.3.10 — mundos de preparação e ritmo por capítulos. */
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
export const { chromium } = require("playwright");

export const BASE = process.env.QA_BASE_URL ?? "http://localhost:3000";
export const EVIDENCE = "docs/evidence/phase23/round-10-living-slide";

export const VIEWPORTS = {
  1440: { width: 1440, height: 900 },
  1280: { width: 1280, height: 800 },
  768: { width: 768, height: 1024 },
  390: { width: 390, height: 844 },
  320: { width: 320, height: 700 },
};

export async function launch() {
  return chromium.launch({
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
  });
}

export async function openJourney(browser, {
  width = 1440,
  height = 900,
  reducedMotion = false,
  quality = "high",
  query = "",
  recordVideo,
} = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    reducedMotion: reducedMotion ? "reduce" : "no-preference",
    ...(recordVideo ? { recordVideo: { dir: recordVideo, size: { width, height } } } : {}),
  });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.setDefaultTimeout(120_000);
  const separator = query ? "&" : "";
  await page.goto(`${BASE}/explorar?quality=${quality}${separator}${query}`, {
    waitUntil: "networkidle",
    timeout: 180_000,
  });
  if (!reducedMotion) {
    await page.waitForFunction(() => window.__MICROCOSMOS_CINEMATIC__?.getRenderCount() > 0, null, { timeout: 120_000 });
  }
  return { context, page, errors };
}

export async function seek(page, progress, settle = 450) {
  const geometry = await page.evaluate(() => {
    const track = document.querySelector("section[data-explorar-journey]");
    const stage = track.firstElementChild;
    return {
      top: track.getBoundingClientRect().top + window.scrollY,
      travel: track.offsetHeight - stage.clientHeight,
    };
  });
  await page.evaluate(
    ({ top, travel, progress }) => window.scrollTo({ top: top + travel * progress, behavior: "instant" }),
    { ...geometry, progress },
  );
  await page.waitForFunction(
    (target) => Math.abs(window.__MICROCOSMOS_CINEMATIC__.getProgress() - target) < 0.003,
    progress,
    { timeout: 120_000 },
  );
  await page.waitForTimeout(settle);
}

export async function ensureDir(path) {
  await mkdir(path, { recursive: true });
  return path;
}
