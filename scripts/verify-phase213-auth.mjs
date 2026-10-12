// Phase 2.1.3 — real Auth + PostgREST + Storage + app-HTTP probe for an AUTHENTICATED NON-OWNER.
//
// Local (default):  node scripts/verify-phase213-auth.mjs
//   Uses .env.e2e.local (created by scripts/e2e-local-setup.mjs), provisions fixtures with the local
//   owner, then probes as the local non-owner. App must be running at APP_URL (default :3100).
//
// Remote (owner runs this; never paste credentials in chat):
//   TARGET=remote ALLOW_REMOTE=oetwoiuzoniwwtrdnohr NONOWNER_EMAIL=... NONOWNER_PASSWORD=... \
//   APP_URL=http://localhost:3000 node scripts/verify-phase213-auth.mjs
//   Reads NEXT_PUBLIC_SUPABASE_* from .env.local. Creates NO remote data: probes use the existing
//   soft-deleted fixtures (or random UUIDs once they are cleaned up). The non-owner must be a user that
//   is NOT in public.owner_accounts.
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const target = process.env.TARGET === "remote" ? "remote" : "local";
const parseEnv = (file) => (existsSync(file)
  ? Object.fromEntries(readFileSync(file, "utf8").split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]))
  : {});

let url; let key; let nonOwner; let owner = null; let appUrl;
if (target === "local") {
  const env = parseEnv(".env.e2e.local");
  url = env.LOCAL_SUPABASE_URL; key = env.LOCAL_PUBLISHABLE_KEY;
  if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url ?? "")) throw new Error("Rode scripts/e2e-local-setup.mjs primeiro (Supabase local).");
  nonOwner = { email: env.E2E_NONOWNER_EMAIL, password: env.E2E_NONOWNER_PASSWORD };
  owner = { email: env.E2E_OWNER_EMAIL, password: env.E2E_OWNER_PASSWORD };
  appUrl = process.env.APP_URL ?? "http://localhost:3100";
} else {
  const env = { ...parseEnv(".env.local"), ...process.env };
  url = env.NEXT_PUBLIC_SUPABASE_URL; key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (process.env.ALLOW_REMOTE !== "oetwoiuzoniwwtrdnohr" || !url?.includes("oetwoiuzoniwwtrdnohr")) {
    throw new Error("Alvo remoto recusado: defina ALLOW_REMOTE=oetwoiuzoniwwtrdnohr e use o projeto microcosmos.");
  }
  if (url.includes("mrybqbwuebgjjhnojdle")) throw new Error("Projeto de produção da NWK Culture: recusado.");
  nonOwner = { email: process.env.NONOWNER_EMAIL, password: process.env.NONOWNER_PASSWORD };
  if (!nonOwner.email || !nonOwner.password) throw new Error("Defina NONOWNER_EMAIL e NONOWNER_PASSWORD no ambiente.");
  appUrl = process.env.APP_URL ?? "http://localhost:3000";
}

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok: Boolean(ok), detail: String(detail).slice(0, 200) });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${String(detail).slice(0, 140)}` : ""}`);
}
const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const denied = (error) => Boolean(error) && /42501|permission denied|row-level security|not_authorized|JWT|violates/i.test(`${error.code ?? ""} ${error.message ?? ""}`);

// ---------------------------------------------------------------- fixtures (local only)
const fixtures = { draft: null, published: null, unpublished: null };
if (target === "local") {
  const ownerClient = createClient(url, key, opts);
  const login = await ownerClient.auth.signInWithPassword(owner);
  if (login.error) throw new Error(`login do proprietário local: ${login.error.message}`);
  const uid = login.data.user.id;
  const { data: cat } = await ownerClient.from("categories").select("id").eq("slug", "identificacao").single();
  const png = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#2a8" } }).webp().toBuffer();
  const run = randomUUID().slice(0, 8);
  async function makePost(label) {
    const objectKey = `${randomUUID()}/${randomUUID()}.webp`;
    const up = await ownerClient.storage.from("post-media").upload(objectKey, png, { contentType: "image/webp" });
    if (up.error) throw new Error(`upload fixture: ${up.error.message}`);
    const media = await ownerClient.from("media_assets").insert({ owner_id: uid, object_key: objectKey, mime_type: "image/webp", bytes: png.length, width: 64, height: 48, alt_text: `Fixture ${label}`, sha256: "a".repeat(64) }).select("id").single();
    const post = await ownerClient.from("posts").insert({ slug: `fixture-${label}-${run}`, title: `Fixture ${label} ${run}`, excerpt: "Resumo de fixture com tamanho válido.", body_json: ["Parágrafo de fixture."], category_id: cat.id, hero_media_id: media.data.id, author_user_id: uid }).select("id,slug,title").single();
    if (post.error) throw new Error(`post fixture: ${post.error.message}`);
    return { postId: post.data.id, slug: post.data.slug, title: post.data.title, mediaId: media.data.id, objectKey };
  }
  fixtures.draft = await makePost("rascunho");
  fixtures.published = await makePost("publicado");
  fixtures.unpublished = await makePost("despublicado");
  for (const f of [fixtures.published, fixtures.unpublished]) {
    const r = await ownerClient.rpc("publish_post", { target_post_id: f.postId });
    if (r.error) throw new Error(`publish fixture: ${r.error.message}`);
  }
  const r = await ownerClient.rpc("unpublish_post", { target_post_id: fixtures.unpublished.postId });
  if (r.error) throw new Error(`unpublish fixture: ${r.error.message}`);
  // Capture the owner's real Server Action ids from the rendered editor (they are not secret).
  fixtures.ownerClient = ownerClient;
} else {
  // Remote: known soft-deleted QA rows from the Phase 2.1.2 cleanup manifest (may already be cleaned).
  fixtures.draft = { postId: "98a207ba-5289-4801-9e53-08d78dcbd146", slug: "qa-fase-2-1-2-teste-temporario", title: "", mediaId: "8180ee80-a46f-479b-a82f-2d9ee4c18a0a", objectKey: "64735f74-5c82-41fa-a001-406813663c6b/c786d6c9-b51b-46f4-87cd-99c4a02625f3.webp" };
  fixtures.published = { postId: randomUUID(), slug: `inexistente-${randomUUID().slice(0, 6)}`, title: "", mediaId: randomUUID(), objectKey: `${randomUUID()}/${randomUUID()}.webp` };
  fixtures.unpublished = { postId: "e12a49b8-b0ae-45b5-bbf8-a934376359fe", slug: "qa-producao-temporaria", title: "", mediaId: "291e010c-2db8-45af-a3fa-c4081c53b5d1", objectKey: "f65424d0-c1b5-469a-b578-b6183d919d96/934f9a6e-dff2-4013-bcc7-b255f36610ce.webp" };
}

// ---------------------------------------------------------------- real non-owner session
const client = createClient(url, key, opts);
const login = await client.auth.signInWithPassword(nonOwner);
check("login real do não-proprietário (Auth)", !login.error && login.data.session, login.error?.message);
if (login.error) { console.log("Abortando: sem sessão."); process.exit(2); }
const nonOwnerId = login.data.user.id;

const me = await client.rpc("is_active_owner");
check("is_active_owner() = false para o não-proprietário", !me.error && me.data === false, me.error?.message ?? String(me.data));
const owners = await client.from("owner_accounts").select("user_id");
check("owner_accounts: nenhuma linha visível", !owners.error && owners.data.length === 0, owners.error?.message ?? `rows=${owners.data?.length}`);

// Public published content stays readable.
const published = await client.from("posts").select("id,slug,status,published_at").eq("status", "published");
check("conteúdo publicado legível", !published.error, published.error?.message);
if (target === "local") check("post publicado da fixture visível", published.data?.some((p) => p.id === fixtures.published.postId));

// Unpublished content is not reachable.
const all = await client.from("posts").select("id,status");
check("somente posts publicados são visíveis (sem rascunho/despublicado/excluído)", !all.error && all.data.every((p) => p.status === "published"), all.error?.message ?? `n=${all.data?.length}`);
for (const [label, f] of [["rascunho", fixtures.draft], ["despublicado", fixtures.unpublished]]) {
  const one = await client.from("posts").select("id").eq("id", f.postId);
  check(`post ${label} inacessível por id`, !one.error && one.data.length === 0, one.error?.message ?? `rows=${one.data?.length}`);
  const bySlug = await client.from("posts").select("id").eq("slug", f.slug);
  check(`post ${label} inacessível por slug`, !bySlug.error && bySlug.data.length === 0);
  const media = await client.from("media_assets").select("id,object_key").eq("id", f.mediaId);
  check(`mídia de ${label} inacessível`, !media.error && media.data.length === 0, media.error?.message ?? `rows=${media.data?.length}`);
}

// Sensitive columns.
for (const [table, column] of [["posts", "author_user_id"], ["media_assets", "owner_id"], ["media_assets", "sha256"], ["media_assets", "bytes"], ["media_assets", "storage_bucket"]]) {
  const r = await client.from(table).select(column).limit(1);
  check(`coluna sensível ${table}.${column} negada`, denied(r.error), r.error?.code ?? "sem erro");
}
for (const table of ["post_revisions", "audit_events"]) {
  const r = await client.from(table).select("*").limit(1);
  check(`${table} sem leitura`, denied(r.error) || (!r.error && r.data.length === 0), r.error?.code ?? `rows=${r.data?.length}`);
}

// Mutations through PostgREST.
const ins = await client.from("posts").insert({ slug: `nao-${randomUUID().slice(0, 6)}`, title: "Hack", excerpt: "Tentativa de criação.", body_json: ["x"], category_id: (await client.from("categories").select("id").limit(1)).data?.[0]?.id, author_user_id: nonOwnerId });
check("INSERT em posts rejeitado", Boolean(ins.error), ins.error?.code);
const upd = await client.from("posts").update({ title: "Hackeado" }).eq("id", fixtures.published.postId).select("id");
check("UPDATE em post alheio não altera nada", Boolean(upd.error) || (upd.data ?? []).length === 0, upd.error?.code ?? `rows=${upd.data?.length}`);
const upd2 = await client.from("posts").update({ status: "published" }).eq("id", fixtures.draft.postId).select("id");
check("UPDATE de status do rascunho não altera nada", Boolean(upd2.error) || (upd2.data ?? []).length === 0, upd2.error?.code ?? `rows=${upd2.data?.length}`);
const del = await client.from("posts").delete().eq("id", fixtures.published.postId).select("id");
check("DELETE em posts rejeitado", Boolean(del.error) || (del.data ?? []).length === 0, del.error?.code ?? `rows=${del.data?.length}`);
const insMedia = await client.from("media_assets").insert({ owner_id: nonOwnerId, object_key: `${randomUUID()}/${randomUUID()}.webp`, mime_type: "image/webp", bytes: 10, width: 1, height: 1, alt_text: "x", sha256: "b".repeat(64) });
check("INSERT em media_assets rejeitado", Boolean(insMedia.error), insMedia.error?.code);
const insAudit = await client.from("audit_events").insert({ actor_user_id: nonOwnerId, action: "publish", entity_type: "post", entity_id: randomUUID() });
check("INSERT em audit_events rejeitado", Boolean(insAudit.error), insAudit.error?.code);
const insOwner = await client.from("owner_accounts").insert({ user_id: nonOwnerId, active: true });
check("auto-promoção a proprietário rejeitada", Boolean(insOwner.error), insOwner.error?.code);

// RPCs.
const rpcs = [
  ["publish_post", { target_post_id: fixtures.draft.postId }],
  ["unpublish_post", { target_post_id: fixtures.published.postId }],
  ["soft_delete_post", { target_post_id: fixtures.published.postId }],
  ["save_post_changes", { target_post_id: fixtures.published.postId, new_title: "Hack", new_excerpt: "Tentativa de edição.", new_body: ["x"], new_category: randomUUID(), new_hero: null }],
];
for (const [name, args] of rpcs) {
  const r = await client.rpc(name, args);
  check(`RPC ${name} recusada ao não-proprietário`, Boolean(r.error) && /42501|not_authorized|permission denied/i.test(`${r.error.code} ${r.error.message}`), r.error?.code ?? "sem erro");
}

// Storage.
const sign = await client.storage.from("post-media").createSignedUrl(fixtures.draft.objectKey, 60);
check("signed URL de objeto em rascunho negada", Boolean(sign.error), sign.error?.message);
const dl = await client.storage.from("post-media").download(fixtures.draft.objectKey);
check("download de objeto em rascunho negado", Boolean(dl.error), dl.error?.message);
const list = await client.storage.from("post-media").list("", { limit: 100 });
const listedNames = (list.data ?? []).map((item) => item.name);
const privateFolders = [fixtures.draft, fixtures.unpublished].map((f) => f.objectKey.split("/")[0]);
check("listagem do bucket não revela pastas de rascunho/despublicado", !list.error && !listedNames.some((n) => privateFolders.includes(n)), list.error?.message ?? `itens=${listedNames.length}`);
const upl = await client.storage.from("post-media").upload(`${nonOwnerId}/${randomUUID()}.webp`, await sharp({ create: { width: 8, height: 8, channels: 3, background: "#000" } }).webp().toBuffer(), { contentType: "image/webp" });
check("upload no bucket rejeitado", Boolean(upl.error), upl.error?.message);
const rm = await client.storage.from("post-media").remove([fixtures.draft.objectKey]);
check("remoção de objeto alheio não tem efeito", Boolean(rm.error) || (rm.data ?? []).length === 0, rm.error?.message ?? `removidos=${rm.data?.length}`);
if (target === "local") {
  const still = await fixtures.ownerClient.storage.from("post-media").download(fixtures.draft.objectKey);
  check("objeto continua existindo após tentativa de remoção", !still.error, still.error?.message);
  const okPublished = await client.storage.from("post-media").createSignedUrl(fixtures.published.objectKey, 60);
  check("objeto publicado pode ser assinado (conteúdo público)", !okPublished.error, okPublished.error?.message);
  const noPub = await client.storage.from("post-media").createSignedUrl(fixtures.unpublished.objectKey, 60);
  check("objeto de post despublicado não pode ser assinado", Boolean(noPub.error), noPub.error?.message);
}

// Public sign-up must be closed.
const signup = await fetch(`${url}/auth/v1/signup`, { method: "POST", headers: { apikey: key, "Content-Type": "application/json" }, body: JSON.stringify({ email: `probe-${randomUUID().slice(0, 8)}@example.test`, password: `Pw!${randomUUID()}` }) });
check("cadastro público fechado (signup recusado)", signup.status >= 400 && signup.status < 500, `HTTP ${signup.status}`);

// ---------------------------------------------------------------- app HTTP with the real non-owner cookie
const jar = new Map();
const ssr = createServerClient(url, key, {
  cookies: {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: (cookies) => cookies.forEach(({ name, value }) => jar.set(name, value)),
  },
});
const ssrLogin = await ssr.auth.signInWithPassword(nonOwner);
const cookie = [...jar].map(([n, v]) => `${n}=${v}`).join("; ");
check("cookie de sessão SSR gerado", !ssrLogin.error && cookie.length > 0, ssrLogin.error?.message);
const http = (path, init = {}) => fetch(`${appUrl}${path}`, { redirect: "manual", ...init, headers: { cookie, ...(init.headers ?? {}) } });
let appUp = true;
try { await fetch(appUrl, { redirect: "manual" }); } catch { appUp = false; }
check(`app acessível em ${appUrl}`, appUp);
if (appUp) {
  const redirectsToLogin = async (path) => {
    const r = await http(path);
    return { ok: r.status >= 300 && r.status < 400 && /\/admin\/login/.test(r.headers.get("location") ?? ""), status: r.status };
  };
  for (const path of ["/admin", "/admin/posts/new", `/admin/posts/${fixtures.draft.postId}/edit`, `/admin/posts/${fixtures.draft.postId}/preview`]) {
    const r = await redirectsToLogin(path);
    check(`${path} → login para não-proprietário autenticado`, r.ok, `HTTP ${r.status}`);
  }
  const loginPage = await http("/admin/login");
  const loginHtml = await loginPage.text();
  check("/admin/login renderiza o formulário (sem redirecionar ao painel)", loginPage.status === 200 && /name="password"/.test(loginHtml), `HTTP ${loginPage.status}`);

  const png = await sharp({ create: { width: 16, height: 16, channels: 3, background: "#fff" } }).png().toBuffer();
  const mkForm = () => { const f = new FormData(); f.set("file", new File([png], "x.png", { type: "image/png" })); f.set("alt", "Imagem de teste"); return f; };
  const same = await http("/api/admin/media", { method: "POST", body: mkForm(), headers: { origin: appUrl } });
  check("POST /api/admin/media sem papel de proprietário → 401", same.status === 401, `HTTP ${same.status}`);
  const cross = await http("/api/admin/media", { method: "POST", body: mkForm(), headers: { origin: "https://evil.example" } });
  check("POST /api/admin/media com Origin externo → 403", cross.status === 403, `HTTP ${cross.status}`);
  const crossSite = await http("/api/admin/media", { method: "POST", body: mkForm(), headers: { "sec-fetch-site": "cross-site" } });
  check("POST /api/admin/media com Sec-Fetch-Site cross-site → 403", crossSite.status === 403, `HTTP ${crossSite.status}`);
  const noAuth = await fetch(`${appUrl}/api/admin/media`, { method: "POST", body: mkForm(), headers: { origin: appUrl } });
  check("POST /api/admin/media anônimo → 401", noAuth.status === 401, `HTTP ${noAuth.status}`);

  const draftMedia = await http(`/api/admin/media/${fixtures.draft.mediaId}`);
  check("GET /api/admin/media/<rascunho> → 404 para não-proprietário", draftMedia.status === 404, `HTTP ${draftMedia.status}`);
  const pubDraftMedia = await http(`/api/media/${fixtures.draft.mediaId}`);
  check("GET /api/media/<rascunho> → 404", pubDraftMedia.status === 404, `HTTP ${pubDraftMedia.status}`);
  const pubUnpubMedia = await http(`/api/media/${fixtures.unpublished.mediaId}`);
  check("GET /api/media/<despublicado> → 404", pubUnpubMedia.status === 404, `HTTP ${pubUnpubMedia.status}`);
  const draftPage = await http(`/diario/${fixtures.draft.slug}`);
  check("página pública do rascunho → 404", draftPage.status === 404, `HTTP ${draftPage.status}`);
  const diary = await (await http("/diario")).text();
  check("listagem pública não contém rascunho nem despublicado", !diary.includes(fixtures.draft.slug) && !diary.includes(fixtures.unpublished.slug) && !(fixtures.draft.title && diary.includes(fixtures.draft.title)));

  if (target === "local") {
    const pubMedia = await http(`/api/media/${fixtures.published.mediaId}`);
    check("GET /api/media/<publicado> → redireciona para URL assinada", pubMedia.status >= 300 && pubMedia.status < 400 && /\/storage\/v1\/object\/sign\//.test(pubMedia.headers.get("location") ?? ""), `HTTP ${pubMedia.status}`);

    // Server Action replay: ids are visible to the owner and are NOT secrets. A non-owner replaying them must fail.
    const ownerJar = new Map();
    const ownerSsr = createServerClient(url, key, { cookies: { getAll: () => [...ownerJar].map(([name, value]) => ({ name, value })), setAll: (cs) => cs.forEach(({ name, value }) => ownerJar.set(name, value)) } });
    await ownerSsr.auth.signInWithPassword(owner);
    const ownerCookie = [...ownerJar].map(([n, v]) => `${n}=${v}`).join("; ");
    const editor = await fetch(`${appUrl}/admin/posts/${fixtures.published.postId}/edit`, { headers: { cookie: ownerCookie } });
    const html = await editor.text();
    check("proprietário vê o editor (referência positiva)", editor.status === 200 && /Retirar do ar/.test(html), `HTTP ${editor.status}`);
    const actionIds = [...html.matchAll(/name="\$ACTION_ID_([0-9a-f]+)"/g)].map((m) => m[1]);
    check("ids de Server Action extraídos do HTML do proprietário", actionIds.length >= 2, `ids=${actionIds.length}`);
    // Same wire format as a no-JS browser form post: the action id travels as a `$ACTION_ID_*` field.
    const replayWith = (actionId, cookieHeader) => {
      const form = new FormData();
      form.set(`$ACTION_ID_${actionId}`, "");
      form.set("id", fixtures.published.postId);
      form.set("confirmation", "EXCLUIR");
      return fetch(`${appUrl}/admin/posts/${fixtures.published.postId}/edit`, {
        method: "POST", redirect: "manual", body: form,
        headers: { cookie: cookieHeader, origin: appUrl },
      });
    };
    for (const actionId of actionIds) await replayWith(actionId, cookie);
    const after = await fixtures.ownerClient.from("posts").select("status,deleted_at,title").eq("id", fixtures.published.postId).single();
    check("replay de Server Actions como não-proprietário não altera o post", after.data?.status === "published" && after.data?.deleted_at === null, `status=${after.data?.status}`);
    const stillPublic = await http(`/diario/${fixtures.published.slug}`);
    check("post publicado segue no ar após replay", stillPublic.status === 200, `HTTP ${stillPublic.status}`);
    // Positive control: the same request shape, with the owner's cookie, must take effect.
    for (const actionId of actionIds) await replayWith(actionId, ownerCookie);
    const controlled = await fixtures.ownerClient.from("posts").select("status").eq("id", fixtures.published.postId).single();
    check("controle positivo: o mesmo replay com cookie do proprietário surte efeito", controlled.data?.status !== "published", `status=${controlled.data?.status}`);
  }
}

await client.auth.signOut();
mkdirSync("docs/evidence/phase213", { recursive: true });
const failed = results.filter((r) => !r.ok);
writeFileSync(`docs/evidence/phase213/auth-probe-${target}.json`, JSON.stringify({ target, at: new Date().toISOString(), total: results.length, failed: failed.length, results }, null, 2));
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
if (failed.length) { console.log("FALHAS:", failed.map((f) => f.name).join(" | ")); process.exit(1); }
