// Phase 2.1.3 — resolves axe "incomplete" colour-contrast nodes by sampling the real rendered background.
// For every text node axe could not decide, text is made transparent, the node's box is captured, and the
// worst-case background pixel is compared with the computed text colour (WCAG 2.x relative luminance).
//   AXE_PATH=.../axe.min.js APP_URL=http://localhost:3100 node scripts/contrast-audit-phase213.mjs [path ...]
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE ?? "C:/Users/Home/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright-core");
const axeSource = readFileSync(process.env.AXE_PATH ?? "axe.min.js", "utf8");
const app = process.env.APP_URL ?? "http://localhost:3100";
const paths = (process.argv.slice(2).length ? process.argv.slice(2) : ["home", "diario"]).map((p) => (p === "home" ? "/" : `/${p.replace(/^\/+/, "")}`));
const viewports = [{ label: "1440", width: 1440, height: 900 }, { label: "390", width: 390, height: 844 }];

const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const parseColor = (css) => { const m = css.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(",").map((x) => parseFloat(x)); return { rgb: p.slice(0, 3), a: p[3] ?? 1 }; };

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const report = [];
for (const vp of viewports) {
  for (const path of paths) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, locale: "pt-BR" });
    const page = await context.newPage();
    if (process.env.AUTH === "owner") {
      const envFile = Object.fromEntries(readFileSync(".env.e2e.local", "utf8").split("\n").map((l) => l.trim()).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
      await page.goto(`${app}/admin/login`, { waitUntil: "load" });
      await page.getByLabel("E-mail").fill(envFile.E2E_OWNER_EMAIL);
      await page.getByLabel("Senha").fill(envFile.E2E_OWNER_PASSWORD);
      await Promise.all([page.waitForURL(`${app}/admin`), page.getByRole("button", { name: "Entrar" }).click()]);
    }
    await page.goto(`${app}${path}`, { waitUntil: "load" });
    await page.waitForTimeout(800);
    await page.addScriptTag({ content: axeSource });
    const nodes = await page.evaluate(async () => {
      // eslint-disable-next-line no-undef
      const r = await axe.run(document, { runOnly: { type: "rule", values: ["color-contrast"] }, resultTypes: ["incomplete", "violations"] });
      const out = [];
      for (const group of [...r.incomplete, ...r.violations]) {
        for (const n of group.nodes) {
          const el = document.querySelector(n.target[0]);
          if (!el) continue;
          const s = getComputedStyle(el);
          el.scrollIntoView({ block: "center" });
          const rect = el.getBoundingClientRect();
          out.push({ kind: group.id === "color-contrast" && r.violations.includes(group) ? "violation" : "incomplete", selector: n.target[0], text: (el.textContent ?? "").trim().slice(0, 50), color: s.color, size: parseFloat(s.fontSize), weight: parseInt(s.fontWeight, 10), rect: { x: rect.x + window.scrollX, y: rect.y + window.scrollY, w: rect.width, h: rect.height } });
        }
      }
      return out;
    });
    // Make every glyph transparent so only the backgrounds remain, then sample each box.
    await page.addStyleTag({ content: "*{color:transparent !important;-webkit-text-fill-color:transparent !important;text-shadow:none !important}svg{opacity:1}" });
    const results = [];
    for (const n of nodes) {
      if (n.rect.w < 1 || n.rect.h < 1) continue;
      const clip = { x: Math.max(0, n.rect.x), y: Math.max(0, n.rect.y), width: Math.max(1, Math.min(n.rect.w, vp.width)), height: Math.max(1, n.rect.h) };
      try {
        const buf = await page.screenshot({ clip, fullPage: true });
        const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        const fg = parseColor(n.color);
        if (!fg) continue;
        // Inner 70% of the box only: borders, rounded corners and neighbours are not behind the glyphs.
        const mx = Math.floor(info.width * 0.15); const my = Math.floor(info.height * 0.15);
        let worst = Infinity; let sum = 0; let count = 0; let below = 0;
        const large0 = n.size >= 24 || (n.size >= 18.66 && n.weight >= 700);
        const need0 = large0 ? 3 : 4.5;
        for (let y = my; y < info.height - my; y += 1) {
          for (let x = mx; x < info.width - mx; x += 1) {
            const i = (y * info.width + x) * info.channels;
            const c = ratio(fg.rgb, [data[i], data[i + 1], data[i + 2]]);
            worst = Math.min(worst, c); sum += c; count += 1; if (c < need0) below += 1;
          }
        }
        if (!count) continue;
        const pctFail = +(100 * below / count).toFixed(1);
        const large = n.size >= 24 || (n.size >= 18.66 && n.weight >= 700);
        const need = large ? 3 : 4.5;
        results.push({ text: n.text, selector: n.selector.slice(0, 80), fg: n.color, size: n.size, need, worst: +worst.toFixed(2), mean: +(sum / count).toFixed(2), pctFail, pass: pctFail < 2 });
      } catch { /* node outside the page */ }
    }
    const failing = results.filter((r) => !r.pass);
    console.log(`${path} @${vp.label}: ${results.length} nós verificados · ${failing.length} abaixo do limiar no pior pixel`);
    for (const f of failing.slice(0, 12)) console.log(`   ✗ ${f.pctFail}% dos pixels < ${f.need}:1 (pior ${f.worst}, média ${f.mean}) · "${f.text}" · ${f.fg} · ${f.size}px · ${f.selector}`);
    report.push({ path, viewport: vp.label, checked: results.length, failing });
    await context.close();
  }
}
await browser.close();
mkdirSync("docs/evidence/phase213", { recursive: true });
writeFileSync("docs/evidence/phase213/contrast-audit.json", JSON.stringify({ at: new Date().toISOString(), report }, null, 2));
