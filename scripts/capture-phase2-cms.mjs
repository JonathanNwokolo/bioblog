import { chromium } from "playwright";
import fs from "node:fs";

const baseUrl = "http://localhost:3010";
const outputDirectory = "docs/evidence/phase2-cms";
const viewports = [
  { name: "desktop-1440", width: 1440, height: 950 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "mobile-390", width: 390, height: 844 },
];
const routes = [
  { name: "home", path: "/" },
  { name: "diario", path: "/diario" },
  { name: "admin-login", path: "/admin/login" },
];

fs.mkdirSync(outputDirectory, { recursive: true });

const browser = await chromium.launch({ headless: true });
const results = [];

for (const viewport of viewports) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
  });

  for (const route of routes) {
    const page = await context.newPage();
    const errors = [];

    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    const response = await page.goto(`${baseUrl}${route.path}`, {
      waitUntil: "networkidle",
    });
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    const screenshot = `${outputDirectory}/${route.name}-${viewport.name}.png`;

    await page.screenshot({ path: screenshot, fullPage: true });
    results.push({
      route: route.path,
      viewport: viewport.name,
      status: response?.status() ?? null,
      overflow: dimensions.scrollWidth > dimensions.clientWidth,
      errors,
      screenshot,
    });
    await page.close();
  }

  await context.close();
}

await browser.close();
fs.writeFileSync(
  `${outputDirectory}/browser-results.json`,
  `${JSON.stringify(results, null, 2)}\n`,
);
console.log(JSON.stringify(results, null, 2));
