import { launch, openJourney, seek } from "./qa2310-lib.mjs";

const browser = await launch();
for (const [id, progress] of Object.entries({ giardia: 0.45, "t-cruzi": 0.63, trichuris: 0.82 })) {
  const { context, page } = await openJourney(browser, { width: 1440, height: 900 });
  await seek(page, progress);
  const marker = page.locator(`[data-parasite-id="${id}"]`);
  await marker.focus();
  const before = await page.evaluate(() => ({ progress: window.__MICROCOSMOS_CINEMATIC__.getProgress(), scrollY: window.scrollY }));
  await marker.click();
  await page.locator('[role="dialog"]').waitFor({ state: "visible" });
  await page.screenshot();
  const during = await page.evaluate(() => ({ progress: window.__MICROCOSMOS_CINEMATIC__.getProgress(), scrollY: window.scrollY }));
  await page.keyboard.press("Escape");
  await page.locator('[role="dialog"]').waitFor({ state: "detached" });
  await page.waitForTimeout(50);
  const after = await page.evaluate(() => ({ progress: window.__MICROCOSMOS_CINEMATIC__.getProgress(), scrollY: window.scrollY }));
  console.log(JSON.stringify({ id, before, during, after, delta: Math.abs(after.progress - before.progress) }));
  await context.close();
}
await browser.close();
