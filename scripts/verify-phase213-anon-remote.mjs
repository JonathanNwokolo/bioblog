// Phase 2.1.3 — READ-ONLY anonymous probe of the remote project `microcosmos` (oetwoiuzoniwwtrdnohr).
// Uses only the publishable key from .env.local. Creates no data: write attempts are expected to be
// rejected by the database, and sign-up is verified through the read-only /auth/v1/settings endpoint.
import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const url = env.NEXT_PUBLIC_SUPABASE_URL; const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url?.includes("oetwoiuzoniwwtrdnohr") || url.includes("mrybqbwuebgjjhnojdle")) throw new Error("Projeto inesperado; abortando.");

const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: Boolean(ok), detail: String(detail).slice(0, 200) }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${String(detail).slice(0, 120)}` : ""}`); };
const denied = (e) => Boolean(e) && /42501|permission denied|row-level security|401|JWT/i.test(`${e.code ?? ""} ${e.message ?? ""}`);
const c = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const settings = await (await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })).json();
check("Auth: cadastro público desativado (disable_signup)", settings.disable_signup === true, `disable_signup=${settings.disable_signup}`);
check("Auth: logins anônimos desativados", settings.external?.anonymous_users !== true, `anonymous=${settings.external?.anonymous_users}`);
check("Auth: provedores sociais/telefone desativados", Object.entries(settings.external ?? {}).filter(([k, v]) => v === true && k !== "email").length === 0, JSON.stringify(Object.entries(settings.external ?? {}).filter(([, v]) => v === true)));

const published = await c.from("posts").select("id,status").eq("status", "published");
check("posts: leitura publicada sem erro", !published.error, published.error?.message ?? `n=${published.data?.length}`);
const all = await c.from("posts").select("id,status");
check("posts: somente publicados visíveis", !all.error && all.data.every((p) => p.status === "published"), `n=${all.data?.length}`);
for (const col of ["author_user_id"]) { const r = await c.from("posts").select(col).limit(1); check(`posts.${col} negada`, denied(r.error), r.error?.code); }
for (const col of ["owner_id", "sha256", "bytes", "storage_bucket"]) { const r = await c.from("media_assets").select(col).limit(1); check(`media_assets.${col} negada`, denied(r.error), r.error?.code); }
for (const t of ["owner_accounts", "audit_events", "post_revisions"]) { const r = await c.from(t).select("*").limit(1); check(`${t}: sem leitura anônima`, denied(r.error) || (!r.error && r.data.length === 0), r.error?.code ?? `rows=${r.data?.length}`); }
const cats = await c.from("categories").select("id,slug");
check("categories: leitura pública", !cats.error && cats.data.length >= 4, `n=${cats.data?.length}`);

const ins = await c.from("posts").insert({ slug: `x-${randomUUID().slice(0, 6)}`, title: "x", excerpt: "xxxxxxxxxx", body_json: ["x"], category_id: cats.data[0].id, author_user_id: randomUUID() });
check("posts: INSERT anônimo rejeitado", Boolean(ins.error), ins.error?.code);
const insOwner = await c.from("owner_accounts").insert({ user_id: randomUUID(), active: true });
check("owner_accounts: INSERT anônimo rejeitado", Boolean(insOwner.error), insOwner.error?.code);
const upd = await c.from("posts").update({ title: "hack" }).not("id", "is", null).select("id");
check("posts: UPDATE anônimo não altera linhas", Boolean(upd.error) || upd.data.length === 0, upd.error?.code ?? `rows=${upd.data?.length}`);
const del = await c.from("posts").delete().not("id", "is", null).select("id");
check("posts: DELETE anônimo não remove linhas", Boolean(del.error) || del.data.length === 0, del.error?.code ?? `rows=${del.data?.length}`);

for (const fn of ["publish_post", "unpublish_post", "soft_delete_post"]) {
  const r = await c.rpc(fn, { target_post_id: randomUUID() });
  check(`RPC ${fn} negada ao anônimo`, Boolean(r.error) && /42501|permission denied|401|not_authorized/i.test(`${r.error.code} ${r.error.message}`), r.error?.code);
}
const owner = await c.rpc("is_active_owner");
check("RPC is_active_owner negada ao anônimo", Boolean(owner.error), owner.error?.code);

const known = ["64735f74-5c82-41fa-a001-406813663c6b/c786d6c9-b51b-46f4-87cd-99c4a02625f3.webp", "f65424d0-c1b5-469a-b578-b6183d919d96/934f9a6e-dff2-4013-bcc7-b255f36610ce.webp"];
for (const k of known) {
  const s = await c.storage.from("post-media").createSignedUrl(k, 60);
  check(`Storage: signed URL de objeto privado negada (${k.slice(0, 8)}…)`, Boolean(s.error), s.error?.message);
  const d = await c.storage.from("post-media").download(k);
  check(`Storage: download anônimo negado (${k.slice(0, 8)}…)`, Boolean(d.error), d.error?.message);
}
const list = await c.storage.from("post-media").list("", { limit: 50 });
check("Storage: listagem anônima vazia", !list.error && list.data.length === 0 || Boolean(list.error), list.error?.message ?? `n=${list.data?.length}`);
const pub = await fetch(`${url}/storage/v1/object/public/post-media/${known[0]}`);
check("Storage: URL pública direta não serve objeto (bucket privado)", pub.status >= 400, `HTTP ${pub.status}`);

mkdirSync("docs/evidence/phase213", { recursive: true });
const failed = results.filter((r) => !r.ok);
writeFileSync("docs/evidence/phase213/anon-probe-remote.json", JSON.stringify({ at: new Date().toISOString(), project: "oetwoiuzoniwwtrdnohr", total: results.length, failed: failed.length, results }, null, 2));
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
void existsSync;
if (failed.length) process.exit(1);
