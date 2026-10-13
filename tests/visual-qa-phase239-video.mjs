/**
 * Fase 2.3.9 — gravação real (webm) do movimento local dos organismos: parada com câmera fixa
 * (só o organismo se move), pausa/retomada, algumas voltas de roda reais, painel de inspeção e
 * rotação. Curta de propósito: em SwiftShader (CPU) a página é lenta e a cadência do vídeo NÃO
 * representa a de uma GPU física.
 *   QA_SIZE=960x600  QA_OUT=video
 */
import { mkdir, rename } from "node:fs/promises";
import { launch, seek, BASE, EVIDENCE } from "./qa239-lib.mjs";

const [width, height] = (process.env.QA_SIZE ?? "960x600").split("x").map(Number);
const out = `${EVIDENCE}/${process.env.QA_OUT ?? "video"}`;
await mkdir(out, { recursive: true });
const tmp = `${out}/_tmp`;
await mkdir(tmp, { recursive: true });

const size = { width, height };
const browser = await launch();
const context = await browser.newContext({ viewport: size });
const warm = await context.newPage();
warm.setDefaultTimeout(120_000);
await warm.goto(`${BASE}/explorar?quality=medium`, { waitUntil: "networkidle", timeout: 180_000 });
await warm.waitForFunction(() => window.__MICROCOSMOS_CINEMATIC__?.getRenderCount() > 0);
await warm.close();

// Segunda página já com cache quente: o vídeo começa direto na cena.
const recordContext = await browser.newContext({ viewport: size, recordVideo: { dir: tmp, size } });
const page = await recordContext.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(e.message));
page.setDefaultTimeout(120_000);
await page.goto(`${BASE}/explorar?quality=medium`, { waitUntil: "networkidle", timeout: 180_000 });
await page.waitForFunction(() => window.__MICROCOSMOS_CINEMATIC__?.getRenderCount() > 0);

await seek(page, 0.745, 300);
await page.mouse.move(size.width * 0.4, size.height * 0.5);
await page.waitForTimeout(6000); // câmera fixa: só o movimento local
const pause = page.getByRole("button", { name: "Pausar movimento" }).first();
await pause.click();
await page.waitForTimeout(2500);
await page.getByRole("button", { name: "Retomar movimento" }).first().click();
await page.waitForTimeout(3500);
for (let i = 0; i < 6; i += 1) { await page.mouse.wheel(0, 90); await page.waitForTimeout(250); }
await page.waitForTimeout(2500);
await seek(page, 0.815, 300);
await page.waitForTimeout(6000);
await seek(page, 0.872, 300);
await page.waitForTimeout(3000);
await seek(page, 0.745, 300);
await page.waitForTimeout(1500);
const marker = page.locator('[data-parasite-id="giardia"][data-visible="true"]');
if (await marker.count()) {
  await marker.click();
  await page.waitForTimeout(1000);
  await page.getByRole("dialog").getByRole("button", { name: "Retomar movimento" }).click();
  await page.waitForTimeout(3000);
  for (let i = 0; i < 3; i += 1) { await page.keyboard.press("ArrowRight"); await page.waitForTimeout(700); }
  await page.waitForTimeout(1500);
  for (let i = 0; i < 6; i += 1) { await page.keyboard.press("ArrowLeft"); await page.waitForTimeout(500); }
  await page.waitForTimeout(1500);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1000);
}
const video = page.video();
await recordContext.close();
const path = await video.path();
await context.close();
await browser.close();
const final = `${out}/organism-motion-${width}x${height}.webm`;
await rename(path, final);
console.log(JSON.stringify({ final, errors }));
