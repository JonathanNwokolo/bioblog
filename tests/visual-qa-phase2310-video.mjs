/** Gravação contínua: roda incremental real, pausas de observação e três preparações. */
import { writeFile } from "node:fs/promises";
import { EVIDENCE, ensureDir, launch, openJourney, seek } from "./qa2310-lib.mjs";

const out = await ensureDir(`${EVIDENCE}/video`);
const browser = await launch();
const { context, page, errors } = await openJourney(browser, {
  width: 960,
  height: 600,
  quality: "medium",
  recordVideo: out,
});
await seek(page, 0.33, 250);
const samples = [];
for (let index = 0; index < 62; index += 1) {
  await page.mouse.move(480, 320);
  await page.mouse.wheel(0, 95);
  await page.waitForTimeout(index % 10 === 0 ? 420 : 95);
  if (index % 5 === 0) samples.push(await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.getProgress()));
}
await page.waitForTimeout(500);
const finalProgress = await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.getProgress());
await context.close();
await browser.close();
await writeFile(`${out}/video.json`, JSON.stringify({ samples, finalProgress, errors }, null, 2));
console.log("phase2310 continuous video ok", finalProgress);
