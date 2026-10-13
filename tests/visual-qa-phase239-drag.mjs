/**
 * Fase 2.3.9 — rotação do ovo por arraste (mouse e toque emulado via CDP) com o painel aberto,
 * e prova de que a rolagem normal não é capturada fora do painel.
 *   QA_OUT=hotspots
 */
import { mkdir, writeFile } from "node:fs/promises";
import { launch, openJourney, seek, EVIDENCE, VIEWPORTS } from "./qa239-lib.mjs";

const out = `${EVIDENCE}/${process.env.QA_OUT ?? "hotspots"}`;
await mkdir(out, { recursive: true });
const browser = await launch();
const report = {};

for (const vp of ["1440", "390"]) {
  const { context, page, errors } = await openJourney(browser, VIEWPORTS[vp]);
  const r = {};
  await seek(page, 0.872, 900);
  // Fora do painel, a roda continua sendo rolagem da jornada (nenhuma alça de arraste existe).
  r.handleWithoutPanel = await page.evaluate(() => Boolean(document.querySelector('[class*="specimenHandle"]')));
  const before = await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.getProgress());
  await page.mouse.move(700, 400);
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(500);
  r.wheelScrollsJourney = (await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.getProgress())) > before;
  await seek(page, 0.872, 700);

  await page.locator('[data-parasite-id="trichuris"]').click();
  await page.waitForTimeout(800);
  const handle = page.locator('[class*="specimenHandle"]');
  r.handleWithPanel = await handle.count();
  const box = await handle.boundingBox();
  const yaw = () => page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.organisms().organisms.trichuris.yaw);
  r.yawStart = await yaw();
  // Mouse
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(900);
  r.yawAfterMouseDrag = await yaw();
  await page.screenshot({ path: `${out}/drag-mouse-${vp}.png` });
  await page.getByRole("dialog").getByRole("button", { name: "Restaurar orientação" }).click();
  await page.waitForTimeout(800);
  r.yawAfterReset = await yaw();
  // Toque emulado (CDP): arraste horizontal sobre a alça.
  const cdp = await context.newCDPSession(page);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: cx, y: cy }] });
  for (let i = 1; i <= 6; i += 1) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: cx - i * 14, y: cy }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(900);
  r.yawAfterTouchDrag = await yaw();
  await page.screenshot({ path: `${out}/drag-touch-${vp}.png` });
  r.errors = errors;
  report[vp] = r;
  await context.close();
}
await writeFile(`${out}/drag.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
await browser.close();
