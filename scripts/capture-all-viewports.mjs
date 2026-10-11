import { chromium } from 'playwright';
import fs from 'node:fs';

const viewports = [
  { name: 'desktop-1440', width: 1440, height: 950 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'mobile-390', width: 390, height: 844 },
];

if (!fs.existsSync('docs/screenshots')) {
  fs.mkdirSync('docs/screenshots', { recursive: true });
}

const browser = await chromium.launch();

for (const vp of viewports) {
  const page = await browser.newPage({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
  });

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(err.message));

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // Check for horizontal overflow
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  console.log(`[${vp.name}] scrollWidth: ${scrollWidth}, clientWidth: ${clientWidth}, overflow: ${scrollWidth > clientWidth}`);

  if (consoleErrors.length > 0) {
    console.warn(`[${vp.name}] Console errors:`, consoleErrors);
  }

  // Capture hero section specifically
  const heroElement = await page.$('section[aria-labelledby="hero-titulo"]');
  if (heroElement) {
    await heroElement.screenshot({
      path: `docs/screenshots/rebuilt-hero-${vp.name}.png`,
    });
    console.log(`Saved docs/screenshots/rebuilt-hero-${vp.name}.png`);
  } else {
    await page.screenshot({
      path: `docs/screenshots/rebuilt-hero-${vp.name}.png`,
      clip: { x: 0, y: 0, width: vp.width, height: 880 },
    });
    console.log(`Saved docs/screenshots/rebuilt-hero-${vp.name}.png (fallback)`);
  }

  await page.close();
}

await browser.close();
console.log('All screenshots captured successfully!');
