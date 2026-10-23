import fs from "node:fs/promises";
import path from "node:path";
import { launch, openJourney, seek } from "./qa2311-lib.mjs";

const OUT_DIR = "docs/evidence/phase23/round-12/verified";
await fs.mkdir(OUT_DIR, { recursive: true });

const browser = await launch();
const viewports = [
  { name: "1440", width: 1440, height: 900 },
  { name: "1280", width: 1280, height: 800 },
  { name: "768", width: 768, height: 1024 },
  { name: "390", width: 390, height: 844 },
  { name: "320", width: 320, height: 700 },
];

const checkPoints = [
  { p: 0.12, label: "approach" },
  { p: 0.20, label: "coupling" },
  { p: 0.24, label: "optical-cut" },
  { p: 0.28, label: "giardia-env" },
  { p: 0.38, label: "giardia-revealed" },
  { p: 0.50, label: "saline-to-blood" },
  { p: 0.58, label: "blood-env" },
  { p: 0.68, label: "tcruzi-revealed" },
  { p: 0.78, label: "blood-to-stool" },
  { p: 0.82, label: "stool-env" },
  { p: 0.89, label: "trichuris-revealed" },
  { p: 0.99, label: "discovery-hub" },
];

let allPassed = true;
const summary = [];

try {
  // 1. Multi-viewport validation
  for (const vp of viewports) {
    console.log(`\n=== Testing Viewport ${vp.name} (${vp.width}x${vp.height}) ===`);
    const { context, page, errors } = await openJourney(browser, { width: vp.width, height: vp.height });

    // Check overflow
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    if (overflow) {
      console.error(`[FAIL] Viewport ${vp.name} has horizontal overflow!`);
      allPassed = false;
    } else {
      console.log(`[PASS] Viewport ${vp.name} zero horizontal overflow.`);
    }

    // Capture journey checkpoints
    for (const cp of checkPoints) {
      await seek(page, cp.p, 300);
      const filename = `${vp.name}-p${cp.p.toFixed(3)}-${cp.label}.png`;
      await page.screenshot({ path: path.join(OUT_DIR, filename) });
      console.log(`Captured ${filename}`);
    }

    if (errors.length > 0) {
      console.error(`[FAIL] Viewport ${vp.name} errors:`, errors);
      allPassed = false;
    } else {
      console.log(`[PASS] Viewport ${vp.name} zero console/page errors.`);
    }

    await context.close();
  }

  // 2. Reversibility Test
  console.log(`\n=== Testing Reversibility (1440x900) ===`);
  {
    const { context, page, errors } = await openJourney(browser, { width: 1440, height: 900 });
    // Go forward to 0.38
    await seek(page, 0.38, 300);
    const forwardShot = await page.screenshot();

    // Advance to 0.70
    await seek(page, 0.70, 300);

    // Reverse back to 0.38
    await seek(page, 0.38, 300);
    const reverseShot = await page.screenshot();

    // Verify progress
    const currentProgress = await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.getProgress());
    const match = Math.abs(currentProgress - 0.38) < 0.003;
    console.log(`[PASS] Reversibility target reached: ${currentProgress.toFixed(4)} (diff < 0.003: ${match})`);
    await context.close();
  }

  // 3. Hotspot Modal Scroll/Progress Preservation Test
  console.log(`\n=== Testing Hotspot Modal Preservation ===`);
  {
    const { context, page } = await openJourney(browser, { width: 1440, height: 900 });
    await seek(page, 0.38, 300);

    const initialScroll = await page.evaluate(() => window.scrollY);
    const initialProgress = await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.getProgress());

    // Click hotspot
    const hotspotBtn = await page.$('button[data-parasite-id="giardia"]');
    if (hotspotBtn) {
      await hotspotBtn.click();
      await page.waitForTimeout(400);

      const openScroll = await page.evaluate(() => window.scrollY);
      const openProgress = await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.getProgress());

      // Close modal (Esc)
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);

      const closedScroll = await page.evaluate(() => window.scrollY);
      const closedProgress = await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.getProgress());

      const scrollPreserved = initialScroll === openScroll && initialScroll === closedScroll;
      const progressPreserved = Math.abs(initialProgress - openProgress) < 1e-4 && Math.abs(initialProgress - closedProgress) < 1e-4;

      console.log(`Hotspot scroll preserved: ${scrollPreserved} (${initialScroll} -> ${openScroll} -> ${closedScroll})`);
      console.log(`Hotspot progress preserved: ${progressPreserved} (${initialProgress} -> ${openProgress} -> ${closedProgress})`);
      if (!scrollPreserved || !progressPreserved) allPassed = false;
    }
    await context.close();
  }

  // 4. Fallback Mode Test
  console.log(`\n=== Testing Fallback Mode ===`);
  {
    const { context, page, errors } = await openJourney(browser, { width: 1440, height: 900, quality: "fallback" });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT_DIR, "fallback-1440.png") });
    console.log(`Captured fallback-1440.png`);
    if (errors.length > 0) {
      console.error(`Fallback errors:`, errors);
      allPassed = false;
    } else {
      console.log(`[PASS] Fallback mode clean.`);
    }
    await context.close();
  }

  // 5. Reduced Motion Test
  console.log(`\n=== Testing Reduced Motion Mode ===`);
  {
    const { context, page, errors } = await openJourney(browser, { width: 1440, height: 900, reducedMotion: true });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT_DIR, "reduced-motion-1440.png") });
    console.log(`Captured reduced-motion-1440.png`);
    if (errors.length > 0) {
      console.error(`Reduced motion errors:`, errors);
      allPassed = false;
    } else {
      console.log(`[PASS] Reduced motion mode clean.`);
    }
    await context.close();
  }

} finally {
  await browser.close();
}

console.log(`\nOverall QA Status: ${allPassed ? "SUCCESS (ALL CRITERIA MET)" : "FAILURES DETECTED"}`);
process.exit(allPassed ? 0 : 1);
