/** Captura rápida de iteração (Fase 2.3.9): QA_POINTS=0.74,0.82 QA_OUT=iter QA_VP=1440 */
import { mkdir, writeFile } from "node:fs/promises";
import { launch, openJourney, seek, EVIDENCE, VIEWPORTS } from "./qa239-lib.mjs";

const points = (process.env.QA_POINTS ?? "0.74,0.82,0.865").split(",").map(Number);
const vp = process.env.QA_VP ?? "1440";
const out = `${EVIDENCE}/${process.env.QA_OUT ?? "iter"}`;
await mkdir(out, { recursive: true });
const browser = await launch();
const { context, page, errors } = await openJourney(browser, VIEWPORTS[vp]);
const report = [];
for (const p of points) {
  await seek(page, p, 900);
  if (process.env.QA_FREEZE) await page.evaluate((t) => window.__MICROCOSMOS_CINEMATIC__.motion.freezeAt(t), Number(process.env.QA_FREEZE));
  if (process.env.QA_INSPECT) {
    await page.evaluate((v) => window.__MICROCOSMOS_CINEMATIC__.inspect(JSON.parse(v)), process.env.QA_INSPECT);
    await page.waitForTimeout(700);
  }
  await page.screenshot({ path: `${out}/${String(Math.round(p * 1000)).padStart(4, "0")}-${vp}.png` });
  report.push(
    await page.evaluate(() => {
      const h = window.__MICROCOSMOS_CINEMATIC__;
      return { progress: h.getProgress(), motion: h.motion.diagnostics(), organisms: h.organisms(), screen: h.screen() };
    }),
  );
}
await writeFile(`${out}/report-${vp}.json`, JSON.stringify({ report, errors }, null, 1));
console.log(JSON.stringify({ errors, last: report.at(-1)?.motion, org: report.at(-1)?.organisms }, null, 1));
await context.close();
await browser.close();
