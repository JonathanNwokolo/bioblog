/**
 * Fase 2.3.8 — fumaça de regressão das demais rotas: status, erros de console/página,
 * overflow horizontal e a montagem do motor embutido na homepage (progresso 0).
 */
import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = process.env.QA_BASE_URL ?? "http://localhost:3000";
const out = "docs/evidence/phase23/round-8-optical-transition";
const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});
const routes = ["/", "/diario", "/atlas", "/laboratorio", "/onde-vivem", "/ciencia", "/admin", "/admin/login", "/explorar"];
const results = [];
for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  const context = await browser.newContext({ viewport });
  for (const route of routes) {
    const page = await context.newPage();
    page.setDefaultTimeout(60_000);
    const errors = [];
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 240)); });
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 240)}`));
    let status = null;
    try {
      const response = await page.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 90_000 });
      status = response?.status() ?? null;
      await page.waitForTimeout(800);
      const info = await page.evaluate(() => ({
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        title: document.title,
        canvases: document.querySelectorAll("canvas").length,
        url: location.pathname,
      }));
      results.push({ viewport: viewport.width, route, status, ...info, errors });
    } catch (error) {
      results.push({ viewport: viewport.width, route, status, failed: String(error).slice(0, 200), errors });
    }
    await page.close();
  }
  await context.close();
}
await writeFile(`${out}/routes-smoke.json`, JSON.stringify(results, null, 2));
await browser.close();
for (const r of results) console.log(`${r.viewport} ${r.route.padEnd(14)} ${r.status} →${r.url ?? "-"} overflowX=${r.overflowX ?? "-"} canvases=${r.canvases ?? "-"} errors=${r.errors.length}${r.failed ? " FAILED " + r.failed : ""}`);
