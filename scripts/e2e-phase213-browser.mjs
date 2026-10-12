// Phase 2.1.3 — real-browser E2E + accessibility + responsive QA against a running production build
// that talks to the LOCAL Supabase stack (see scripts/e2e-local-setup.mjs).
//
//   APP_URL=http://localhost:3100 node scripts/e2e-phase213-browser.mjs
//
// Needs a Chromium: uses CHROME_PATH or the system Chrome. Playwright is not a project dependency:
// PLAYWRIGHT_CORE may point at any installed playwright-core (defaults to the @playwright/mcp npx cache).
// axe-core is read from AXE_PATH (a scratch install; not shipped with the app).
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const playwrightPath = process.env.PLAYWRIGHT_CORE ?? "C:/Users/Home/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright-core";
const { chromium } = require(playwrightPath);
const axeSource = readFileSync(process.env.AXE_PATH ?? "axe.min.js", "utf8");
const chromePath = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

const env = Object.fromEntries(readFileSync(".env.e2e.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(env.LOCAL_SUPABASE_URL)) throw new Error("Somente Supabase local.");
const app = process.env.APP_URL ?? "http://localhost:3100";
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(app)) throw new Error("Somente app local.");
const outDir = "docs/evidence/phase213/browser";
mkdirSync(outDir, { recursive: true });

const results = [];
const findings = [];
function check(name, ok, detail = "") {
  results.push({ name, ok: Boolean(ok), detail: String(detail).slice(0, 300) });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${String(detail).slice(0, 160)}` : ""}`);
}

const viewports = [
  { label: "desktop-1440", width: 1440, height: 900 },
  { label: "tablet-768", width: 768, height: 1024 },
  { label: "mobile-390", width: 390, height: 844 },
  { label: "reflow-320", width: 320, height: 640 },
];

// ---------------------------------------------------------------- fixtures
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const ownerClient = createClient(env.LOCAL_SUPABASE_URL, env.LOCAL_PUBLISHABLE_KEY, opts);
const ownerLogin = await ownerClient.auth.signInWithPassword({ email: env.E2E_OWNER_EMAIL, password: env.E2E_OWNER_PASSWORD });
if (ownerLogin.error) throw new Error(ownerLogin.error.message);
const uid = ownerLogin.data.user.id;
const run = randomUUID().slice(0, 6);
const dir = join(tmpdir(), `mc-e2e-${run}`);
mkdirSync(dir, { recursive: true });
const goodPng = join(dir, "capa.png");
await sharp({ create: { width: 1600, height: 1000, channels: 3, background: "#4a9" } })
  .composite([{ input: await sharp({ create: { width: 800, height: 500, channels: 3, background: "#e5cbff" } }).png().toBuffer(), left: 400, top: 250 }]).png().toFile(goodPng);
const fakePng = join(dir, "falso.png"); writeFileSync(fakePng, "isto nao e uma imagem");
const corruptPng = join(dir, "corrompido.png"); writeFileSync(corruptPng, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), randomBytes(2048)]));
const hugePng = join(dir, "enorme.png"); writeFileSync(hugePng, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), randomBytes(7 * 1024 * 1024)]));

const { data: cat } = await ownerClient.from("categories").select("id").eq("slug", "protozoarios").single();
const png = await sharp(goodPng).resize(1200).webp().toBuffer();
const key = `${randomUUID()}/${randomUUID()}.webp`;
await ownerClient.storage.from("post-media").upload(key, png, { contentType: "image/webp" });
const pubMedia = (await ownerClient.from("media_assets").insert({ owner_id: uid, object_key: key, mime_type: "image/webp", bytes: png.length, width: 1200, height: 750, alt_text: "Campo microscópico verde com um retângulo lilás ao centro", credit: "Imagem de teste", sha256: "d".repeat(64) }).select("id").single()).data;
const longBody = Array.from({ length: 6 }, (_, i) => `Parágrafo ${i + 1} do artigo de verificação ${run}. `.repeat(6).trim()).join("\n\n");
const pubPost = (await ownerClient.from("posts").insert({
  slug: `qa-publicado-${run}`, title: `Artigo publicado de verificação ${run}`, excerpt: "Resumo do artigo de verificação para auditoria de acessibilidade e responsividade.",
  body_json: longBody.split("\n\n"), category_id: cat.id, hero_media_id: pubMedia.id, author_user_id: uid,
}).select("id,slug,title").single()).data;
await ownerClient.rpc("publish_post", { target_post_id: pubPost.id });
// Warm the public caches through the real publish action path is covered by verify-phase213-publish-cache.mjs;
// here we only need the page to render, which ISR does on demand.

// ---------------------------------------------------------------- helpers
const browser = await chromium.launch({ executablePath: chromePath, headless: true });

async function runAxe(page, label) {
  await page.addScriptTag({ content: axeSource });
  const report = await page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const r = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] }, resultTypes: ["violations", "incomplete"] });
    const simplify = (items) => items.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 4).map((n) => ({ target: n.target.join(" "), summary: (n.failureSummary ?? "").split("\n").slice(0, 3).join(" | ") })), count: v.nodes.length }));
    return { violations: simplify(r.violations), incomplete: simplify(r.incomplete) };
  });
  const serious = report.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  check(`axe · ${label} · sem violações sérias/críticas`, serious.length === 0, serious.map((v) => `${v.id}×${v.count}`).join(", "));
  const others = report.violations.filter((v) => !serious.includes(v));
  if (others.length) findings.push({ page: label, kind: "axe-minor", items: others });
  if (serious.length) findings.push({ page: label, kind: "axe-serious", items: serious });
  if (report.incomplete.length) findings.push({ page: label, kind: "axe-incomplete(manual-review)", items: report.incomplete.map((i) => ({ id: i.id, count: i.count })) });
  return report;
}

async function layoutChecks(page, label) {
  const info = await page.evaluate(() => {
    const doc = document.documentElement;
    const overflowX = doc.scrollWidth - doc.clientWidth;
    const interactive = [...document.querySelectorAll("a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [tabindex]:not([tabindex='-1'])")];
    const small = [];
    for (const el of interactive) {
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const clip = getComputedStyle(el).clip;
      if (el.closest(".visually-hidden") || (r.width <= 1 && r.height <= 1)) continue;
      // Stretched links: the ::after box (absolute, inset) makes the whole card the pointer target.
      const stretched = getComputedStyle(el, "::after").position === "absolute" && (() => { const a = el.closest("article"); const ar = a?.getBoundingClientRect(); return !!ar && ar.width >= 24 && ar.height >= 24; })();
      if (!stretched && (r.width < 24 || r.height < 24)) {
        const inline = style.display === "inline" && !!el.closest("p, li, span, figcaption, label");
        small.push({ tag: el.tagName.toLowerCase(), text: (el.textContent || el.getAttribute("aria-label") || el.getAttribute("name") || "").trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height), inline, id: el.id || undefined, cls: String(el.className).slice(0, 40) });
      }
    }
    const h1 = document.querySelectorAll("h1").length;
    const imgsNoAlt = [...document.querySelectorAll("img")].filter((i) => !i.hasAttribute("alt")).length;
    const lang = doc.lang;
    return { overflowX, small, h1, imgsNoAlt, lang, title: document.title };
  });
  check(`layout · ${label} · sem rolagem horizontal`, info.overflowX <= 0, `overflow=${info.overflowX}px`);
  const bad = info.small.filter((s) => !s.inline);
  check(`alvos · ${label} · nenhum controle <24px (exceto inline)`, bad.length === 0, JSON.stringify(bad.slice(0, 3)));
  if (bad.length) findings.push({ page: label, kind: "target-size", items: bad });
  check(`semântica · ${label} · um h1, lang pt-BR, imagens com alt`, info.h1 === 1 && info.lang === "pt-BR" && info.imgsNoAlt === 0, `h1=${info.h1} lang=${info.lang} semAlt=${info.imgsNoAlt}`);
  return info;
}

async function keyboardWalk(page, label, max = 60) {
  await page.evaluate(() => { document.activeElement?.blur?.(); window.scrollTo(0, 0); });
  const seen = [];
  let invisible = 0;
  const invisibleNames = [];
  for (let i = 0; i < max; i += 1) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const outline = s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 2;
      const shadow = s.boxShadow !== "none";
      const pseudo = ["::after", "::before"].some((p) => { const ps = getComputedStyle(el, p); return ps.outlineStyle !== "none" && parseFloat(ps.outlineWidth) >= 2; });
      const inView = r.bottom > 0 && r.top < window.innerHeight;
      return { tag: el.tagName.toLowerCase(), name: (el.getAttribute("aria-label") || el.textContent || el.getAttribute("name") || el.id || "").trim().slice(0, 40), visible: outline || shadow || pseudo, inView, w: Math.round(r.width), h: Math.round(r.height) };
    });
    if (!info) { if (seen.length > 3) break; continue; }
    if (seen.length && seen[0].tag === info.tag && seen[0].name === info.name && i > 2) break;
    if (!info.visible) { invisible += 1; invisibleNames.push(`${info.tag}:${info.name}`); }
    seen.push(info);
  }
  check(`teclado · ${label} · ordem percorrida sem armadilha (${seen.length} paradas)`, seen.length >= 3 && seen.length < max);
  check(`foco visível · ${label} · todos os elementos focados exibem indicador`, invisible === 0, `${invisible} sem indicador: ${invisibleNames.join(" | ")}`);
  return seen;
}

async function shot(page, name) {
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: true });
}

async function openContext(vp, extra = {}) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, locale: "pt-BR", ...extra });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${String(e).slice(0, 200)}`));
  return { context, page, consoleErrors };
}

async function login(page) {
  await page.goto(`${app}/admin/login`, { waitUntil: "load" });
  await page.getByLabel("E-mail").fill(env.E2E_OWNER_EMAIL);
  await page.getByLabel("Senha").fill(env.E2E_OWNER_PASSWORD);
  await Promise.all([page.waitForURL(`${app}/admin`, { timeout: 20000 }), page.getByRole("button", { name: "Entrar" }).click()]);
}

// ================================================================ 1. PUBLIC PAGES × VIEWPORTS
for (const vp of viewports) {
  const { context, page, consoleErrors } = await openContext(vp);
  for (const [name, path] of [["home", "/"], ["diario", "/diario"], ["artigo", `/diario/${pubPost.slug}`]]) {
    const label = `${name} ${vp.label}`;
    const response = await page.goto(`${app}${path}`, { waitUntil: "load" });
    check(`público · ${label} · HTTP 200`, response?.status() === 200, `HTTP ${response?.status()}`);
    await page.waitForTimeout(400);
    await layoutChecks(page, label);
    if (vp.label !== "reflow-320" || name === "artigo") await runAxe(page, label);
    await shot(page, `public-${name}-${vp.label}`);
    if (name === "artigo") {
      const img = await page.evaluate(() => { const i = document.querySelector("article img"); return i ? { loaded: i.complete && i.naturalWidth > 0, w: i.naturalWidth, alt: i.alt } : null; });
      check(`artigo · ${vp.label} · imagem de capa carregada com alt`, img?.loaded && img.alt.length > 3, JSON.stringify(img));
    }
  }
  check(`console · público ${vp.label} · sem erros`, consoleErrors.length === 0, consoleErrors.join(" | "));
  if (vp.label === "desktop-1440") {
    await page.goto(`${app}/`, { waitUntil: "load" });
    await keyboardWalk(page, "home", 400);
    await page.goto(`${app}/diario/${pubPost.slug}`, { waitUntil: "load" });
    await keyboardWalk(page, "artigo", 60);
  }
  await context.close();
}

// ================================================================ 2. REDUCED MOTION
{
  const { context, page } = await openContext(viewports[0], { reducedMotion: "reduce" });
  await page.goto(`${app}/`, { waitUntil: "load" });
  await page.waitForTimeout(600);
  const reduced = await page.evaluate(() => {
    const running = document.getAnimations().filter((a) => a.playState === "running" && (a.effect?.getComputedTiming().iterations === Infinity));
    const smooth = getComputedStyle(document.documentElement).scrollBehavior;
    let longTransitions = 0;
    for (const el of document.querySelectorAll("*")) {
      const s = getComputedStyle(el);
      const dur = parseFloat(s.transitionDuration.split(",")[0]) || 0;
      const anim = parseFloat(s.animationDuration.split(",")[0]) || 0;
      if (dur > 0.05 || anim > 0.05) longTransitions += 1;
    }
    return { infinite: running.map((a) => a.id || a.constructor.name).slice(0, 5), smooth, longTransitions };
  });
  check("reduced-motion · sem animações infinitas em execução", reduced.infinite.length === 0, JSON.stringify(reduced.infinite));
  check("reduced-motion · scroll-behavior automático", reduced.smooth === "auto", reduced.smooth);
  check("reduced-motion · transições/animações reduzidas a ~0", reduced.longTransitions === 0, `${reduced.longTransitions} elementos ainda animam`);
  await context.close();
}

// ================================================================ 2b. AUTOMATIC MOTION ≤ 5 s (WCAG 2.2.2)
{
  const { context, page } = await openContext(viewports[0], { reducedMotion: "no-preference" });
  await page.goto(`${app}/`, { waitUntil: "load" });
  await page.waitForTimeout(500);
  const motion = await page.evaluate(() => document.getAnimations().map((a) => {
    const t = a.effect.getComputedTiming();
    const target = a.effect.target;
    return { end: t.endTime, target: target?.className?.toString().slice(0, 30) ?? "" };
  }));
  const longest = motion.reduce((m, a) => Math.max(m, a.end === Infinity ? 1e9 : a.end), 0);
  check("movimento automático · nenhuma animação passa de 5 s nem é infinita", longest <= 5000, `${motion.length} animações; mais longa ${longest === 1e9 ? "infinita" : Math.round(longest) + " ms"}`);
  await context.close();
}

// ================================================================ 3. ADMIN LOGIN × VIEWPORTS (anonymous)
for (const vp of viewports) {
  const { context, page } = await openContext(vp);
  const response = await page.goto(`${app}/admin`, { waitUntil: "load" });
  check(`admin anônimo · ${vp.label} · /admin redireciona ao login`, new URL(page.url()).pathname === "/admin/login", page.url());
  void response;
  await layoutChecks(page, `login ${vp.label}`);
  await runAxe(page, `login ${vp.label}`);
  await shot(page, `admin-login-${vp.label}`);
  if (vp.label === "desktop-1440") {
    // Wrong credentials: message, focus, e-mail preserved.
    await page.getByLabel("E-mail").fill("pessoa@example.test");
    await page.getByLabel("Senha").fill("senha-incorreta-123");
    await page.getByRole("button", { name: "Entrar" }).click();
    const alert = page.locator("p.admin-error[role=alert]");
    await alert.waitFor({ timeout: 15000 });
    check("login · credenciais inválidas → alerta em português", /inválidos/.test(await alert.innerText()));
    check("login · e-mail digitado é preservado após erro", (await page.getByLabel("E-mail").inputValue()) === "pessoa@example.test");
    check("login · foco vai para a mensagem de erro", await page.evaluate(() => document.activeElement?.matches("p.admin-error[role=alert]")));
    await keyboardWalk(page, "login", 12);
    // Empty submit → field-level errors.
    await page.getByLabel("E-mail").fill("");
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.getByText("Informe um e-mail válido.").first().waitFor({ timeout: 15000 });
    check("login · e-mail vazio → erro por campo associado (aria-describedby)", await page.getByLabel("E-mail").getAttribute("aria-describedby") === "email-error");
    await shot(page, "admin-login-error-desktop-1440");
  }
  await context.close();
}

// ================================================================ 4. OWNER FLOW (desktop) — full editorial lifecycle
const ownerVp = viewports[0];
{
  const { context, page, consoleErrors } = await openContext(ownerVp);
  await login(page);
  check("login do proprietário → painel", new URL(page.url()).pathname === "/admin");
  await layoutChecks(page, "painel desktop-1440");
  await runAxe(page, "painel desktop-1440");
  await shot(page, "admin-dashboard-desktop-1440");

  // Create: validation first.
  await page.getByRole("link", { name: "Nova publicação" }).click();
  await page.waitForURL("**/admin/posts/new");
  await layoutChecks(page, "novo-rascunho desktop-1440");
  await page.getByLabel("Título", { exact: true }).fill("ab");
  await page.getByLabel("Resumo").fill("curto");
  await page.getByRole("button", { name: "Criar rascunho" }).click();
  await page.getByText("Revise os campos destacados.").waitFor({ timeout: 15000 });
  check("validação · erro por campo em português (título, resumo, categoria, conteúdo)", (await page.locator(".admin-field-error").allInnerTexts()).length >= 4, (await page.locator(".admin-field-error").allInnerTexts()).join(" / "));
  check("validação · texto digitado NÃO é descartado após erro", (await page.getByLabel("Título", { exact: true }).inputValue()) === "ab" && (await page.getByLabel("Resumo").inputValue()) === "curto");
  check("validação · campo inválido marcado com aria-invalid", (await page.getByLabel("Título", { exact: true }).getAttribute("aria-invalid")) === "true");
  await shot(page, "admin-new-validation-desktop-1440");

  const title = `Rascunho E2E ${run}`;
  await page.getByLabel("Título", { exact: true }).fill(title);
  await page.getByLabel("Resumo").fill("Resumo do rascunho criado pelo teste de ponta a ponta do CMS.");
  await page.getByLabel("Categoria").selectOption({ label: "Diagnóstico" });
  await page.getByLabel("Conteúdo", { exact: true }).fill("Primeiro parágrafo do rascunho.\n\nSegundo parágrafo, separado por linha em branco.");
  check("editor · prévia ao vivo mostra 2 parágrafos", (await page.locator(".editor-preview p").count()) === 2);
  // Double-click guard: two rapid clicks must create exactly one post.
  await page.getByRole("button", { name: "Criar rascunho" }).dblclick();
  await page.waitForURL("**/admin/posts/*/edit*", { timeout: 20000 });
  check("criar rascunho · redireciona ao editor com aviso de sucesso", await page.getByText("Rascunho criado.").isVisible());
  const postId = page.url().match(/posts\/([0-9a-f-]{36})\/edit/)[1];
  const dupes = await ownerClient.from("posts").select("id").eq("title", title);
  check("criar rascunho · duplo clique cria um único rascunho", dupes.data?.length === 1, `n=${dupes.data?.length}`);
  await layoutChecks(page, "editor desktop-1440");
  await runAxe(page, "editor desktop-1440");
  await shot(page, "admin-editor-desktop-1440");

  // Upload: invalid files first.
  const upload = async (file, alt = "Campo microscópico verde com retângulo lilás", credit = "Teste E2E") => {
    await page.getByLabel("Texto alternativo (descrição da imagem)").fill(alt);
    await page.getByLabel("Crédito ou atribuição").fill(credit);
    await page.getByLabel("Arquivo de imagem").setInputFiles(file);
    await page.getByRole("button", { name: /Enviar imagem|Substituir imagem/ }).click();
  };
  await upload(fakePng);
  await page.getByText("Formato não aceito").or(page.getByText("O arquivo não é uma imagem")).first().waitFor({ timeout: 15000 });
  check("upload · arquivo de texto com extensão .png é recusado com mensagem clara", true);
  await upload(hugePng);
  await page.getByText("maior que 6 MB").first().waitFor({ timeout: 15000 });
  check("upload · arquivo >6 MB é recusado antes do envio", true);
  await upload(corruptPng);
  await page.getByText(/corrompida|não é uma imagem JPEG/).first().waitFor({ timeout: 20000 });
  check("upload · PNG corrompido é recusado pelo servidor sem expor detalhes", !/sharp|vips|stack|Error:/i.test(await page.locator(".image-uploader .admin-error").innerText()));
  // Missing alt text.
  await page.getByLabel("Texto alternativo (descrição da imagem)").fill("");
  await page.getByLabel("Arquivo de imagem").setInputFiles(goodPng);
  await page.getByRole("button", { name: "Enviar imagem" }).click();
  await page.getByText("Descreva a imagem").first().waitFor({ timeout: 5000 });
  check("upload · sem texto alternativo → pedido de descrição e foco no campo", await page.evaluate(() => document.activeElement?.id === "image-alt"));
  // Network interruption mid-upload → recoverable.
  await page.getByLabel("Texto alternativo (descrição da imagem)").fill("Campo microscópico verde com retângulo lilás");
  await context.setOffline(true);
  await page.getByRole("button", { name: "Enviar imagem" }).click();
  await page.getByText("Sem conexão").waitFor({ timeout: 15000 });
  check("upload · rede interrompida → mensagem de recuperação e botão reabilitado", await page.getByRole("button", { name: "Enviar imagem" }).isEnabled());
  await context.setOffline(false);
  await page.getByRole("button", { name: "Enviar imagem" }).click();
  await page.locator("img.admin-image-preview").waitFor({ timeout: 30000 });
  check("upload · retry após reconexão publica a prévia privada", true);
  await page.waitForFunction(() => { const i = document.querySelector("img.admin-image-preview"); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 15000 });
  check("upload · prévia privada carrega via rota autenticada", true);
  await shot(page, "admin-editor-uploaded-desktop-1440");

  // Save + unsaved-changes hint.
  await page.getByLabel("Título", { exact: true }).fill(`${title} (editado)`);
  check("editor · aviso de alterações não salvas", await page.getByText("Alterações ainda não salvas.").isVisible());
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await page.getByText("Rascunho salvo.").waitFor({ timeout: 15000 });
  check("salvar rascunho · feedback acessível (role=status)", (await page.getByRole("status").filter({ hasText: "Rascunho salvo." }).count()) === 1);
  await page.reload({ waitUntil: "load" });
  check("recarregar · título e imagem persistem", (await page.getByLabel("Título", { exact: true }).inputValue()).endsWith("(editado)") && (await page.locator("img.admin-image-preview").count()) === 1);

  // Private preview.
  await page.getByRole("link", { name: "Prévia privada" }).click();
  await page.waitForURL("**/preview");
  await layoutChecks(page, "prévia desktop-1440");
  check("prévia privada · mostra título, imagem e estado", await page.getByRole("heading", { level: 1 }).innerText().then((t) => t.includes("(editado)")) && (await page.locator("figure img").count()) === 1);
  await shot(page, "admin-preview-desktop-1440");
  await page.goBack();

  // Session expiry: cookies cleared → save keeps text and explains.
  const cookies = await context.cookies();
  await context.clearCookies();
  await page.getByLabel("Título", { exact: true }).fill(`${title} (sessão)`);
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await page.getByText("Sua sessão expirou").first().waitFor({ timeout: 15000 });
  check("sessão expirada · aviso claro e texto digitado preservado", (await page.getByLabel("Título", { exact: true }).inputValue()).endsWith("(sessão)"));
  await context.addCookies(cookies);

  // Publish → public → edit → unpublish → republish → delete.
  await page.reload({ waitUntil: "load" });
  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  await page.getByText("Publicação no ar.").waitFor({ timeout: 20000 });
  check("publicar · aviso de sucesso e link 'Ver no site'", await page.getByRole("link", { name: "Ver no site" }).isVisible());
  const slug = (await ownerClient.from("posts").select("slug").eq("id", postId).single()).data.slug;
  const pub = await context.request.get(`${app}/diario/${slug}`);
  check("publicar · artigo disponível no site sem rebuild", pub.status() === 200, `HTTP ${pub.status()}`);
  const diary = await (await context.request.get(`${app}/diario`)).text();
  check("publicar · aparece em /diario", diary.includes("(sessão)") || diary.includes("(editado)"));

  await page.getByLabel("Título", { exact: true }).fill(`${title} (v2)`);
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await page.getByText("Alterações salvas e publicadas.").waitFor({ timeout: 15000 });
  const v2 = await (await context.request.get(`${app}/diario/${slug}`)).text();
  check("editar publicado · alteração visível imediatamente", v2.includes("(v2)"));

  await page.getByRole("button", { name: "Retirar do ar" }).click();
  await page.getByText("Publicação retirada do ar.").waitFor({ timeout: 20000 });
  const gone = await context.request.get(`${app}/diario/${slug}`);
  check("despublicar · artigo some imediatamente (404)", gone.status() === 404, `HTTP ${gone.status()}`);
  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  await page.getByText("Publicação no ar.").waitFor({ timeout: 20000 });
  check("republicar · volta ao ar", (await context.request.get(`${app}/diario/${slug}`)).status() === 200);

  // Delete: wrong confirmation, then right.
  await page.getByLabel("Confirmação").fill("excluir");
  await page.getByRole("button", { name: "Excluir", exact: true }).click();
  await page.getByText("em maiúsculas").waitFor({ timeout: 15000 });
  check("excluir · confirmação errada → mensagem e nada é excluído", (await ownerClient.from("posts").select("status").eq("id", postId).single()).data.status === "published");
  await page.getByLabel("Confirmação").fill("EXCLUIR");
  await page.getByRole("button", { name: "Excluir", exact: true }).click();
  await page.waitForURL(`${app}/admin?deleted=1`, { timeout: 20000 });
  check("excluir · volta ao painel com aviso", await page.getByText("Publicação excluída.").isVisible());
  check("excluir · artigo 404 e linha preservada (exclusão lógica)", (await context.request.get(`${app}/diario/${slug}`)).status() === 404 && (await ownerClient.from("posts").select("status").eq("id", postId).single()).data.status === "deleted");

  // Logout invalidates the session.
  await page.getByRole("button", { name: "Sair" }).click();
  await page.waitForURL("**/admin/login", { timeout: 15000 });
  await page.goto(`${app}/admin`, { waitUntil: "load" });
  check("sair · /admin volta a exigir login", new URL(page.url()).pathname === "/admin/login");
  check("console · fluxo do proprietário sem erros inesperados", consoleErrors.filter((e) => !/^Failed to load resource/.test(e)).length === 0, consoleErrors.join(" | "));
  await context.close();
}

// ================================================================ 5. OWNER RESPONSIVE (tablet, mobile, reflow)
for (const vp of viewports.slice(1)) {
  const { context, page } = await openContext(vp);
  await login(page);
  await layoutChecks(page, `painel ${vp.label}`);
  await runAxe(page, `painel ${vp.label}`);
  await shot(page, `admin-dashboard-${vp.label}`);
  await page.goto(`${app}/admin/posts/${pubPost.id}/edit`, { waitUntil: "load" });
  await layoutChecks(page, `editor ${vp.label}`);
  await runAxe(page, `editor ${vp.label}`);
  await shot(page, `admin-editor-${vp.label}`);
  if (vp.label === "mobile-390") await keyboardWalk(page, "editor mobile", 45);
  await context.close();
}

// ================================================================ summary
await browser.close();
const failed = results.filter((r) => !r.ok);
writeFileSync(`${outDir}/results.json`, JSON.stringify({ at: new Date().toISOString(), app, total: results.length, failed: failed.length, results, findings }, null, 2));
console.log(`\n${results.length - failed.length}/${results.length} PASS · ${findings.length} grupos de achados em ${outDir}/results.json`);
if (failed.length) { console.log("FALHAS:\n - " + failed.map((f) => `${f.name} (${f.detail})`).join("\n - ")); process.exit(1); }
