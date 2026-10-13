/** Pass A: composição dos três mundos, com e sem o organismo principal. */
import { writeFile } from "node:fs/promises";
import sharp from "sharp";
import { EVIDENCE, VIEWPORTS, ensureDir, launch, openJourney, seek } from "./qa2310-lib.mjs";

const out = await ensureDir(`${EVIDENCE}/composition-pass-a`);
const browser = await launch();
const report = { frames: [], pacing: {} };
const chapters = [
  ["giardia", 0.45],
  ["t-cruzi", 0.63],
  ["trichuris", 0.82],
];

for (const viewport of Object.keys(VIEWPORTS)) {
  const dimensions = VIEWPORTS[viewport];
  const { context, page, errors } = await openJourney(browser, dimensions);
  const geometry = await page.evaluate(() => {
    const track = document.querySelector("section[data-explorar-journey]");
    const stage = track.firstElementChild;
    return { track: track.offsetHeight, viewport: stage.clientHeight, travel: track.offsetHeight - stage.clientHeight };
  });
  report.pacing[viewport] = {
    ...geometry,
    giardia: { reveal: geometry.travel * 0.03, contemplation: geometry.travel * 0.08, buffer: geometry.travel * 0.04 },
    "t-cruzi": { reveal: geometry.travel * 0.03, contemplation: geometry.travel * 0.09, buffer: geometry.travel * 0.04 },
    trichuris: { reveal: geometry.travel * 0.03, contemplation: geometry.travel * 0.09, buffer: geometry.travel * 0.02 },
  };
  for (const [name, progress] of chapters) {
    await seek(page, progress);
    if (viewport === "1440" || viewport === "390" || viewport === "320") {
      await page.screenshot({ path: `${out}/${name}-${viewport}-integrated.png` });
    }
    report.frames.push({ viewport, name, progress, optical: await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.getOptical()) });
  }
  report[`errors-${viewport}`] = errors;
  await context.close();
}

const emptyPaths = [];
for (const viewport of ["1440", "390", "320"]) {
  const { context, page, errors } = await openJourney(browser, { ...VIEWPORTS[viewport], query: "debug=specimen" });
  for (const [name, progress] of chapters) {
    await seek(page, progress);
    const path = `${out}/${name}-${viewport}-empty.png`;
    await page.screenshot({ path });
    if (viewport === "1440") emptyPaths.push(path);
  }
  report[`debug-errors-${viewport}`] = errors;
  await context.close();
}

const panels = await Promise.all(emptyPaths.map((path) => sharp(path).resize(720, 450, { fit: "cover" }).toBuffer()));
await sharp({ create: { width: 2160, height: 450, channels: 4, background: "#080c0b" } })
  .composite(panels.map((input, index) => ({ input, left: index * 720, top: 0 })))
  .webp({ quality: 92 })
  .toFile(`${out}/three-worlds-empty-side-by-side.webp`);

await writeFile(`${out}/composition.json`, JSON.stringify(report, null, 2));
await browser.close();
console.log(`phase2310 composition pass A ok: ${report.frames.length} measured frames`);
