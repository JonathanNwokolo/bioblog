import assert from "node:assert/strict";
import { launch, openJourney, seek } from "./qa2311-lib.mjs";

const browser = await launch();
for (const [id, progress] of Object.entries({ giardia: 0.37, "t-cruzi": 0.68, trichuris: 0.858 })) {
  const { context, page } = await openJourney(browser, { width: 1440, height: 900 });
  await seek(page, progress);
  const marker = page.locator(`[data-parasite-id="${id}"]`);
  await marker.focus();
  const before = await page.evaluate(() => ({ progress: window.__MICROCOSMOS_CINEMATIC__.getProgress(), scrollY: window.scrollY }));
  await marker.click();
  await page.locator('[role="dialog"]').waitFor({ state: "visible" });
  await page.waitForTimeout(120);
  await page.screenshot();
  const during = await page.evaluate(() => ({ progress: window.__MICROCOSMOS_CINEMATIC__.getProgress(), scrollY: window.scrollY }));
  await page.keyboard.press("Escape");
  await page.locator('[role="dialog"]').waitFor({ state: "detached" });
  await page.waitForTimeout(120);
  const after = await page.evaluate(() => ({
    progress: window.__MICROCOSMOS_CINEMATIC__.getProgress(),
    scrollY: window.scrollY,
    focused: document.activeElement?.getAttribute("data-parasite-id"),
  }));
  assert.ok(Math.abs(during.progress - before.progress) <= 0.003, `${id}: abrir o painel deslocou o capítulo`);
  assert.ok(Math.abs(after.progress - before.progress) <= 0.003, `${id}: fechar o painel não restaurou o capítulo`);
  assert.equal(after.focused, id, `${id}: o foco não voltou ao hotspot`);
  console.log(JSON.stringify({ id, before, during, after, delta: Math.abs(after.progress - before.progress) }));
  await context.close();
}
await browser.close();
