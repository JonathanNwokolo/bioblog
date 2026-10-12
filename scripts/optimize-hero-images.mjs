// Phase 2.1.3 — generates web-delivery WebP variants of the approved hero artwork.
// Sources (PNG/JPG) stay untouched in public/images/hero; only new .webp files are written.
//   node scripts/optimize-hero-images.mjs
import { statSync } from "node:fs";
import sharp from "sharp";

const dir = "public/images/hero";
const jobs = [
  { src: "hero-portrait-cutout.png", out: "hero-portrait-cutout.webp", width: 896, opts: { quality: 80, alphaQuality: 90, effort: 6 } },
  { src: "hero-portrait-cutout.png", out: "hero-portrait-cutout-640.webp", width: 640, opts: { quality: 80, alphaQuality: 90, effort: 6 } },
  { src: "hero-portrait-cutout.png", out: "hero-portrait-cutout-480.webp", width: 480, opts: { quality: 80, alphaQuality: 90, effort: 6 } },
  { src: "microscopy-cysts.jpg", out: "microscopy-cysts.webp", width: 960, opts: { quality: 76, effort: 6 } },
  { src: "microscopy-giardia.jpg", out: "microscopy-giardia.webp", width: 960, opts: { quality: 76, effort: 6 } },
  { src: "microscopy-larva.jpg", out: "microscopy-larva.webp", width: 960, opts: { quality: 76, effort: 6 } },
];

for (const job of jobs) {
  await sharp(`${dir}/${job.src}`).resize({ width: job.width, withoutEnlargement: true }).webp(job.opts).toFile(`${dir}/${job.out}`);
  const before = statSync(`${dir}/${job.src}`).size;
  const after = statSync(`${dir}/${job.out}`).size;
  console.log(`${job.out.padEnd(36)} ${(before / 1024).toFixed(0).padStart(5)} KB → ${(after / 1024).toFixed(0).padStart(4)} KB`);
}
