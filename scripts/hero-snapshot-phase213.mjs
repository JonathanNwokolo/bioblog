// Phase 2.1.3 — static (reduced-motion) hero captures to prove image optimisation did not change the design.
//   node scripts/hero-snapshot-phase213.mjs <outDir>            captures
//   node scripts/hero-snapshot-phase213.mjs --diff <dirA> <dirB> compares (mean absolute channel difference)
import { createRequire } from "node:module";
import { mkdirSync, readdirSync } from "node:fs";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const app = process.env.APP_URL ?? "http://localhost:3100";

if (process.argv[2] === "--diff") {
  const [, , , a, b] = process.argv;
  let worst = 0;
  for (const file of readdirSync(a).filter((f) => f.endsWith(".png"))) {
    const [x, y] = await Promise.all([sharp(`${a}/${file}`).removeAlpha().raw().toBuffer({ resolveWithObject: true }), sharp(`${b}/${file}`).removeAlpha().raw().toBuffer({ resolveWithObject: true })]);
    if (x.info.width !== y.info.width || x.info.height !== y.info.height) { console.log(`${file}: dimensões diferentes`); process.exitCode = 1; continue; }
    let sum = 0; let over = 0;
    for (let i = 0; i < x.data.length; i += 1) { const d = Math.abs(x.data[i] - y.data[i]); sum += d; if (d > 24) over += 1; }
    const mean = sum / x.data.length; const pct = (100 * over) / x.data.length;
    worst = Math.max(worst, mean);
    console.log(`${file}: diferença média ${mean.toFixed(3)}/255 · ${pct.toFixed(2)}% dos canais com Δ>24`);
  }
  console.log(`pior diferença média: ${worst.toFixed(3)}/255`);
} else {
  const out = process.argv[2];
  mkdirSync(out, { recursive: true });
  const { chromium } = require(process.env.PLAYWRIGHT_CORE ?? "C:/Users/Home/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright-core");
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  for (const [label, width, height] of [["1440", 1440, 900], ["768", 768, 1024], ["390", 390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce", locale: "pt-BR" });
    const page = await context.newPage();
    await page.goto(`${app}/`, { waitUntil: "load" });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${out}/hero-${label}.png` });
    await context.close();
  }
  await browser.close();
  console.log(`capturas em ${out}`);
}
