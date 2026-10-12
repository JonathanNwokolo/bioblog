// Phase 2.1.3 — publish / unpublish / republish / delete against a RUNNING production build (local Supabase).
// Verifies that public pages and media follow state on the very next request, with no rebuild.
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const env = Object.fromEntries(readFileSync(".env.e2e.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const url = env.LOCAL_SUPABASE_URL; const key = env.LOCAL_PUBLISHABLE_KEY;
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) throw new Error("Somente Supabase local.");
const appUrl = process.env.APP_URL ?? "http://localhost:3100";
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: Boolean(ok), detail: String(detail).slice(0, 200) }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${String(detail).slice(0, 120)}` : ""}`); };

const owner = createClient(url, key, opts);
const login = await owner.auth.signInWithPassword({ email: env.E2E_OWNER_EMAIL, password: env.E2E_OWNER_PASSWORD });
if (login.error) throw new Error(login.error.message);
const uid = login.data.user.id;
const jar = new Map();
const ssr = createServerClient(url, key, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (cs) => cs.forEach(({ name, value }) => jar.set(name, value)) } });
await ssr.auth.signInWithPassword({ email: env.E2E_OWNER_EMAIL, password: env.E2E_OWNER_PASSWORD });
const cookie = [...jar].map(([n, v]) => `${n}=${v}`).join("; ");

const run = randomUUID().slice(0, 8);
const { data: cat } = await owner.from("categories").select("id").eq("slug", "identificacao").single();
const png = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#2a8" } }).webp().toBuffer();
const objectKey = `${randomUUID()}/${randomUUID()}.webp`;
await owner.storage.from("post-media").upload(objectKey, png, { contentType: "image/webp" });
const media = (await owner.from("media_assets").insert({ owner_id: uid, object_key: objectKey, mime_type: "image/webp", bytes: png.length, width: 64, height: 48, alt_text: "Fixture de cache", sha256: "c".repeat(64) }).select("id").single()).data;
const title = `Cache ${run}`;
const post = (await owner.from("posts").insert({ slug: `cache-${run}`, title, excerpt: "Resumo para verificação de cache.", body_json: ["Corpo de verificação."], category_id: cat.id, hero_media_id: media.id, author_user_id: uid }).select("id,slug").single()).data;

const get = (path, withCookie = false) => fetch(`${appUrl}${path}`, { redirect: "manual", headers: withCookie ? { cookie } : {} });
async function actionIds() {
  const html = await (await get(`/admin/posts/${post.id}/edit`, true)).text();
  return [...html.matchAll(/name="\$ACTION_ID_([0-9a-f]+)"/g)].map((m) => m[1]);
}
// The page renders exactly one lifecycle form (publish OR unpublish) + delete; ids are stable per action.
async function lifecycle(which) {
  const html = await (await get(`/admin/posts/${post.id}/edit`, true)).text();
  const re = new RegExp(`<form[^>]*>(?:(?!</form>).)*name="\\$ACTION_ID_([0-9a-f]+)"(?:(?!</form>).)*${which}(?:(?!</form>).)*</form>`, "s");
  // Fall back to positional extraction: first id belongs to the publish/unpublish form, second to delete.
  const ids = [...html.matchAll(/name="\$ACTION_ID_([0-9a-f]+)"/g)].map((m) => m[1]);
  void re;
  return ids;
}
async function post_(actionId, extra = {}) {
  const form = new FormData();
  form.set(`$ACTION_ID_${actionId}`, "");
  form.set("id", post.id);
  for (const [k, v] of Object.entries(extra)) form.set(k, v);
  return fetch(`${appUrl}/admin/posts/${post.id}/edit`, { method: "POST", redirect: "manual", body: form, headers: { cookie, origin: appUrl } });
}
const visible = async () => ({
  article: (await get(`/diario/${post.slug}`)).status,
  list: (await (await get("/diario")).text()).includes(title),
  home: (await (await get("/")).text()).includes(title),
  media: (await get(`/api/media/${media.id}`)).status,
});

// 0. Warm every cache while the post is a draft.
let state = await visible();
check("rascunho: artigo 404, fora de /diario e da home, mídia 404", state.article === 404 && !state.list && !state.home && state.media === 404, JSON.stringify(state));

// 1. Publish through the real Server Action.
const [publishId] = await lifecycle("publish");
const published = await post_(publishId);
check("Server Action publicar respondeu com redirecionamento", published.status >= 300 && published.status < 400, `HTTP ${published.status} → ${published.headers.get("location")}`);
state = await visible();
check("publicado: aparece imediatamente no artigo, /diario, home e mídia (sem rebuild)", state.article === 200 && state.list && state.home && state.media >= 300 && state.media < 400, JSON.stringify(state));

// 2. Unpublish.
const [unpublishId] = await lifecycle("unpublish");
const unpublished = await post_(unpublishId);
check("Server Action retirar do ar respondeu com redirecionamento", unpublished.status >= 300 && unpublished.status < 400, `HTTP ${unpublished.status}`);
state = await visible();
check("despublicado: some imediatamente (artigo 404, listas limpas, mídia 404)", state.article === 404 && !state.list && !state.home && state.media === 404, JSON.stringify(state));

// 3. Republish.
const [republishId] = await lifecycle("publish");
await post_(republishId);
state = await visible();
check("republicado: volta imediatamente", state.article === 200 && state.list && state.home && state.media >= 300 && state.media < 400, JSON.stringify(state));

// 4. Delete (requires typed confirmation).
const ids = await actionIds();
const deleteId = ids[ids.length - 1];
const wrong = await post_(deleteId, { confirmation: "excluir?" });
const stillThere = await owner.from("posts").select("status").eq("id", post.id).single();
check("exclusão sem a confirmação EXCLUIR é recusada", stillThere.data.status === "published", `status=${stillThere.data.status} loc=${wrong.headers.get("location")}`);
await post_(deleteId, { confirmation: "EXCLUIR" });
state = await visible();
check("excluído: some imediatamente de tudo", state.article === 404 && !state.list && !state.home && state.media === 404, JSON.stringify(state));
const row = await owner.from("posts").select("status,deleted_at").eq("id", post.id).single();
check("exclusão é lógica (linha preservada, status=deleted)", row.data.status === "deleted" && row.data.deleted_at, JSON.stringify(row.data));

// 5. Cache headers on public pages and private areas.
const home = await get("/");
check("home pública: cache compartilhado s-maxage=300", /s-maxage=300/.test(home.headers.get("cache-control") ?? ""), home.headers.get("cache-control"));
const admin = await get("/admin/login");
check("/admin/login: private, no-store e noindex", /no-store/.test(admin.headers.get("cache-control") ?? "") && /noindex/.test(admin.headers.get("x-robots-tag") ?? ""), `${admin.headers.get("cache-control")} | ${admin.headers.get("x-robots-tag")}`);

mkdirSync("docs/evidence/phase213", { recursive: true });
const failed = results.filter((r) => !r.ok);
writeFileSync("docs/evidence/phase213/publish-cache-local.json", JSON.stringify({ at: new Date().toISOString(), total: results.length, failed: failed.length, results }, null, 2));
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
if (failed.length) process.exit(1);
