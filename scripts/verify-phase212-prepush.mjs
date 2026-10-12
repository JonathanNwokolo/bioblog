// Phase 2.1.2 — pre-push probes against a LOCAL Supabase stack only.
// Creates throw-away owner/stranger users (@example.test), runs real Auth/RLS/Storage/RPC checks,
// then removes everything it created. Refuses to run against anything but 127.0.0.1/localhost.
//
//   SUPABASE_PUBLISHABLE_KEY=... SUPABASE_SECRET_KEY=... node scripts/verify-phase212-prepush.mjs
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { randomUUID } from "node:crypto";

const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) throw new Error("Somente Supabase local.");
const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!anonKey || !secretKey) throw new Error("Defina SUPABASE_PUBLISHABLE_KEY e SUPABASE_SECRET_KEY (valores locais).");

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secretKey, opts);
const anon = createClient(url, anonKey, opts);
const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok: Boolean(ok), detail: String(detail).slice(0, 240) });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + String(detail).slice(0, 160) : ""}`);
}
const denied = (r) => Boolean(r.error) || (Array.isArray(r.data) && r.data.length === 0) || r.data === null;

const tag = randomUUID().slice(0, 8);
const password = randomUUID() + "Aa1!";
const created = { users: [], mediaKeys: [], postIds: [], mediaIds: [] };
async function mkUser(label, isOwner) {
  const email = `${label}-${tag}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  created.users.push(data.user.id);
  if (isOwner) {
    const o = await admin.from("owner_accounts").insert({ user_id: data.user.id });
    if (o.error) throw o.error;
  }
  const client = createClient(url, anonKey, opts);
  const s = await client.auth.signInWithPassword({ email, password });
  if (s.error) throw s.error;
  return { client, id: data.user.id };
}

const png = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#2a8" } }).webp().toBuffer();
const owner = await mkUser("owner", true);
const stranger = await mkUser("stranger", false);
const { data: cat } = await admin.from("categories").select("id").eq("slug", "identificacao").single();

async function newMedia(alt) {
  const key = `${randomUUID()}/${randomUUID()}.webp`;
  const up = await owner.client.storage.from("post-media").upload(key, png, { contentType: "image/webp" });
  if (up.error) throw up.error;
  created.mediaKeys.push(key);
  const ins = await owner.client.from("media_assets").insert({ owner_id: owner.id, object_key: key, mime_type: "image/webp", bytes: png.length, width: 64, height: 48, alt_text: alt, sha256: "b".repeat(64) }).select("id").single();
  if (ins.error) throw ins.error;
  created.mediaIds.push(ins.data.id);
  return { id: ins.data.id, key };
}
async function newPost(label, hero) {
  const slug = `prepush-${label}-${tag}`;
  const r = await owner.client.from("posts").insert({ slug, title: `Prepush ${label}`, excerpt: "Resumo de teste pre-push com tamanho valido.", body_json: ["Paragrafo de teste."], category_id: cat.id, hero_media_id: hero.id, author_user_id: owner.id }).select("id").single();
  if (r.error) throw r.error;
  created.postIds.push(r.data.id);
  return { id: r.data.id, slug };
}

const heroPub = await newMedia("Hero publicado");
const heroDraft = await newMedia("Hero rascunho");
const heroUnpub = await newMedia("Hero despublicado");
const orphan = await newMedia("Midia privada sem post");
const postPub = await newPost("publicado", heroPub);
const postDraft = await newPost("rascunho", heroDraft);
const postUnpub = await newPost("despublicado", heroUnpub);
for (const id of [postPub.id, postUnpub.id]) {
  const p = await owner.client.rpc("publish_post", { target_post_id: id });
  if (p.error) throw p.error;
}
{
  const u = await owner.client.rpc("unpublish_post", { target_post_id: postUnpub.id });
  if (u.error) throw u.error;
}

const PUBLIC_SELECT = "id,slug,title,excerpt,body_json,status,published_at,category:categories!posts_category_id_fkey(label),media:media_assets!posts_hero_media_id_fkey(id,width,height,alt_text,credit)";
const s = stranger.client;
let r;

// ---- autenticado SEM papel de proprietário: leitura pública funciona
r = await s.from("posts").select(PUBLIC_SELECT).eq("slug", postPub.slug).maybeSingle();
check("não-proprietário autenticado lê post publicado (com categoria e hero)", r.data?.slug === postPub.slug && r.data?.media?.id === heroPub.id && r.data?.category?.label, r.error?.message ?? "sem linha");
r = await s.from("posts").select("slug,status").like("slug", `%-${tag}`);
const slugs = (r.data ?? []).map((x) => x.slug).sort();
check("lista do não-proprietário contém SOMENTE o publicado", !r.error && slugs.length === 1 && slugs[0] === postPub.slug, r.error?.message ?? JSON.stringify(slugs));
r = await s.from("posts").select("id").eq("id", postDraft.id);
check("não-proprietário NÃO lê rascunho", !r.error && r.data.length === 0, r.error?.message ?? `rows=${r.data?.length}`);
r = await s.from("posts").select("id").eq("id", postUnpub.id);
check("não-proprietário NÃO lê post despublicado", !r.error && r.data.length === 0, r.error?.message ?? `rows=${r.data?.length}`);
r = await s.from("media_assets").select("id").eq("id", heroPub.id);
check("não-proprietário lê metadados de mídia publicada", !r.error && r.data.length === 1, r.error?.message ?? `rows=${r.data?.length}`);
for (const [label, m] of [["de rascunho", heroDraft], ["de post despublicado", heroUnpub], ["órfã/privada", orphan]]) {
  r = await s.from("media_assets").select("id").eq("id", m.id);
  check(`não-proprietário NÃO lê mídia ${label}`, !r.error && r.data.length === 0, r.error?.message ?? `rows=${r.data?.length}`);
}
r = await s.storage.from("post-media").createSignedUrl(heroPub.key, 60);
check("não-proprietário assina URL de objeto publicado", Boolean(r.data?.signedUrl), r.error?.message);
for (const [label, m] of [["de rascunho", heroDraft], ["despublicado", heroUnpub], ["órfão", orphan]]) {
  r = await s.storage.from("post-media").createSignedUrl(m.key, 60);
  check(`não-proprietário NÃO assina URL de objeto ${label}`, Boolean(r.error), r.error?.message);
  r = await s.storage.from("post-media").download(m.key);
  check(`não-proprietário NÃO baixa objeto ${label}`, Boolean(r.error), r.error?.message);
}
r = await s.storage.from("post-media").list("", { limit: 100 });
check("listagem do bucket pelo não-proprietário não revela UUID do proprietário", !JSON.stringify(r.data ?? []).includes(owner.id), r.error?.message ?? `itens=${r.data?.length}`);

// ---- dados administrativos
for (const t of ["owner_accounts", "post_revisions", "audit_events"]) {
  r = await s.from(t).select("*").limit(5);
  check(`não-proprietário NÃO lê ${t}`, !r.error && r.data.length === 0, r.error?.message ?? `rows=${r.data?.length}`);
}
r = await s.from("categories").select("id,active").eq("active", false);
check("não-proprietário não vê categorias inativas", !r.error && r.data.length === 0, r.error?.message);

// ---- escrita
r = await s.from("posts").insert({ slug: `intruso-${tag}`, title: "Intruso", excerpt: "Tentativa de escrita nao autorizada.", category_id: cat.id, author_user_id: stranger.id });
check("não-proprietário NÃO insere post", Boolean(r.error), r.error?.message);
r = await s.from("posts").update({ title: "Hack" }).eq("id", postPub.id).select("id");
check("não-proprietário NÃO atualiza post publicado", !r.error && r.data.length === 0, r.error?.message ?? `rows=${r.data?.length}`);
r = await s.from("posts").delete().eq("id", postPub.id).select("id");
check("não-proprietário NÃO apaga post", Boolean(r.error) || r.data.length === 0, r.error?.message ?? `rows=${r.data?.length}`);
r = await s.from("media_assets").update({ state: "draft" }).eq("id", heroPub.id).select("id");
check("não-proprietário NÃO altera mídia", !r.error && r.data.length === 0, r.error?.message ?? `rows=${r.data?.length}`);
r = await s.from("categories").update({ label: "Hack" }).eq("id", cat.id).select("id");
check("não-proprietário NÃO altera categoria", !r.error && r.data.length === 0, r.error?.message ?? `rows=${r.data?.length}`);
r = await s.from("owner_accounts").insert({ user_id: stranger.id });
check("não-proprietário NÃO se promove a proprietário", Boolean(r.error), r.error?.message);
r = await s.from("audit_events").insert({ actor_user_id: stranger.id, action: "create", entity_type: "post", entity_id: postPub.id });
check("não-proprietário NÃO grava auditoria", Boolean(r.error), r.error?.message);
for (const [name, args] of [
  ["publish_post", { target_post_id: postDraft.id }],
  ["unpublish_post", { target_post_id: postPub.id }],
  ["soft_delete_post", { target_post_id: postPub.id }],
  ["save_post_changes", { target_post_id: postPub.id, new_title: "Hack", new_excerpt: "Tentativa indevida de edicao.", new_body: ["x"], new_category: cat.id, new_hero: null }],
]) {
  r = await s.rpc(name, args);
  check(`não-proprietário NÃO executa ${name}`, Boolean(r.error), r.error?.message);
}
r = await s.storage.from("post-media").upload(`${randomUUID()}/${randomUUID()}.webp`, png, { contentType: "image/webp" });
check("não-proprietário NÃO envia mídia", Boolean(r.error), r.error?.message);
r = await s.storage.from("post-media").remove([heroPub.key]);
const still = await anon.storage.from("post-media").download(heroPub.key);
check("não-proprietário NÃO apaga objeto", !still.error, r.error?.message ?? `removidos=${r.data?.length}`);

// ---- anon (regressão): comportamento da Fase 2.1.1 preservado
r = await anon.from("posts").select(PUBLIC_SELECT).eq("slug", postPub.slug).maybeSingle();
check("anon lê post publicado (consulta do site)", r.data?.slug === postPub.slug && r.data?.media?.id === heroPub.id, r.error?.message);
r = await anon.from("posts").select("id").eq("id", postDraft.id);
check("anon NÃO lê rascunho", !r.error && r.data.length === 0, r.error?.message);
r = await anon.from("posts").select("author_user_id").eq("slug", postPub.slug).maybeSingle();
check("anon NÃO lê author_user_id", Boolean(r.error) || r.data === null, r.error ? r.error.message : `VAZOU ${JSON.stringify(r.data)}`);
r = await anon.from("media_assets").select("owner_id").eq("id", heroPub.id).maybeSingle();
check("anon NÃO lê owner_id", Boolean(r.error) || r.data === null, r.error ? r.error.message : `VAZOU ${JSON.stringify(r.data)}`);
r = await anon.from("posts").update({ title: "Hack" }).eq("id", postPub.id).select("id");
check("anon NÃO atualiza post", Boolean(r.error) || r.data.length === 0, r.error?.message);
r = await anon.from("posts").delete().eq("id", postPub.id).select("id");
check("anon NÃO apaga post", Boolean(r.error) || r.data.length === 0, r.error?.message);

// ---- proprietário (regressão)
r = await owner.client.from("posts").select("id,status").like("slug", `%-${tag}`);
check("proprietário vê os 3 posts (rascunho, publicado, despublicado)", !r.error && r.data.length === 3, r.error?.message ?? `rows=${r.data?.length}`);
r = await owner.client.rpc("save_post_changes", { target_post_id: postDraft.id, new_title: "Prepush rascunho editado", new_excerpt: "Resumo editado de teste pre-push.", new_body: ["Novo."], new_category: cat.id, new_hero: heroDraft.id });
check("proprietário edita rascunho via save_post_changes", !r.error, r.error?.message);
r = await owner.client.rpc("publish_post", { target_post_id: postDraft.id });
check("proprietário publica rascunho", !r.error, r.error?.message);
r = await s.from("posts").select("id").eq("id", postDraft.id);
check("rascunho recém-publicado fica visível ao não-proprietário", !r.error && r.data.length === 1, r.error?.message ?? `rows=${r.data?.length}`);
r = await owner.client.rpc("unpublish_post", { target_post_id: postDraft.id });
check("proprietário despublica", !r.error, r.error?.message);
r = await s.from("posts").select("id").eq("id", postDraft.id);
check("despublicado some para o não-proprietário", !r.error && r.data.length === 0, r.error?.message ?? `rows=${r.data?.length}`);

// ---- limpeza (somente dados criados por este script)
await owner.client.auth.signOut();
await stranger.client.auth.signOut();
await admin.from("audit_events").delete().in("actor_user_id", created.users);
await admin.from("posts").delete().in("id", created.postIds);
await admin.from("media_assets").delete().in("id", created.mediaIds);
await admin.storage.from("post-media").remove(created.mediaKeys);
for (const id of created.users) await admin.auth.admin.deleteUser(id);

const failed = results.filter((x) => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} verificações passaram`);
if (process.env.EVIDENCE_OUT) {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(process.env.EVIDENCE_OUT, JSON.stringify({ ran_at: new Date().toISOString(), target: url, results }, null, 2));
}
process.exit(failed.length ? 1 : 0);
