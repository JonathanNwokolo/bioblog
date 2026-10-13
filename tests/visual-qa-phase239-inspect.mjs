/**
 * Fase 2.3.9 — hotspots, painel de inspeção, rotação, anotações, foco e Escape (interação real).
 *   QA_VP=1440|390|...   QA_OUT=hotspots
 */
import { mkdir, writeFile } from "node:fs/promises";
import { launch, openJourney, seek, EVIDENCE, VIEWPORTS } from "./qa239-lib.mjs";

const vp = process.env.QA_VP ?? "1440";
const out = `${EVIDENCE}/${process.env.QA_OUT ?? "hotspots"}`;
await mkdir(out, { recursive: true });
const browser = await launch();
const { context, page, errors } = await openJourney(browser, VIEWPORTS[vp]);
const results = [];

const targets = [
  { id: "giardia", p: 0.745 },
  { id: "t-cruzi", p: 0.815 },
  { id: "trichuris", p: 0.872 },
];

for (const { id, p } of targets) {
  const entry = { id, p, vp };
  await seek(page, p, 1000);
  const marker = page.locator(`[data-parasite-id="${id}"]`);
  entry.markerVisible = await marker.getAttribute("data-visible");
  // Alinhamento: o marcador deve cair sobre a borda do corpo (projeção do mesmo ponto).
  entry.alignment = await page.evaluate((id) => {
    const state = window.__MICROCOSMOS_CINEMATIC__.screen().find((s) => s.id === id);
    const button = document.querySelector(`[data-parasite-id="${id}"]`);
    const r = button.getBoundingClientRect();
    const stage = document.querySelector("section[data-explorar-journey]").firstElementChild.getBoundingClientRect();
    return {
      state: { x: state.marker.x, y: state.marker.y, widthPx: state.widthPx },
      button: { x: r.left + r.width / 2 - stage.left, y: r.top + r.height / 2 - stage.top },
    };
  }, id);
  await page.screenshot({ path: `${out}/${id}-${vp}-1-marker.png` });
  entry.progressBefore = await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.getProgress());

  // Foco por teclado visível no marcador.
  await marker.focus();
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${out}/${id}-${vp}-2-focus.png` });

  await marker.click();
  await page.waitForTimeout(900);
  const dialog = page.getByRole("dialog");
  entry.panelOpen = await page.locator('[role="dialog"]').count();
  entry.focusInPanel = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  entry.motionAfterOpen = await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.motion.diagnostics());
  await page.screenshot({ path: `${out}/${id}-${vp}-3-panel.png` });

  // Rotação por teclado (setas) e por botões, depois restaurar.
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/${id}-${vp}-4-rotated.png` });
  await dialog.getByRole("button", { name: "Inclinar para baixo" }).click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/${id}-${vp}-5-tilted.png` });
  entry.inspectionAfterRotate = await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.organisms().organisms);
  await dialog.getByRole("button", { name: "Restaurar orientação" }).click();
  await page.waitForTimeout(700);

  // Alternar movimento dentro do painel (organismos móveis).
  if (id !== "trichuris") {
    await dialog.getByRole("button", { name: "Retomar movimento" }).click();
    await page.waitForTimeout(700);
    entry.motionResumedInPanel = await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.motion.diagnostics());
    await page.screenshot({ path: `${out}/${id}-${vp}-6-resumed.png` });
    await dialog.getByRole("button", { name: "Pausar movimento" }).click();
  }

  // Escape: fecha, devolve o foco ao marcador e restaura a mesma posição da jornada.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(900);
  entry.panelClosed = (await page.locator('[role="dialog"]').count()) === 0;
  entry.focusRestored = await page.evaluate((id) => document.activeElement?.getAttribute("data-parasite-id") === id, id);
  entry.progressAfter = await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.getProgress());
  results.push(entry);
}

await writeFile(`${out}/inspect-${vp}.json`, JSON.stringify({ results, errors }, null, 1));
console.log(JSON.stringify({ errors, results: results.map((r) => ({ id: r.id, markerVisible: r.markerVisible, panelOpen: r.panelOpen, closed: r.panelClosed, focusRestored: r.focusRestored, d: Math.abs(r.progressAfter - r.progressBefore) })) }, null, 1));
await context.close();
await browser.close();
