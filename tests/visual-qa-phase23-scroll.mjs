/**
 * QA de scrubbing da Fase 2.3.2 — navegador real (Chromium + ANGLE/SwiftShader).
 *
 * Executa contra um servidor de produção:
 *   npx next build && npx next start -p 3100
 *   PHASE23_BASE_URL=http://localhost:3100 node tests/visual-qa-phase23-scroll.mjs
 *
 * Usa rolagem real (roda do mouse, teclado, gesto de toque via CDP e scrollTo
 * instantâneo). Não existe API de "seek": o progresso é sempre derivado da
 * posição de rolagem. Resultados: docs/evidence/phase23/round-3-scroll/.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = process.env.PHASE23_BASE_URL ?? "http://localhost:3100";
const OUT = "docs/evidence/phase23/round-3-scroll";
const URL_Q = `${BASE}/explorar?quality=high`;
const LAUNCH = {
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
};
const sha = (buffer) => createHash("sha256").update(buffer).digest("hex").slice(0, 16);
const pct = (p) => String(Math.round(p * 100)).padStart(3, "0");
const report = { capturedAt: new Date().toISOString(), baseUrl: BASE, runtime: "Chromium headless, ANGLE/SwiftShader (software) — not physical-device evidence", checks: {}, consoleErrors: [], pageErrors: [] };
const ONLY = process.env.QA_ONLY ? process.env.QA_ONLY.split(",") : null;
const want = (group) => !ONLY || ONLY.includes(group);
const record = (name, value) => { report.checks[name] = value; console.log(name, JSON.stringify(value).slice(0, 400)); };

async function open(context, url = URL_Q) {
  const page = await context.newPage();
  page.setDefaultTimeout(120_000);
  page.on("console", (m) => { if (m.type() === "error") report.consoleErrors.push(m.text().slice(0, 300)); });
  page.on("pageerror", (e) => report.pageErrors.push(e.message));
  await page.addInitScript(() => {
    window.__rafCount = 0;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => { window.__rafCount += 1; return raf(cb); };
  });
  await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForFunction(() => window.__MICROCOSMOS_CINEMATIC__?.getRenderCount() > 0, null, { timeout: 60_000 });
  return page;
}

async function geometry(page) {
  return page.evaluate(() => {
    const track = document.querySelector("section[data-explorar-journey]");
    const stage = track.firstElementChild;
    return { top: track.getBoundingClientRect().top + window.scrollY, height: track.offsetHeight, viewport: stage.clientHeight };
  });
}

/** Espera a rolagem (inclusive a suave nativa) estabilizar: progresso inalterado por 600 ms. */
async function settle(page, maxMs = 40_000) {
  const started = Date.now();
  let last = -1;
  let stableSince = Date.now();
  while (Date.now() - started < maxMs) {
    const now = await page.evaluate(() => window.scrollY);
    if (Math.abs(now - last) > 0.5) { last = now; stableSince = Date.now(); }
    else if (Date.now() - stableSince > 1500) return;
    await page.waitForTimeout(100);
  }
}

/** Clica e espera a rolagem (suave nativa) começar e terminar; depois o último quadro ser desenhado. */
async function clickAndSettle(page, locator) {
  const before = await page.evaluate(() => window.scrollY);
  await locator.click();
  const started = Date.now();
  while (Date.now() - started < 8000) {
    if (Math.abs((await page.evaluate(() => window.scrollY)) - before) > 1) break;
    await page.waitForTimeout(100);
  }
  await settle(page);
  await caughtUp(page);
  await idle(page);
}

/** Posiciona a rolagem de forma instantânea (a página usa scroll-behavior: smooth). */
async function scrollToProgress(page, progress) {
  await settle(page);
  const g = await geometry(page);
  const y = g.top + progress * (g.height - g.viewport);
  await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
  await page.waitForFunction(
    (target) => Math.abs(window.__MICROCOSMOS_CINEMATIC__.getProgress() - target) < 0.002,
    progress,
    { timeout: 90_000 },
  );
  await idle(page);
}

/** Espera o progresso exibido alcançar o derivado da rolagem real (quadros lentos em GL por software). */
async function caughtUp(page, maxMs = 90_000) {
  await page.waitForFunction(
    () => {
      const track = document.querySelector("section[data-explorar-journey]");
      const stage = track.firstElementChild;
      const travel = track.offsetHeight - stage.clientHeight;
      const derived = Math.min(1, Math.max(0, -track.getBoundingClientRect().top / travel));
      return Math.abs(window.__MICROCOSMOS_CINEMATIC__.getProgress() - derived) < 0.002;
    },
    null,
    { timeout: maxMs },
  );
}

/** Espera a fila de quadros esvaziar (GL por software pode levar segundos por quadro). */
async function idle(page, quietMs = 900, maxMs = 60_000) {
  const started = Date.now();
  let lastRenders = -1;
  let quietSince = Date.now();
  while (Date.now() - started < maxMs) {
    const renders = await page.evaluate(() => window.__MICROCOSMOS_CINEMATIC__.getRenderCount());
    if (renders !== lastRenders) { lastRenders = renders; quietSince = Date.now(); }
    else if (Date.now() - quietSince > quietMs) return;
    await page.waitForTimeout(150);
  }
}

const state = (page) => page.evaluate(() => ({
  progress: window.__MICROCOSMOS_CINEMATIC__.getProgress(),
  stage: window.__MICROCOSMOS_CINEMATIC__.getStageId(),
  renders: window.__MICROCOSMOS_CINEMATIC__.getRenderCount(),
  pose: window.__MICROCOSMOS_CINEMATIC__.getPose(),
}));
const poseKey = (pose) => JSON.stringify([...pose.position, ...pose.target, pose.fov].map((n) => Number(n.toFixed(5))));

async function run() {
  await mkdir(OUT, { recursive: true });
  if (ONLY) {
    try {
      const previous = JSON.parse(await readFile(`${OUT}/qa-scrub-metrics.json`, "utf8"));
      Object.assign(report.checks, previous.checks);
      report.consoleErrors.push(...previous.consoleErrors);
      report.pageErrors.push(...previous.pageErrors);
    } catch { /* primeira execução parcial */ }
  }
  const browser = await chromium.launch(LAUNCH);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await open(context);

  if (want("core")) {
  // 9.1 — progresso direto -------------------------------------------------
  const direct = {};
  for (const p of [0, 0.1, 0.2, 0.35, 0.5, 0.65, 0.8, 0.9, 1]) {
    await scrollToProgress(page, p);
    const shot = await page.screenshot({ path: `${OUT}/scrub-${pct(p)}-1440.png` });
    const s = await state(page);
    direct[p] = { stage: s.stage, progress: Number(s.progress.toFixed(4)), pose: poseKey(s.pose), image: sha(shot) };
  }
  record("direct", Object.fromEntries(Object.entries(direct).map(([k, v]) => [k, { stage: v.stage, progress: v.progress }])));

  // 9.2 — reversibilidade: 0 → 25 → 70 → 40 → 90 → 10 → 100 → 0 --------------
  const route = [0, 0.25, 0.7, 0.4, 0.9, 0.1, 1, 0];
  const visits = [];
  for (const p of route) {
    await scrollToProgress(page, p);
    const shot = await page.screenshot();
    const s = await state(page);
    visits.push({ target: p, stage: s.stage, pose: poseKey(s.pose), image: sha(shot) });
    if (p === 0.4) await writeFile(`${OUT}/reverse-after-70-to-40-1440.png`, shot);
    if (p === 0.1) await writeFile(`${OUT}/reverse-after-90-to-10-1440.png`, shot);
  }
  await scrollToProgress(page, 0.4);
  const direct40 = await state(page);
  const direct40Shot = await page.screenshot({ path: `${OUT}/scrub-040-direct-1440.png` });
  const reverse40 = visits.find((v) => v.target === 0.4);
  record("reversibility", {
    route,
    visits: visits.map((v) => ({ target: v.target, stage: v.stage })),
    poseAt40Reverse: reverse40.pose,
    poseAt40Direct: poseKey(direct40.pose),
    samePose: reverse40.pose === poseKey(direct40.pose),
    sameImage: reverse40.image === sha(direct40Shot),
    imageHashReverse: reverse40.image,
    imageHashDirect: sha(direct40Shot),
  });
  const zeroStart = direct[0];
  const zeroEnd = visits[visits.length - 1];
  record("returnToStart", { samePose: zeroEnd.pose === zeroStart.pose, sameImage: zeroEnd.image === zeroStart.image });

  // 9.3 — rolagem parada: nada se move sem rolar --------------------------------
  const stall = {};
  for (const p of [0.35, 0.6, 0.85]) {
    await scrollToProgress(page, p);
    const before = await state(page);
    const shotBefore = await page.screenshot();
    await page.evaluate(() => { window.__rafCount = 0; });
    await page.waitForTimeout(3000);
    const after = await state(page);
    const shotAfter = await page.screenshot();
    const raf = await page.evaluate(() => window.__rafCount);
    stall[p] = {
      rendersBefore: before.renders,
      rendersAfter: after.renders,
      samePose: poseKey(before.pose) === poseKey(after.pose),
      sameImage: sha(shotBefore) === sha(shotAfter),
      rafCallsDuring3s: raf,
    };
    if (p === 0.35) await writeFile(`${OUT}/stall-035-after-3s-1440.png`, shotAfter);
  }
  record("stall", stall);

  // 9.4 — saltos rápidos ------------------------------------------------------
  const jumps = [];
  for (const p of [1, 0, 0.9, 0.2, 0.75, 0.05, 1, 0.5]) {
    await scrollToProgress(page, p);
    const s = await state(page);
    jumps.push({ target: p, got: Number(s.progress.toFixed(4)), stage: s.stage });
  }
  await scrollToProgress(page, 0.5);
  const afterJumps50 = poseKey((await state(page)).pose);
  await scrollToProgress(page, 0);
  await scrollToProgress(page, 0.5);
  record("fastJumps", { jumps, poseAt50Stable: afterJumps50 === poseKey((await state(page)).pose) });

  }

  if (want("input")) {
  // Rolagem por roda do mouse / touchpad (eventos wheel reais) -------------------
  await scrollToProgress(page, 0);
  await page.mouse.move(720, 450);
  const wheelTrace = [];
  for (let step = 0; step < 24; step += 1) {
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(60);
    if (step % 6 === 5) wheelTrace.push(Number((await state(page)).progress.toFixed(4)));
  }
  await page.waitForTimeout(500);
  const wheelDown = (await state(page)).progress;
  await page.screenshot({ path: `${OUT}/wheel-forward-1440.png` });
  for (let step = 0; step < 12; step += 1) {
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(500);
  const wheelUp = (await state(page)).progress;
  await page.screenshot({ path: `${OUT}/wheel-reverse-1440.png` });
  record("wheel", { forwardTrace: wheelTrace, afterForward: wheelDown, afterReverse: wheelUp, reversed: wheelUp < wheelDown });

  // Teclado -------------------------------------------------------------------
  await scrollToProgress(page, 0);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press("PageDown");
  await settle(page);
  const afterPageDown = (await state(page)).progress;
  await page.keyboard.press("End");
  await settle(page);
  const afterEnd = (await state(page)).progress;
  const docAfterEnd = await page.evaluate(() => ({ y: window.scrollY, max: document.documentElement.scrollHeight - innerHeight }));
  await page.keyboard.press("Home");
  await settle(page);
  const afterHome = (await state(page)).progress;
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(400);
  const nextButton = page.getByRole("button", { name: "Próxima etapa" });
  await clickAndSettle(page, nextButton);
  const afterNext = await state(page);
  await clickAndSettle(page, page.getByRole("button", { name: "Etapa anterior" }));
  const afterPrev = await state(page);
  await clickAndSettle(page, page.getByRole("button", { name: "Ir à descoberta" }));
  const afterSkip = await state(page);
  record("keyboardAndControls", {
    pageDown: Number(afterPageDown.toFixed(3)),
    end: Number(afterEnd.toFixed(3)),
    endReachesDocumentBottom: Math.abs(docAfterEnd.y - docAfterEnd.max) < 2,
    home: Number(afterHome.toFixed(3)),
    nextStage: afterNext.stage,
    prevStage: afterPrev.stage,
    skipToDiscovery: { stage: afterSkip.stage, progress: Number(afterSkip.progress.toFixed(3)) },
  });

  // Ancoragem de foco por teclado ao destino ------------------------------------
  await scrollToProgress(page, 0.3);
  await page.locator('section[data-explorar-journey] a[href="/atlas"]').focus();
  await settle(page);
  await idle(page);
  const focusProgress = (await state(page)).progress;
  record("focusRevealsDiscovery", { progressAfterFocusingAtlasLink: Number(focusProgress.toFixed(3)) });

  // Saída sem aprisionamento + estilos de rolagem globais -------------------------
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await settle(page);
  await idle(page);
  const exit = await page.evaluate(() => ({
    progress: window.__MICROCOSMOS_CINEMATIC__.getProgress(),
    scrollY: window.scrollY,
    docHeight: document.documentElement.scrollHeight,
    bodyOverflow: getComputedStyle(document.body).overflowY,
    htmlOverflow: getComputedStyle(document.documentElement).overflowY,
    footerVisible: (() => { const f = document.querySelector("footer:last-of-type, body > footer"); if (!f) return false; const r = f.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; })(),
    stageStillSticky: getComputedStyle(document.querySelector("section[data-explorar-journey]").firstElementChild).position,
  }));
  await page.screenshot({ path: `${OUT}/exit-footer-1440.png` });
  record("exit", exit);

  // Back/forward ----------------------------------------------------------------
  await scrollToProgress(page, 0.97);
  const beforeNav = (await state(page)).progress;
  await page.locator('section[data-explorar-journey] a[href="/atlas"]').click();
  await page.waitForURL("**/atlas**", { timeout: 30_000 });
  await page.goBack();
  await page.waitForFunction(() => window.__MICROCOSMOS_CINEMATIC__?.getRenderCount() > 0, null, { timeout: 60_000 });
  await settle(page);
  await idle(page);
  const afterBack = (await state(page)).progress;
  record("backForward", { before: Number(beforeNav.toFixed(3)), afterBack: Number(afterBack.toFixed(3)), restored: Math.abs(afterBack - beforeNav) < 0.03 });

  // Montar/desmontar: sem vazamento de canvas/geometrias --------------------------
  const mountCycles = [];
  for (let cycle = 0; cycle < 4; cycle += 1) {
    await page.goto(`${BASE}/atlas`, { waitUntil: "domcontentloaded" });
    await page.goto(URL_Q, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__MICROCOSMOS_CINEMATIC__?.getRenderCount() > 0, null, { timeout: 60_000 });
    mountCycles.push(await page.evaluate(() => ({
      canvases: document.querySelectorAll("canvas").length,
      geometries: window.__MICROCOSMOS_CINEMATIC__.getMetrics().geometries,
      textures: window.__MICROCOSMOS_CINEMATIC__.getMetrics().textures,
      heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
    })));
  }
  record("mountUnmount", mountCycles);

  }

  if (want("perf")) {
  // Desempenho durante rolagem contínua (software GL — não é GPU física) ---------
  await scrollToProgress(page, 0);
  await page.mouse.move(720, 450);
  await page.evaluate(() => {
    window.__frames = [];
    let last = performance.now();
    const loop = (now) => { window.__frames.push(now - last); last = now; if (window.__measuring) requestAnimationFrame(loop); };
    window.__measuring = true;
    requestAnimationFrame(loop);
  });
  for (let step = 0; step < 60; step += 1) {
    await page.mouse.wheel(0, 80);
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(300);
  const perf = await page.evaluate(() => {
    window.__measuring = false;
    const frames = [...window.__frames].sort((a, b) => a - b);
    const metrics = window.__MICROCOSMOS_CINEMATIC__.getMetrics();
    return {
      frames: frames.length,
      avgFrameMs: Number((frames.reduce((a, b) => a + b, 0) / frames.length).toFixed(1)),
      p95FrameMs: Number(frames[Math.floor(frames.length * 0.95)].toFixed(1)),
      renders: metrics.renders,
      avgRenderCpuMs: metrics.averageRenderCpuMs,
      p95RenderCpuMs: metrics.p95RenderCpuMs,
      drawCalls: metrics.calls,
      triangles: metrics.triangles,
      geometries: metrics.geometries,
      textures: metrics.textures,
      pixelRatio: metrics.pixelRatio,
    };
  });
  record("performance", { ...perf, note: "Frame data from headless software rendering; must not be presented as GPU performance." });

  }

  if (want("device")) {
  // 9.5 — responsivo -------------------------------------------------------------
  const viewports = [
    { name: "desktop-1440", width: 1440, height: 900 },
    { name: "desktop-1280", width: 1280, height: 800 },
    { name: "tablet-768", width: 768, height: 1024 },
    { name: "mobile-390", width: 390, height: 844 },
    { name: "mobile-320", width: 320, height: 568 },
  ];
  const responsive = {};
  for (const vp of viewports) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const p = await open(ctx);
    const checks = {};
    for (const progress of [0, 0.5, 1]) {
      await scrollToProgress(p, progress);
      await p.screenshot({ path: `${OUT}/responsive-${vp.name}-${pct(progress)}.png` });
      checks[progress] = await p.evaluate(() => ({
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
        revealedLinksInViewport: [...document.querySelectorAll('section[data-explorar-journey] [data-hotspot-id]')].filter((a) => {
          const r = a.getBoundingClientRect();
          const overlay = a.closest("[data-active]");
          return Number(getComputedStyle(overlay).opacity) > 0.5 && r.bottom > 0 && r.top < innerHeight && r.width > 0;
        }).length,
      }));
    }
    responsive[vp.name] = checks;
    await ctx.close();
  }
  record("responsive", responsive);

  // Gesto de rolagem por toque (emulação CDP — não é teste em aparelho físico) --------
  const touchContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  });
  const touchPage = await open(touchContext);
  const cdp = await touchContext.newCDPSession(touchPage);
  // Eventos de toque reais (touchStart/touchMove/touchEnd) pelo pipeline de entrada do Chromium.
  const swipe = async (fromY, toY) => {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 195, y: fromY }] });
    const steps = 12;
    for (let i = 1; i <= steps; i += 1) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 195, y: fromY + ((toY - fromY) * i) / steps }] });
      await touchPage.waitForTimeout(16);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  const touchTrace = [];
  for (let step = 0; step < 6; step += 1) {
    await swipe(720, 160);
    await settle(touchPage);
    await caughtUp(touchPage);
    touchTrace.push({ scrollY: await touchPage.evaluate(() => Math.round(window.scrollY)), progress: Number((await state(touchPage)).progress.toFixed(3)) });
  }
  await touchPage.screenshot({ path: `${OUT}/touch-forward-390.png` });
  await swipe(160, 760);
  await settle(touchPage);
  await caughtUp(touchPage);
  const touchBack = { scrollY: await touchPage.evaluate(() => Math.round(window.scrollY)), progress: Number((await state(touchPage)).progress.toFixed(3)) };
  await touchPage.screenshot({ path: `${OUT}/touch-reverse-390.png` });
  record("touch", { emulation: "CDP Input.dispatchTouchEvent in an isMobile/hasTouch context — emulation, not a physical device", forwardTrace: touchTrace, afterReverseSwipe: touchBack });
  await touchContext.close();

  }

  if (want("fallback")) {
  // Movimento reduzido ---------------------------------------------------------------
  const reducedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const reducedPage = await reducedContext.newPage();
  await reducedPage.goto(URL_Q, { waitUntil: "networkidle" });
  await reducedPage.waitForTimeout(800);
  const reduced = await reducedPage.evaluate(() => ({
    canvases: document.querySelectorAll("canvas").length,
    journeyDisplay: getComputedStyle(document.querySelector("section[data-explorar-journey]")).display,
    staticDisplay: getComputedStyle(document.querySelector("[data-static-view]")).display,
    links: [...document.querySelectorAll("[data-static-view] a[href]")].map((a) => a.getAttribute("href")),
    debugHandle: Boolean(window.__MICROCOSMOS_CINEMATIC__),
    bodyOverflow: getComputedStyle(document.body).overflowY,
  }));
  await reducedPage.screenshot({ path: `${OUT}/reduced-motion-390.png`, fullPage: true });
  record("reducedMotion", reduced);
  await reducedContext.close();

  const reducedDesktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const rdPage = await reducedDesktop.newPage();
  await rdPage.goto(URL_Q, { waitUntil: "networkidle" });
  await rdPage.waitForTimeout(800);
  await rdPage.screenshot({ path: `${OUT}/reduced-motion-1440.png` });
  await reducedDesktop.close();

  // WebGL indisponível -------------------------------------------------------------------
  const noGlContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await noGlContext.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function patched(type, ...args) {
      if (String(type).startsWith("webgl") || type === "experimental-webgl") return null;
      return original.call(this, type, ...args);
    };
  });
  const noGlPage = await noGlContext.newPage();
  await noGlPage.goto(URL_Q, { waitUntil: "networkidle" });
  await noGlPage.getByText("Modo estático").waitFor({ state: "visible", timeout: 20_000 });
  await noGlPage.waitForTimeout(500);
  record("noWebgl", await noGlPage.evaluate(() => ({
    staticVisible: getComputedStyle(document.querySelector("[data-static-view]")).display !== "none",
    journeyHidden: getComputedStyle(document.querySelector("section[data-explorar-journey]")).display === "none",
    links: [...document.querySelectorAll("[data-static-view] a[href]")].map((a) => a.getAttribute("href")),
  })));
  await noGlPage.screenshot({ path: `${OUT}/fallback-no-webgl-1440.png` });
  await noGlContext.close();

  // Escolha do visitante: versão sem movimento ---------------------------------------------
  await page.goto(URL_Q, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Versão sem movimento" }).click();
  await page.waitForTimeout(600);
  record("userStaticToggle", await page.evaluate(() => ({
    canvases: document.querySelectorAll("canvas").length,
    resumeButton: Boolean([...document.querySelectorAll("button")].find((b) => b.textContent?.includes("Ativar travessia"))),
  })));

  // A homepage não carrega o motor 3D ----------------------------------------------------------
  const homeContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const homePage = await homeContext.newPage();
  const scripts = [];
  homePage.on("response", (response) => { if (response.url().endsWith(".js") || response.url().includes("/_next/static/chunks")) scripts.push(response.url()); });
  await homePage.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await homePage.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await homePage.waitForTimeout(1500);
  const offenders = [];
  for (const url of new Set(scripts)) {
    const text = await homePage.evaluate((u) => fetch(u).then((r) => r.text()).catch(() => ""), url);
    if (/WebGLRenderer|PMREMGenerator|RoomEnvironment/.test(text)) offenders.push(url);
  }
  record("homepageNo3dEngine", { scriptsChecked: new Set(scripts).size, enginedChunks: offenders, canvases: await homePage.evaluate(() => document.querySelectorAll("canvas").length) });
  await homeContext.close();

  }

  if (want("video")) {
  // Demonstração em vídeo (rolagem real: avança, para, retrocede, avança) ----------------------
  const videoContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: `${OUT}/video`, size: { width: 1280, height: 800 } },
  });
  const videoPage = await open(videoContext);
  await videoPage.mouse.move(640, 400);
  const wheelSeries = async (count, delta, gap) => { for (let i = 0; i < count; i += 1) { await videoPage.mouse.wheel(0, delta); await videoPage.waitForTimeout(gap); } };
  await videoPage.waitForTimeout(800);
  await wheelSeries(26, 110, 90); // avança lentamente
  await videoPage.waitForTimeout(2200); // pára: a cena permanece estável
  await wheelSeries(18, -110, 90); // retrocede
  await videoPage.waitForTimeout(1200);
  await wheelSeries(44, 130, 80); // avança até o fim
  await videoPage.waitForTimeout(1800);
  report.checks.video = { progressAtEnd: Number((await state(videoPage)).progress.toFixed(3)) };
  await videoContext.close();
  }

  await browser.close();

  await writeFile(`${OUT}/qa-scrub-metrics.json`, JSON.stringify(report, null, 2));
  console.log("\nconsole errors:", report.consoleErrors.length, "page errors:", report.pageErrors.length);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
