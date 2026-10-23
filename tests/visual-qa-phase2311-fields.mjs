/** Recaptura rápida dos três campos sem organismos e recompõe o comparativo. */
import sharp from "sharp";
import { EVIDENCE, VIEWPORTS, ensureDir, launch, openJourney, seek } from "./qa2311-lib.mjs";

const chapters = [
  ["giardia", "giardia", 0.37],
  ["t-cruzi", "tcruzi", 0.615],
  ["trichuris", "trichuris-pilot", 0.858],
];
const browser = await launch();
const paths = [];
for (const [chapter, folder, progress] of chapters) {
  const { context, page, errors } = await openJourney(browser, {
    ...VIEWPORTS[1440],
    query: `debug=specimen&chapter=${chapter}&subject=off`,
  });
  if (errors.length) throw new Error(`${chapter}: ${errors.join(" | ")}`);
  await seek(page, progress, 80);
  const path = `${EVIDENCE}/${folder}/field-only-1440.png`;
  await page.screenshot({ path });
  paths.push(path);
  await context.close();
}
const sideBySide = await ensureDir(`${EVIDENCE}/side-by-side`);
const panels = await Promise.all(paths.map((path) => sharp(path).resize(720, 450, { fit: "cover" }).toBuffer()));
await sharp({ create: { width: 2160, height: 450, channels: 4, background: "#080c0b" } })
  .composite(panels.map((input, index) => ({ input, left: index * 720, top: 0 })))
  .webp({ quality: 92 })
  .toFile(`${sideBySide}/three-preparations-field-only.webp`);
await browser.close();
console.log("phase2311 field-only comparison ok");
