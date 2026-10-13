/**
 * Folha de contato do movimento: quadros congelados em fases sucessivas (determinísticos),
 * recortados ao redor do organismo. QA_ID=giardia|t-cruzi  QA_VP=1440  QA_STEP=0.25  QA_N=8
 */
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { launch, openJourney, seek, EVIDENCE, VIEWPORTS } from "./qa239-lib.mjs";
const require = createRequire(import.meta.url);
const sharp = require("sharp");

const id = process.env.QA_ID ?? "giardia";
const vp = process.env.QA_VP ?? "1440";
const step = Number(process.env.QA_STEP ?? 0.25);
const n = Number(process.env.QA_N ?? 8);
const p = Number(process.env.QA_P ?? (id === "giardia" ? 0.745 : id === "t-cruzi" ? 0.815 : 0.872));
const out = `${EVIDENCE}/${process.env.QA_OUT ?? "motion"}`;
await mkdir(out, { recursive: true });

const browser = await launch();
const { context, page, errors } = await openJourney(browser, VIEWPORTS[vp]);
await seek(page, p, 900);
await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.motion.pause());
const state = await page.evaluate((id) => window.__MICROCOSMOS_CINEMATIC__.screen().find((s) => s.id === id), id);
const half = Math.round(state.widthPx * 0.62);
const clip = {
  x: Math.max(0, Math.round(state.x - half)),
  y: Math.max(0, Math.round(state.y - half * (id === "giardia" ? 1.0 : 0.62))),
  width: half * 2,
  height: Math.round(half * 2 * (id === "giardia" ? 1.0 : 0.62)),
};
const frames = [];
for (let i = 0; i < n; i += 1) {
  const t = i * step;
  await page.evaluate((t) => window.__MICROCOSMOS_CINEMATIC__.motion.freezeAt(t), t);
  await page.waitForTimeout(250);
  frames.push(await page.screenshot({ clip }));
}
const cols = Math.min(4, n);
const rows = Math.ceil(n / cols);
await sharp({
  create: { width: clip.width * cols, height: clip.height * rows, channels: 3, background: "#04100f" },
})
  .composite(frames.map((input, i) => ({ input, left: (i % cols) * clip.width, top: Math.floor(i / cols) * clip.height })))
  .png()
  .toFile(`${out}/sheet-${id}-${vp}.png`);
console.log(JSON.stringify({ id, clip, errors }));
await context.close();
await browser.close();
