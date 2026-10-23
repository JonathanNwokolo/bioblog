/** Gravação contínua, sem saltos, da porção microscópica da Fase 2.3.11. */
import { rename, writeFile } from "node:fs/promises";
import { EVIDENCE, ensureDir, launch, openJourney, seek } from "./qa2311-lib.mjs";

const out = await ensureDir(`${EVIDENCE}/journey`);
const temporary = await ensureDir(`${out}/capture`);
const browser = await launch();
const { context, page, errors } = await openJourney(browser, {
  width: 1280,
  height: 800,
  quality: "medium",
  recordVideo: temporary,
});
await seek(page, 0.225, 600);
const samples = [];
for (let index = 0; index <= 300; index += 1) {
  const progress = 0.225 + (0.735 * index) / 300;
  await seek(page, progress, 45);
  if (index % 15 === 0) {
    samples.push(await page.evaluate(() => ({
      progress: window.__MICROCOSMOS_CINEMATIC__.getProgress(),
      stage: window.__MICROCOSMOS_CINEMATIC__.getStageId(),
    })));
  }
}
await page.waitForTimeout(900);
const video = page.video();
await context.close();
const source = await video.path();
await rename(source, `${out}/microscopic-journey.webm`);
await browser.close();
await writeFile(`${out}/journey.json`, JSON.stringify({ samples, errors }, null, 2));
console.log("phase2311 continuous video ok");
