// Phase 2.1.2 / owner decision R1 — minimal public read contract, probed against a LOCAL stack only.
// Roles exercised with real Auth sessions: anon, owner, authenticated non-owner (stranger) and a
// second active owner (cross-ownership). Everything created is removed at the end.
//
//   SUPABASE_PUBLISHABLE_KEY=... SUPABASE_SECRET_KEY=... node scripts/verify-phase212-r1.mjs
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
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + String(detail).slice(0, 150) : ""}`);
}
const errored = (r) => Boolean(r.error);
const noRows = (r) => !r.error && Array.isArray(r.data) && r.data.length === 0;
const blocked = (r) => errored(r) || noRows(r) || r.data === null;
const permDenied = (r) => r.error && /permission denied|42501/i.test(`${r.error.code} ${r.error.message}`);

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
const owner2 = await mkUser("owner2", true);
const stranger = await mkUser("stranger", false);
const { data: cat } = await admin.from("categories").select("id").eq("slug", "identificacao").single();

async function newMedia(who, alt) {
  const key = `${randomUUID()}/${randomUUID()}.webp`;
  const up = await who.client.storage.from("post-media").upload(key, png, { contentType: "image/webp" });
  if (up.error) throw up.error;
  created.mediaKeys.push(key);
  const ins = await who.client.from("media_assets").insert({ owner_id: who.id, object_key: key, mime_type: "image/webp", bytes: png.length, width: 64, height: 48, alt_text: alt, sha256: "c".repeat(64) }).select("id").single();
  if (ins.error) throw ins.error;
  created.mediaIds.push(ins.data.id);
  return { id: ins.data.id, key };
}
async function newPost(who, label, hero) {
  const slug = `r1-${label}-${tag}`;
  const r = await who.client.from("posts").insert({ slug, title: `R1 ${label}`, excerpt: "Resumo de teste R1 com tamanho valido.", body_json: ["Paragrafo de teste."], category_id: cat.id, hero_media_id: hero.id, author_user_id: who.id }).select("id").single();
  if (r.error) throw r.error;
  created.postIds.push(r.data.id);
  return { id: r.data.id, slug };
}

const heroPub = await newMedia(owner, "Hero publicado");
const heroDraft = await newMedia(owner, "Hero rascunho");
const heroUnpub = await newMedia(owner, "Hero despublicado");
const orphan = await newMedia(owner, "Midia privada sem post");
const postPub = await newPost(owner, "publicado", heroPub);
const postDraft = await newPost(owner, "rascunho", heroDraft);
const postUnpub = await newPost(owner, "despublicado", heroUnpub);

// lifecycle through the RPCs, checking the returned shape
const shape = (d) => d && !Array.isArray(d) ? Object.keys(d).sort().join(",") : "NOT_OBJECT";
const EXPECTED_SHAPE = "id,published_at,slug,status,updated_at";
let r = await owner.client.rpc("publish_post", { target_post_id: postPub.id });
check("owner: publish_post devolve apenas {id,slug,status,published_at,updated_at}", !r.error && shape(r.data) === EXPECTED_SHAPE && r.data.status === "published" && r.data.slug === postPub.slug, r.error?.message ?? shape(r.data));
r = await owner.client.rpc("publish_post", { target_post_id: postUnpub.id });
if (r.error) throw r.error;
r = await owner.client.rpc("unpublish_post", { target_post_id: postUnpub.id });
check("owner: unpublish_post devolve a projeção mínima", !r.error && shape(r.data) === EXPECTED_SHAPE && r.data.status === "unpublished", r.error?.message ?? shape(r.data));

const PUBLIC_SELECT = "id,slug,title,excerpt,body_json,status,published_at,category:categories!posts_category_id_fkey(label),media:media_assets!posts_hero_media_id_fkey(id,width,height,alt_text,credit)";
const POST_COLS = "id,slug,title,excerpt,body_json,category_id,hero_media_id,status,first_published_at,published_at,created_at,updated_at,deleted_at";
const MEDIA_COLS = "id,object_key,state,mime_type,width,height,alt_text,credit,created_at,deleted_at";

// ========================================================= 1. contrato de campos (anon, autenticado comum, proprietário)
for (const [who, client] of [["anon", anon], ["autenticado não-proprietário", stranger.client], ["proprietário", owner.client]]) {
  r = await client.from("posts").select(PUBLIC_SELECT).eq("slug", postPub.slug).maybeSingle();
  check(`${who}: consulta pública do site retorna o post publicado`, !r.error && r.data?.slug === postPub.slug && r.data?.media?.id === heroPub.id, r.error?.message ?? "sem linha");
  r = await client.from("posts").select(POST_COLS).eq("slug", postPub.slug).maybeSingle();
  const keys = r.data ? Object.keys(r.data).sort().join(",") : "";
  check(`${who}: posts expõe exatamente as colunas do contrato`, !r.error && keys === POST_COLS.split(",").sort().join(","), r.error?.message ?? keys);
  r = await client.from("media_assets").select(MEDIA_COLS).eq("id", heroPub.id).maybeSingle();
  const mkeys = r.data ? Object.keys(r.data).sort().join(",") : "";
  check(`${who}: media_assets expõe exatamente as colunas do contrato`, !r.error && mkeys === MEDIA_COLS.split(",").sort().join(","), r.error?.message ?? mkeys);
  for (const col of ["author_user_id"]) {
    r = await client.from("posts").select(col).eq("slug", postPub.slug);
    check(`${who}: posts.${col} negado`, permDenied(r), r.error?.message ?? JSON.stringify(r.data));
  }
  for (const col of ["owner_id", "sha256", "bytes", "storage_bucket"]) {
    r = await client.from("media_assets").select(col).eq("id", heroPub.id);
    check(`${who}: media_assets.${col} negado`, permDenied(r), r.error?.message ?? JSON.stringify(r.data));
  }
  r = await client.from("posts").select("*").eq("slug", postPub.slug);
  check(`${who}: posts select=* negado`, permDenied(r), r.error?.message ?? "retornou dados");
  r = await client.from("media_assets").select("*").eq("id", heroPub.id);
  check(`${who}: media_assets select=* negado`, permDenied(r), r.error?.message ?? "retornou dados");
  r = await client.from("posts").select("id,media:media_assets!posts_hero_media_id_fkey(owner_id)").eq("slug", postPub.slug);
  check(`${who}: embed de media_assets.owner_id negado`, permDenied(r), r.error?.message ?? JSON.stringify(r.data));
  r = await client.from("media_assets").select("id").eq("owner_id", owner.id);
  check(`${who}: filtrar por owner_id (oráculo) negado`, permDenied(r), r.error?.message ?? JSON.stringify(r.data));
  r = await client.from("posts").select("id").eq("author_user_id", owner.id);
  check(`${who}: filtrar por author_user_id (oráculo) negado`, permDenied(r), r.error?.message ?? JSON.stringify(r.data));
}

// ========================================================= 2. escopo de linhas: anon e autenticado comum
for (const [who, client] of [["anon", anon], ["autenticado não-proprietário", stranger.client]]) {
  r = await client.from("posts").select("slug").like("slug", `%-${tag}`);
  const slugs = (r.data ?? []).map((x) => x.slug);
  check(`${who}: lista contém SOMENTE o publicado`, !r.error && slugs.length === 1 && slugs[0] === postPub.slug, r.error?.message ?? JSON.stringify(slugs));
  for (const [label, p] of [["rascunho", postDraft], ["despublicado", postUnpub]]) {
    r = await client.from("posts").select("id").eq("id", p.id);
    check(`${who}: NÃO lê ${label}`, noRows(r) || errored(r), r.error?.message ?? `rows=${r.data?.length}`);
  }
  r = await client.from("media_assets").select("id").eq("id", heroPub.id);
  check(`${who}: lê metadados da mídia publicada`, !r.error && r.data.length === 1, r.error?.message);
  for (const [label, m] of [["de rascunho", heroDraft], ["de post despublicado", heroUnpub], ["órfã", orphan]]) {
    r = await client.from("media_assets").select("id").eq("id", m.id);
    check(`${who}: NÃO lê mídia ${label}`, noRows(r) || errored(r), r.error?.message ?? `rows=${r.data?.length}`);
    r = await client.storage.from("post-media").createSignedUrl(m.key, 60);
    check(`${who}: NÃO assina objeto ${label}`, errored(r), r.error?.message);
    r = await client.storage.from("post-media").download(m.key);
    check(`${who}: NÃO baixa objeto ${label}`, errored(r), r.error?.message);
  }
  r = await client.storage.from("post-media").createSignedUrl(heroPub.key, 60);
  check(`${who}: assina objeto publicado`, Boolean(r.data?.signedUrl), r.error?.message);
  r = await client.storage.from("post-media").list("", { limit: 100 });
  check(`${who}: listagem do bucket não revela UUID do proprietário`, !JSON.stringify(r.data ?? []).includes(owner.id), r.error?.message ?? `itens=${r.data?.length}`);
}
for (const t of ["owner_accounts", "post_revisions", "audit_events"]) {
  r = await stranger.client.from(t).select("*").limit(5);
  check(`autenticado não-proprietário NÃO lê ${t}`, blocked(r), r.error?.message ?? `rows=${r.data?.length}`);
  r = await anon.from(t).select("*").limit(5);
  check(`anon NÃO lê ${t}`, errored(r) || noRows(r), r.error?.message ?? `rows=${r.data?.length}`);
}
r = await stranger.client.from("categories").select("id").eq("active", false);
check("autenticado não-proprietário não vê categorias inativas", noRows(r), r.error?.message);

// ========================================================= 3. operações negadas (anon e autenticado comum)
for (const [who, client, uid] of [["anon", anon, owner.id], ["autenticado não-proprietário", stranger.client, stranger.id]]) {
  r = await client.from("posts").insert({ slug: `intruso-${who.length}-${tag}`, title: "Intruso", excerpt: "Tentativa de escrita nao autorizada.", category_id: cat.id, author_user_id: uid });
  check(`${who}: NÃO insere post`, errored(r), r.error?.message);
  r = await client.from("posts").update({ title: "Hack" }).eq("id", postPub.id).select("id");
  check(`${who}: NÃO atualiza post publicado`, blocked(r), r.error?.message ?? `rows=${r.data?.length}`);
  r = await client.from("posts").delete().eq("id", postPub.id).select("id");
  check(`${who}: NÃO apaga post`, blocked(r), r.error?.message ?? `rows=${r.data?.length}`);
  r = await client.from("media_assets").update({ state: "draft" }).eq("id", heroPub.id).select("id");
  check(`${who}: NÃO altera mídia`, blocked(r), r.error?.message ?? `rows=${r.data?.length}`);
  r = await client.from("categories").update({ label: "Hack" }).eq("id", cat.id).select("id");
  check(`${who}: NÃO altera categoria`, blocked(r), r.error?.message ?? `rows=${r.data?.length}`);
  r = await client.from("owner_accounts").insert({ user_id: uid });
  check(`${who}: NÃO se promove a proprietário`, errored(r), r.error?.message);
  r = await client.from("audit_events").insert({ actor_user_id: uid, action: "create", entity_type: "post", entity_id: postPub.id });
  check(`${who}: NÃO grava auditoria`, errored(r), r.error?.message);
  for (const [name, args] of [
    ["publish_post", { target_post_id: postDraft.id }],
    ["unpublish_post", { target_post_id: postPub.id }],
    ["soft_delete_post", { target_post_id: postPub.id }],
    ["save_post_changes", { target_post_id: postPub.id, new_title: "Hack", new_excerpt: "Tentativa indevida de edicao.", new_body: ["x"], new_category: cat.id, new_hero: null }],
    ["is_active_owner", { candidate: owner.id }],
    ["record_post_revision", {}],
    ["enforce_published_post_invariants", {}],
    ["protect_in_use_media", {}],
  ]) {
    r = await client.rpc(name, args);
    // is_active_owner is executable by authenticated but must never act as an oracle for other users.
    if (name === "is_active_owner" && who !== "anon") check(`${who}: is_active_owner(outro id) retorna false (sem oráculo)`, !r.error && r.data === false, r.error?.message ?? String(r.data));
    else check(`${who}: NÃO executa ${name}`, errored(r), r.error?.message);
  }
}
r = await stranger.client.storage.from("post-media").upload(`${randomUUID()}/${randomUUID()}.webp`, png, { contentType: "image/webp" });
check("autenticado não-proprietário NÃO envia mídia", errored(r), r.error?.message);
r = await stranger.client.storage.from("post-media").remove([heroPub.key]);
const still = await anon.storage.from("post-media").download(heroPub.key);
check("autenticado não-proprietário NÃO apaga objeto", !still.error, r.error?.message ?? `removidos=${r.data?.length}`);

r = await anon.storage.from("post-media").upload(`${randomUUID()}/${randomUUID()}.webp`, png, { contentType: "image/webp" });
check("anon NÃO envia mídia", errored(r), r.error?.message);
r = await anon.storage.from("post-media").remove([heroPub.key]);
const still2 = await anon.storage.from("post-media").download(heroPub.key);
check("anon NÃO apaga objeto publicado", !still2.error, r.error?.message ?? `removidos=${r.data?.length}`);
r = await anon.storage.from("post-media").update(heroPub.key, png, { contentType: "image/webp", upsert: true });
check("anon NÃO sobrescreve objeto publicado", errored(r), r.error?.message);
r = await stranger.client.storage.from("post-media").update(heroPub.key, png, { contentType: "image/webp", upsert: true });
check("autenticado não-proprietário NÃO sobrescreve objeto publicado", errored(r), r.error?.message);

// ========================================================= 4. proprietário legítimo
r = await owner.client.from("posts").select("id,status").like("slug", `%-${tag}`);
check("proprietário vê os 3 posts (publicado, rascunho, despublicado)", !r.error && r.data.length === 3, r.error?.message ?? `rows=${r.data?.length}`);
r = await owner.client.from("media_assets").select("id").in("id", [heroDraft.id, heroUnpub.id, orphan.id]);
check("proprietário lê mídia privada (rascunho, despublicado, órfã)", !r.error && r.data.length === 3, r.error?.message ?? `rows=${r.data?.length}`);
r = await owner.client.storage.from("post-media").createSignedUrl(orphan.key, 60);
check("proprietário assina objeto privado", Boolean(r.data?.signedUrl), r.error?.message);
r = await owner.client.from("post_revisions").select("id").limit(1);
check("proprietário lê revisões", !r.error, r.error?.message);
r = await owner.client.from("audit_events").select("id").limit(1);
check("proprietário lê auditoria", !r.error && r.data.length === 1, r.error?.message ?? `rows=${r.data?.length}`);
r = await owner.client.from("owner_accounts").select("user_id,active").eq("user_id", owner.id);
check("proprietário lê o próprio owner_accounts", !r.error && r.data.length === 1, r.error?.message);
r = await owner.client.rpc("is_active_owner");
check("proprietário: is_active_owner() = true", !r.error && r.data === true, r.error?.message);

r = await owner.client.rpc("save_post_changes", { target_post_id: postDraft.id, new_title: "R1 rascunho editado", new_excerpt: "Resumo editado de teste R1.", new_body: ["Novo."], new_category: cat.id, new_hero: heroDraft.id });
check("proprietário edita rascunho (save_post_changes) com projeção mínima", !r.error && shape(r.data) === EXPECTED_SHAPE && r.data.status === "draft", r.error?.message ?? shape(r.data));
r = await owner.client.rpc("publish_post", { target_post_id: postDraft.id });
check("proprietário publica rascunho", !r.error && r.data?.status === "published", r.error?.message);
r = await stranger.client.from("posts").select("id").eq("id", postDraft.id);
check("recém-publicado fica visível ao autenticado comum", !r.error && r.data.length === 1, r.error?.message);
// swap hero of a published post: new hero becomes public, old hero goes private again
const heroNew = await newMedia(owner, "Hero substituto");
r = await owner.client.rpc("save_post_changes", { target_post_id: postDraft.id, new_title: "R1 rascunho editado", new_excerpt: "Resumo editado de teste R1.", new_body: ["Novo."], new_category: cat.id, new_hero: heroNew.id });
check("proprietário troca a capa de post publicado", !r.error, r.error?.message);
r = await anon.from("media_assets").select("id").in("id", [heroNew.id, heroDraft.id]);
check("capa nova pública, capa antiga voltou a privada", !r.error && r.data.length === 1 && r.data[0].id === heroNew.id, r.error?.message ?? JSON.stringify(r.data));
r = await owner.client.rpc("save_post_changes", { target_post_id: postDraft.id, new_title: "R1 sem capa", new_excerpt: "Resumo editado de teste R1.", new_body: ["Novo."], new_category: cat.id, new_hero: null });
check("post publicado exige capa (hero_media_required)", errored(r) && /hero_media_required/.test(r.error.message), r.error?.message);
r = await owner.client.rpc("unpublish_post", { target_post_id: postDraft.id });
check("proprietário despublica", !r.error && r.data?.status === "unpublished", r.error?.message);
r = await stranger.client.from("posts").select("id").eq("id", postDraft.id);
check("despublicado some para o autenticado comum", noRows(r), r.error?.message);
r = await owner.client.rpc("soft_delete_post", { target_post_id: postDraft.id });
check("proprietário exclui (soft delete) com projeção mínima", !r.error && r.data?.status === "deleted" && shape(r.data) === EXPECTED_SHAPE, r.error?.message ?? shape(r.data));
r = await owner.client.rpc("publish_post", { target_post_id: postDraft.id });
check("post excluído não pode ser publicado", errored(r), r.error?.message);

// colunas de integridade não são mais regraváveis pela API (nem pelo proprietário)
for (const [table, id, patch] of [
  ["posts", postPub.id, { slug: `x-${tag}` }],
  ["posts", postPub.id, { author_user_id: owner2.id }],
  ["posts", postPub.id, { created_at: "2000-01-01T00:00:00Z" }],
  ["media_assets", heroPub.id, { object_key: `${randomUUID()}/${randomUUID()}.webp` }],
  ["media_assets", heroPub.id, { owner_id: owner2.id }],
  ["media_assets", heroPub.id, { sha256: "d".repeat(64) }],
  ["media_assets", heroPub.id, { bytes: 1 }],
]) {
  r = await owner.client.from(table).update(patch).eq("id", id).select("id");
  check(`proprietário NÃO regrava ${table}.${Object.keys(patch)[0]}`, permDenied(r), r.error?.message ?? JSON.stringify(r.data));
}
r = await owner.client.from("media_assets").update({ alt_text: "Texto alternativo revisado" }).eq("id", orphan.id).select("id");
check("proprietário ainda edita alt_text da mídia", !r.error && r.data.length === 1, r.error?.message);
r = await owner.client.from("posts").select("id").eq("id", postPub.id).select("author_user_id");
check("proprietário também não lê author_user_id (nenhum papel de API lê)", permDenied(r), r.error?.message ?? JSON.stringify(r.data));

// ========================================================= 5. segundo proprietário ativo: ownership sem ler owner_id
r = await owner2.client.from("posts").select("id,status").like("slug", `%-${tag}`);
const o2 = (r.data ?? []).map((x) => x.status).sort().join(",");
check("owner2 vê só o publicado de owner (não rascunho/despublicado)", !r.error && o2 === "published", r.error?.message ?? o2);
for (const [name, args] of [
  ["publish_post", { target_post_id: postUnpub.id }],
  ["unpublish_post", { target_post_id: postPub.id }],
  ["soft_delete_post", { target_post_id: postPub.id }],
  ["save_post_changes", { target_post_id: postPub.id, new_title: "Hack", new_excerpt: "Tentativa indevida de edicao.", new_body: ["x"], new_category: cat.id, new_hero: null }],
]) {
  r = await owner2.client.rpc(name, args);
  check(`owner2 NÃO executa ${name} sobre post de outro proprietário`, errored(r) && /post_not_found/.test(r.error.message), r.error?.message ?? "executou");
}
const own2Hero = await newMedia(owner2, "Hero do owner2");
const own2Post = await newPost(owner2, "owner2", own2Hero);
r = await owner2.client.rpc("save_post_changes", { target_post_id: own2Post.id, new_title: "R1 owner2", new_excerpt: "Resumo de teste do segundo owner.", new_body: ["x"], new_category: cat.id, new_hero: heroPub.id });
check("owner2 NÃO usa mídia de outro proprietário como capa", errored(r) && /media_not_found/.test(r.error.message), r.error?.message ?? "aceitou");
r = await owner2.client.rpc("save_post_changes", { target_post_id: own2Post.id, new_title: "R1 owner2", new_excerpt: "Resumo de teste do segundo owner.", new_body: ["x"], new_category: cat.id, new_hero: heroDraft.id });
check("owner2 NÃO usa mídia privada de outro proprietário", errored(r) && /media_not_found/.test(r.error.message), r.error?.message ?? "aceitou");
r = await owner2.client.rpc("save_post_changes", { target_post_id: own2Post.id, new_title: "R1 owner2 ok", new_excerpt: "Resumo de teste do segundo owner.", new_body: ["x"], new_category: cat.id, new_hero: own2Hero.id });
check("owner2 edita o próprio post com a própria mídia", !r.error, r.error?.message);
r = await owner2.client.rpc("publish_post", { target_post_id: own2Post.id });
check("owner2 publica o próprio post", !r.error && r.data?.status === "published", r.error?.message);
r = await owner2.client.storage.from("post-media").download(orphan.key);
check("owner2 NÃO baixa objeto privado de owner", errored(r), r.error?.message);

// ========================================================= limpeza
await owner.client.auth.signOut();
await owner2.client.auth.signOut();
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
