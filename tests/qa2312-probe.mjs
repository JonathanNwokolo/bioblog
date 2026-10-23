import { launch, openJourney, seek } from "./qa2311-lib.mjs";
const out = "docs/evidence/phase23/round-12/scratch";
const browser = await launch();
const { context, page } = await openJourney(browser, { width: 1440, height: 900 });
await seek(page, Number(process.argv[2] ?? 0.27), 500);
const css = await page.evaluate(() => {
  const wrap = document.querySelector("[data-explorar-journey] [aria-hidden='true']");
  return [...wrap.children].map((el) => ({ cls: el.className, bg: getComputedStyle(el).backgroundImage.slice(0, 160), op: getComputedStyle(el).opacity, filter: getComputedStyle(el).filter }));
});
console.log(JSON.stringify(css, null, 1));
await page.evaluate(() => {
  const wrap = document.querySelector("[data-explorar-journey] [aria-hidden='true']");
  [...wrap.children].slice(1).forEach((el) => { el.style.display = "none"; });
});
await page.screenshot({ path: `${out}/canvas-only.png` });
await page.evaluate(() => {
  const host = document.querySelector("[data-explorar-journey] [aria-hidden='true']").firstElementChild;
  host.style.filter = "none";
});
await page.screenshot({ path: `${out}/canvas-noblur.png` });
await context.close();
await browser.close();
