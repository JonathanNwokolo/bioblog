/** Recaptura rápida de uma sequência de descoberta durante iteração visual. */
import sharp from "sharp";
import { EVIDENCE, VIEWPORTS, launch, openJourney, seek } from "./qa2311-lib.mjs";

const definitions = {
  giardia: { folder: "giardia", frames: [0.252, 0.276, 0.298, 0.312, 0.337, 0.370, 0.425, 0.463] },
  "t-cruzi": { folder: "tcruzi", frames: [0.610, 0.622, 0.634, 0.643, 0.660, 0.680, 0.724, 0.742] },
  trichuris: { folder: "trichuris-pilot", frames: [0.755, 0.780, 0.800, 0.812, 0.835, 0.858, 0.902, 0.938] },
};
const labels = ["01-field", "02-exploration", "03-first-hint", "04-partial", "05-full", "06-inspection", "07-departure", "08-post-discovery"];
const chapter = process.env.QA_CHAPTER ?? "t-cruzi";
const config = definitions[chapter];
if (!config) throw new Error(`Capítulo desconhecido: ${chapter}`);

const browser = await launch();
const { context, page, errors } = await openJourney(browser, VIEWPORTS[1440]);
const paths = [];
for (let index = 0; index < config.frames.length; index += 1) {
  await seek(page, config.frames[index], 140);
  const path = `${EVIDENCE}/${config.folder}/${labels[index]}-1440.png`;
  await page.screenshot({ path });
  paths.push(path);
}
if (errors.length) throw new Error(errors.join(" | "));
const panels = await Promise.all(paths.map((path) => sharp(path).resize(480, 300, { fit: "cover" }).toBuffer()));
await sharp({ create: { width: 1920, height: 600, channels: 4, background: "#080c0b" } })
  .composite(panels.map((input, index) => ({ input, left: (index % 4) * 480, top: Math.floor(index / 4) * 300 })))
  .webp({ quality: 90 })
  .toFile(`${EVIDENCE}/${config.folder}/discovery-sequence.webp`);
await context.close();
await browser.close();
console.log(`phase2311 ${chapter} sequence ok`);
