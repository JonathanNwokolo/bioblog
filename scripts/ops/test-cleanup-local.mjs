// Proves cleanup-phase212-test-data.sql against the LOCAL database using fixtures with the manifest ids.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const env = Object.fromEntries(readFileSync(".env.e2e.local", "utf8").split("\n").map((l) => l.trim()).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const sql = (text) => {
  const file = join(tmpdir(), `mc-${Math.random().toString(16).slice(2)}.sql`);
  writeFileSync(file, text);
  try {
    const out = execFileSync("npx.cmd", ["--yes", "supabase@2.120.0", "db", "query", "--local", "-f", file], { encoding: "utf8", shell: true });
    const json = out.slice(out.indexOf("{"));
    return JSON.parse(json).rows ?? [];
  } finally { unlinkSync(file); }
};
const uid = env.E2E_OWNER_ID;
const P1 = "98a207ba-5289-4801-9e53-08d78dcbd146"; const P2 = "e12a49b8-b0ae-45b5-bbf8-a934376359fe";
const M1 = "8180ee80-a46f-479b-a82f-2d9ee4c18a0a"; const M2 = "291e010c-2db8-45af-a3fa-c4081c53b5d1";
const cleanup = readFileSync("scripts/ops/cleanup-phase212-test-data.sql", "utf8");
const counts = () => sql(`select (select count(*) from public.posts where id in ('${P1}','${P2}')) posts, (select count(*) from public.media_assets where id in ('${M1}','${M2}')) media, (select count(*) from public.post_revisions where post_id in ('${P1}','${P2}')) revs`)[0];
const category = sql("select id from public.categories limit 1")[0].id;

function seed(title2) {
  sql(`with a as (insert into public.media_assets(id, owner_id, object_key, state, mime_type, bytes, width, height, alt_text, sha256) values ('${M1}','${uid}','64735f74-5c82-41fa-a001-406813663c6b/c786d6c9-b51b-46f4-87cd-99c4a02625f3.webp','draft','image/webp',1,1,1,'fixture','${"a".repeat(64)}'),('${M2}','${uid}','f65424d0-c1b5-469a-b578-b6183d919d96/934f9a6e-dff2-4013-bcc7-b255f36610ce.webp','draft','image/webp',1,1,1,'fixture','${"b".repeat(64)}') on conflict do nothing returning 1) select count(*) from a`);
  sql(`with a as (insert into public.posts(id, slug, title, excerpt, body_json, category_id, hero_media_id, author_user_id, status, deleted_at) values ('${P1}','qa-fase-2-1-2-teste-temporario','QA Fase 2.1.2 — teste temporário','Resumo de teste com tamanho válido.','["x"]','${category}','${M1}','${uid}','deleted', now()),('${P2}','qa-producao-temporaria','${title2}','Resumo de teste com tamanho válido.','["x"]','${category}','${M2}','${uid}','deleted', now()) on conflict do nothing returning 1) select count(*) from a`);
}
const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`); };

seed("Post real da autora");           // guard must refuse: title does not start with 'QA '
let r = sql(cleanup)[0];
check("guarda recusa linhas que não batem com o manifesto", Number(r.posts_deleted) === 0 && Number(r.media_deleted) === 0, JSON.stringify(r));
sql(`with a as (delete from public.posts where id = '${P2}' returning 1) select count(*) from a`);
sql(`with a as (insert into public.posts(id, slug, title, excerpt, body_json, category_id, hero_media_id, author_user_id, status, deleted_at) values ('${P2}','qa-producao-temporaria','QA Produção temporária','Resumo de teste com tamanho válido.','["x"]','${category}','${M2}','${uid}','deleted', now()) returning 1) select count(*) from a`);
r = sql(cleanup)[0];
check("com o manifesto exato apaga 2 posts e 2 mídias", Number(r.posts_deleted) === 2 && Number(r.media_deleted) === 2, JSON.stringify(r));
const c = counts();
check("nada do manifesto permanece (revisões em cascata)", Number(c.posts) === 0 && Number(c.media) === 0 && Number(c.revs) === 0, JSON.stringify(c));
r = sql(cleanup)[0];
check("reexecução é inócua (idempotente)", Number(r.posts_deleted) === 0, JSON.stringify(r));
if (results.includes(false)) process.exit(1);
