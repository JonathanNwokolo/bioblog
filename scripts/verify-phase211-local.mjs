// Phase 2.1.1 — real RLS / Storage / lifecycle probes against a LOCAL Supabase stack.
// Refuses to run against anything but 127.0.0.1/localhost. Never use with remote keys.
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { randomUUID } from "node:crypto";

const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) throw new Error("Somente Supabase local.");
const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const email = process.env.DEV_OWNER_EMAIL ?? "ynara.bioblog@gmail.com";
const password = process.env.DEV_OWNER_PASSWORD;
if (!anonKey || !password) throw new Error("Defina SUPABASE_PUBLISHABLE_KEY e DEV_OWNER_PASSWORD (valores locais).");

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const anon = createClient(url, anonKey, opts);
const owner = createClient(url, anonKey, opts);
const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok: Boolean(ok), detail: String(detail).slice(0, 240) });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + String(detail).slice(0, 160) : ""}`);
}

const { data: session, error: loginError } = await owner.auth.signInWithPassword({ email, password });
check("login do proprietário", !loginError && session.user, loginError?.message);
const uid = session.user.id;

const { data: cat } = await owner.from("categories").select("id,slug").eq("slug", "identificacao").single();
const png = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#2a8" } }).webp().toBuffer();

async function newMedia(alt) {
  const key = `${process.env.KEY_LAYOUT === "owner-folder" ? uid : randomUUID()}/${randomUUID()}.webp`;
  const up = await owner.storage.from("post-media").upload(key, png, { contentType: "image/webp" });
  if (up.error) return { id: null, key, error: up.error };
  const ins = await owner.from("media_assets").insert({ owner_id: uid, object_key: key, mime_type: "image/webp", bytes: png.length, width: 64, height: 48, alt_text: alt, sha256: "a".repeat(64) }).select("id,object_key").single();
  return { id: ins.data?.id, key, error: ins.error };
}

// --- ciclo: rascunho -> publicação
const media = await newMedia("Imagem de teste local");
check("upload + registro de mídia (owner)", media.id, media.error?.message);
const slug = `teste-${randomUUID().slice(0, 8)}`;
const { data: post, error: postErr } = await owner.from("posts").insert({ slug, title: "Post de teste local", excerpt: "Resumo de teste com tamanho válido.", body_json: ["Parágrafo um de teste."], category_id: cat.id, hero_media_id: media.id, author_user_id: uid }).select("id").single();
check("criação de rascunho", post?.id, postErr?.message);

// anon: rascunho invisível
let r = await anon.from("posts").select("id,slug").eq("slug", slug);
check("anon NÃO lê rascunho (sem erro)", !r.error && r.data.length === 0, r.error?.message ?? `rows=${r.data?.length}`);
r = await anon.from("posts").select("id,title,status").eq("status", "published");
check("anon lista publicados sem erro com rascunho existente", !r.error, r.error?.message);

// anon: mídia de rascunho
r = await anon.from("media_assets").select("id").eq("id", media.id);
check("anon NÃO lê mídia em rascunho (sem erro)", !r.error && r.data.length === 0, r.error?.message ?? `rows=${r.data?.length}`);
if (!media.id) { console.log("Mídia ausente; abortando."); process.exit(2); }
const signedDraft = await anon.storage.from("post-media").createSignedUrl(media.key, 60);
check("anon NÃO assina URL de objeto em rascunho", Boolean(signedDraft.error), signedDraft.error?.message);

// publicar
const pub = await owner.rpc("publish_post", { target_post_id: post.id });
check("publish_post (owner)", !pub.error, pub.error?.message);

// anon: dados públicos
r = await anon.from("posts").select("id,slug,title,excerpt,body_json,status,published_at").eq("slug", slug).maybeSingle();
check("anon lê post publicado por slug", r.data?.slug === slug, r.error?.message);
r = await anon.from("posts").select("author_user_id").eq("slug", slug).maybeSingle();
check("anon NÃO lê posts.author_user_id", Boolean(r.error) || r.data === null, r.error ? `erro: ${r.error.message}` : `VAZOU: ${JSON.stringify(r.data)}`);
r = await anon.from("media_assets").select("owner_id").eq("id", media.id).maybeSingle();
check("anon NÃO lê media_assets.owner_id", Boolean(r.error) || r.data === null, r.error ? `erro: ${r.error.message}` : `VAZOU: ${JSON.stringify(r.data)}`);
r = await anon.from("media_assets").select("object_key").eq("id", media.id).maybeSingle();
check("object_key público não revela o UUID do proprietário", r.data?.object_key && !r.data.object_key.includes(uid), r.data?.object_key ? `key=${r.data.object_key.slice(0, 8)}…` : r.error?.message);
r = await anon.from("media_assets").select("id,width,height,alt_text,credit").eq("id", media.id).maybeSingle();
check("anon lê colunas públicas de mídia publicada", r.data?.id === media.id, r.error?.message);
r = await anon.from("posts").select("id,category:categories!posts_category_id_fkey(label),media:media_assets!posts_hero_media_id_fkey(id,width,height,alt_text,credit)").eq("slug", slug).maybeSingle();
check("projeção pública com embeds (consulta do site)", r.data?.media?.id === media.id && r.data?.category?.label, r.error?.message);
const signedPub = await anon.storage.from("post-media").createSignedUrl(media.key, 60);
check("anon assina URL de objeto publicado", signedPub.data?.signedUrl, signedPub.error?.message);
const list = await anon.storage.from("post-media").list("", { limit: 20 });
check("listagem anônima do bucket não revela o UUID do proprietário", !JSON.stringify(list.data ?? []).includes(uid), list.error?.message ?? `itens=${list.data?.length}`);
const mediaDraft = await newMedia("Mídia em rascunho");
const direct = await anon.storage.from("post-media").download(mediaDraft.key);
check("anon NÃO baixa objeto em rascunho", Boolean(direct.error), direct.error?.message);
const directPub = await anon.storage.from("post-media").download(media.key);
check("anon baixa objeto publicado (esperado)", !directPub.error, directPub.error?.message);
const outsider = await anon.storage.from("post-media").upload(`${randomUUID()}/${randomUUID()}.webp`, png, { contentType: "image/webp" });
check("anon NÃO envia objetos", Boolean(outsider.error), outsider.error?.message);
const selectStar = await anon.from("posts").select("*").limit(1);
check("anon: select * em posts é negado (não vaza colunas privadas)", Boolean(selectStar.error), selectStar.error?.message ?? JSON.stringify(selectStar.data).slice(0,80));

// tabelas privadas
for (const t of ["owner_accounts", "post_revisions", "audit_events"]) {
  r = await anon.from(t).select("*").limit(1);
  check(`anon NÃO acessa ${t}`, Boolean(r.error) || r.data.length === 0, r.error?.message ?? "0 linhas");
}
r = await anon.from("posts").insert({ slug: "x-" + randomUUID().slice(0, 6), title: "Intruso", excerpt: "Tentativa de escrita anônima.", category_id: cat.id, author_user_id: uid });
check("anon NÃO insere posts", Boolean(r.error), r.error?.message);
r = await anon.rpc("publish_post", { target_post_id: post.id });
check("anon NÃO executa publish_post", Boolean(r.error), r.error?.message);

// edição de post publicado: hero removido / hero em rascunho
const media2 = await newMedia("Segunda imagem");
const bad = await owner.from("posts").update({ hero_media_id: null }).eq("id", post.id);
check("post publicado NÃO aceita remover hero", Boolean(bad.error), bad.error ? bad.error.message : "ACEITOU (diário quebra)");
await owner.from("posts").update({ hero_media_id: media.id }).eq("id", post.id);
const bad2 = await owner.from("posts").update({ hero_media_id: media2.id }).eq("id", post.id);
r = await anon.from("posts").select("id,media:media_assets!posts_hero_media_id_fkey(id)").eq("slug", slug).maybeSingle();
check("post publicado NÃO fica com hero invisível ao público", !bad2.error ? Boolean(r.data?.media?.id) : true, bad2.error ? `rejeitado: ${bad2.error.message}` : `media=${JSON.stringify(r.data?.media)}`);
await owner.from("posts").update({ hero_media_id: media.id }).eq("id", post.id);

// save_post_changes atômico: troca de hero em post publicado
const swap = await owner.rpc("save_post_changes", { target_post_id: post.id, new_title: "Título editado", new_excerpt: "Resumo editado com tamanho válido.", new_body: ["Novo parágrafo."], new_category: cat.id, new_hero: media2.id });
check("save_post_changes troca hero de post publicado", !swap.error && swap.data?.slug === slug, swap.error?.message);
r = await anon.from("posts").select("title,media:media_assets!posts_hero_media_id_fkey(id)").eq("slug", slug).maybeSingle();
check("anon vê título e novo hero imediatamente", r.data?.title === "Título editado" && r.data?.media?.id === media2.id, r.error?.message);
r = await anon.from("media_assets").select("id").eq("id", media.id);
check("hero antigo volta a ser privado", !r.error && r.data.length === 0, r.error?.message);
const noHero = await owner.rpc("save_post_changes", { target_post_id: post.id, new_title: "Título editado", new_excerpt: "Resumo editado com tamanho válido.", new_body: ["x"], new_category: cat.id, new_hero: null });
check("save_post_changes recusa publicado sem hero", Boolean(noHero.error), noHero.error?.message);
const anonSave = await anon.rpc("save_post_changes", { target_post_id: post.id, new_title: "Hack", new_excerpt: "Tentativa anônima de edição.", new_body: ["x"], new_category: cat.id, new_hero: null });
check("anon NÃO executa save_post_changes", Boolean(anonSave.error), anonSave.error?.message);
await owner.rpc("save_post_changes", { target_post_id: post.id, new_title: "Post de teste local", new_excerpt: "Resumo de teste com tamanho válido.", new_body: ["Parágrafo um de teste."], new_category: cat.id, new_hero: media.id });

// negativos de autorização com segundo usuário e segundo proprietário (somente com chave local de serviço)
if (process.env.SUPABASE_SECRET_KEY) {
  const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, opts);
  const mk = async (tag, isOwner) => {
    const mail = `${tag}-${randomUUID().slice(0, 6)}@example.test`;
    const created = await admin.auth.admin.createUser({ email: mail, password: "senha-local-2", email_confirm: true });
    if (isOwner) await admin.from("owner_accounts").insert({ user_id: created.data.user.id });
    const client = createClient(url, anonKey, opts);
    await client.auth.signInWithPassword({ email: mail, password: "senha-local-2" });
    return { client, id: created.data.user.id };
  };
  const stranger = await mk("estranho", false);
  const other = await mk("outra-dona", true);
  // Phase 2.1.2: published posts are public to any authenticated session; drafts are not.
  const draftMedia = await newMedia("Mídia do rascunho alheio");
  const { data: draftPost } = await owner.from("posts").insert({ slug: `rascunho-${randomUUID().slice(0, 8)}`, title: "Rascunho alheio", excerpt: "Rascunho que ninguém além da dona pode ler.", body_json: ["Texto."], category_id: cat.id, hero_media_id: draftMedia.id, author_user_id: uid }).select("id").single();
  r = await stranger.client.from("posts").select("id").eq("id", post.id);
  check("autenticado não-proprietário LÊ post publicado", !r.error && r.data.length === 1, r.error?.message);
  r = await stranger.client.from("posts").select("id").eq("id", draftPost?.id);
  check("autenticado não-proprietário NÃO lê rascunho alheio", !r.error && r.data.length === 0, r.error?.message);
  r = await stranger.client.rpc("publish_post", { target_post_id: post.id });
  check("autenticado não-proprietário NÃO publica", Boolean(r.error), r.error?.message);
  r = await stranger.client.rpc("save_post_changes", { target_post_id: post.id, new_title: "Hack", new_excerpt: "Tentativa de edição indevida.", new_body: ["x"], new_category: cat.id, new_hero: null });
  check("autenticado não-proprietário NÃO edita", Boolean(r.error), r.error?.message);
  const sUp = await stranger.client.storage.from("post-media").upload(`${randomUUID()}/${randomUUID()}.webp`, png, { contentType: "image/webp" });
  check("autenticado não-proprietário NÃO envia mídia", Boolean(sUp.error), sUp.error?.message);
  r = await stranger.client.from("posts").select("author_user_id").eq("id", draftPost?.id);
  check("autenticado não-proprietário NÃO lê author_user_id (coluna negada a todo papel de API desde a 20261011040000)", Boolean(r.error) ? /permission denied/i.test(r.error.message) : r.data.length === 0, r.error?.message);
  r = await other.client.from("posts").select("id").eq("id", draftPost?.id);
  check("segundo proprietário NÃO enxerga rascunho do primeiro", !r.error && r.data.length === 0, r.error?.message);
  for (const [name, call] of [
    ["publish_post", () => other.client.rpc("publish_post", { target_post_id: post.id })],
    ["unpublish_post", () => other.client.rpc("unpublish_post", { target_post_id: post.id })],
    ["soft_delete_post", () => other.client.rpc("soft_delete_post", { target_post_id: post.id })],
  ]) {
    r = await call();
    check(`segundo proprietário NÃO executa ${name} em post alheio`, Boolean(r.error), r.error?.message);
  }
  r = await other.client.from("media_assets").update({ state: "draft" }).eq("id", media.id).select("id");
  check("segundo proprietário NÃO altera mídia alheia", !r.error && r.data.length === 0, r.error?.message);
  const del = await other.client.storage.from("post-media").remove([media.key]);
  const still = await anon.storage.from("post-media").download(media.key);
  check("segundo proprietário NÃO apaga objeto alheio", !still.error, del.error?.message ?? `removidos=${del.data?.length}`);
  r = await owner.from("media_assets").update({ state: "draft" }).eq("id", media.id).select("id");
  check("mídia de post publicado não pode ser tornada privada", Boolean(r.error) || r.data.length === 0, r.error?.message);
  await admin.auth.admin.deleteUser(stranger.id);
  await admin.auth.admin.deleteUser(other.id);
} else {
  console.log("SKIP  negativos multiusuário (defina SUPABASE_SECRET_KEY local)");
}

// despublicar / excluir
const unp = await owner.rpc("unpublish_post", { target_post_id: post.id });
check("unpublish_post", !unp.error, unp.error?.message);
r = await anon.from("posts").select("id").eq("slug", slug);
check("anon NÃO vê post despublicado", !r.error && r.data.length === 0, r.error?.message);
const stillSigned = await anon.storage.from("post-media").createSignedUrl(media.key, 60);
check("mídia volta a ser privada após despublicar", Boolean(stillSigned.error), stillSigned.error?.message);
const del = await owner.rpc("soft_delete_post", { target_post_id: post.id });
check("soft_delete_post", !del.error, del.error?.message);

// categoria inativa não pode derrubar leitura pública
const { data: cat2 } = await owner.from("categories").select("id").eq("slug", "diagnostico").single();
await owner.from("categories").update({ active: false }).eq("id", cat2.id);
r = await anon.from("categories").select("id,slug");
check("anon lista categorias com uma inativa (sem erro)", !r.error && r.data.length >= 1, r.error?.message);
await owner.from("categories").update({ active: true }).eq("id", cat2.id);

// limpeza lógica
await owner.auth.signOut();
const failed = results.filter((x) => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} verificações passaram`);
if (process.env.EVIDENCE_OUT) {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(process.env.EVIDENCE_OUT, JSON.stringify({ ran_at: new Date().toISOString(), target: url, results }, null, 2));
}
process.exit(failed.length ? 1 : 0);
