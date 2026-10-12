import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { describe, it } from "node:test";
import { isUuid, isValidSlug, publicPathsForSlugs } from "../src/lib/cms/paths.ts";
import { toPublicPostOrNull, type CmsPostRow } from "../src/lib/cms/types.ts";
import { formatDate } from "../src/lib/format.ts";
import { isSameOrigin } from "../src/lib/cms/validation.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migrations = readdirSync(new URL("../supabase/migrations", import.meta.url)).sort()
  .map((name) => read(`supabase/migrations/${name}`)).join("\n");

describe("revalidação por slug persistido", () => {
  it("só gera caminhos para slugs válidos e sem duplicatas", () => {
    assert.deepEqual(publicPathsForSlugs("antigo", "novo", "antigo"), ["/", "/diario", "/diario/antigo", "/diario/novo"]);
  });

  it("descarta slugs forjados (traversal, query, maiúsculas, vazio, null)", () => {
    const forged = ["../admin", "a/b", "x?y=1", "A-B", "", "-a", "a--b", null, undefined, "a".repeat(97)];
    assert.deepEqual(publicPathsForSlugs(...forged), ["/", "/diario"]);
    for (const value of forged) assert.equal(isValidSlug(value), false);
  });

  it("valida UUIDs de identificadores", () => {
    assert.equal(isUuid("0b6f3c1e-8f0e-4a39-9d3b-4f1b0c1a7e11"), true);
    assert.equal(isUuid("1; drop table posts"), false);
    assert.equal(isUuid(undefined), false);
  });

  it("Server Actions não leem slug do formulário nem revalidam caminho montado a partir dele", () => {
    const actions = read("src/app/admin/actions.ts");
    assert.doesNotMatch(actions, /text\(formData,\s*"slug"\)/);
    assert.doesNotMatch(actions, /revalidatePath\(`/);
    assert.match(actions, /rpc\("publish_post"[\s\S]*refreshPublicContent\(rowSlug\(data\)\)/);
    assert.match(actions, /rpc\("unpublish_post"[\s\S]*refreshPublicContent\(rowSlug\(data\)\)/);
    assert.match(actions, /rpc\("soft_delete_post"[\s\S]*refreshPublicContent\(rowSlug\(data\)\)/);
    assert.match(actions, /refreshPublicContent\(rowSlug\(before\), rowSlug\(data\)\)/);
  });

  it("formulários da página de edição não enviam slug", () => {
    assert.doesNotMatch(read("src/app/admin/posts/[id]/edit/page.tsx"), /name="slug"/);
  });

  it("toda Server Action de mutação exige editor com sessão verificada", () => {
    const actions = read("src/app/admin/actions.ts");
    const mutating = ["createPostAction", "updatePostAction", "publishPostAction", "unpublishPostAction", "deletePostAction"];
    for (const name of mutating) {
      const body = actions.slice(actions.indexOf(`function ${name}`)).split("\nexport ")[0];
      assert.match(body, /(requireEditor|getCurrentEditor)\(\{ verify: true \}\)/, name);
    }
  });
});

describe("separação entre dados públicos e administrativos", () => {
  const publicGrants = [...migrations.matchAll(/grant select \(([^)]*)\)\s+on public\.(posts|media_assets) to anon/g)];

  it("anon recebe grant por coluna e nunca owner_id / author_user_id / sha256", () => {
    assert.equal(publicGrants.length, 2);
    for (const [, columns] of publicGrants) {
      assert.doesNotMatch(columns, /owner_id|author_user_id|sha256|bytes/);
    }
    assert.match(migrations, /revoke select on public\.posts, public\.media_assets from anon/);
  });

  it("consultas públicas selecionam apenas colunas explícitas e públicas", () => {
    const repository = read("src/lib/cms/repository.ts");
    assert.doesNotMatch(repository, /select\(\s*["'`]\*/);
    assert.doesNotMatch(repository, /owner_id|author_user_id/);
    assert.doesNotMatch(read("src/app/api/media/[id]/route.ts"), /owner_id|select\(["']\*/);
  });

  it("políticas para anon não chamam is_active_owner (anon não lê owner_accounts)", () => {
    const anonPolicies = [...migrations.matchAll(/create policy anon_\w+ on [\w.]+ for select to anon\s+using \(([\s\S]*?)\);/g)];
    assert.ok(anonPolicies.length >= 4);
    for (const [, expression] of anonPolicies) assert.doesNotMatch(expression, /is_active_owner/);
  });

  it("chave do objeto não embute o id do proprietário", () => {
    const route = read("src/app/api/admin/media/route.ts");
    assert.doesNotMatch(route, /`\$\{editor\.id\}\//);
  });

  it("mutações dependem de RPC security invoker com checagem de proprietário", () => {
    for (const fn of ["save_post_changes", "publish_post", "unpublish_post", "soft_delete_post"]) {
      const start = Math.max(migrations.lastIndexOf(`create or replace function public.${fn}`), migrations.lastIndexOf(`create function public.${fn}`));
      assert.ok(start >= 0, fn);
      const body = migrations.slice(start, migrations.indexOf("$$;", start));
      assert.ok(body.includes("security invoker"), `${fn} security invoker`);
      assert.ok(body.includes("is_active_owner()"), `${fn} owner check`);
    }
    assert.doesNotMatch(migrations.replace(/--.*/g, ""), /security definer/i);
  });
});

describe("contrato mínimo de leitura (decisão R1)", () => {
  const minimal = read("supabase/migrations/20261011040000_phase212_minimal_read_contract.sql");
  const code = minimal.replace(/--.*/g, "");
  const allCode = migrations.replace(/--.*/g, "");
  const grantColumns = (table: string, role: string) =>
    allCode.match(new RegExp(String.raw`grant select \(([^)]*)\)\s+on public\.${table} to ${role}`))?.[1] ?? "";

  it("authenticated recebe SELECT por coluna e nunca owner_id / author_user_id / sha256 / bytes", () => {
    assert.match(code, /revoke select on public\.posts, public\.media_assets from authenticated/);
    for (const table of ["posts", "media_assets"]) {
      const columns = grantColumns(table, "authenticated");
      assert.ok(columns.length > 0, table);
      assert.doesNotMatch(columns, /owner_id|author_user_id|sha256|bytes|storage_bucket/);
      assert.equal(
        columns.split(",").map((c) => c.trim()).sort().join(),
        grantColumns(table, "anon").split(",").map((c) => c.trim()).sort().join(),
        `${table}: contrato de authenticated idêntico ao de anon`,
      );
    }
  });

  it("UPDATE por coluna: identidade e integridade não são regraváveis pela API", () => {
    const updates = [...code.matchAll(/grant update \(([^)]*)\)\s+on public\.(\w+) to authenticated/g)];
    assert.equal(updates.length, 2);
    for (const [, columns] of updates) assert.doesNotMatch(columns, /(slug|object_key|owner_id|author_user_id|sha256|bytes|created_at)/);
  });

  it("RPCs de ciclo de vida não leem colunas internas nem devolvem a linha inteira", () => {
    for (const fn of ["publish_post", "unpublish_post", "soft_delete_post", "save_post_changes"]) {
      const start = code.indexOf(`create function public.${fn}`);
      assert.ok(start >= 0, fn);
      const body = code.slice(start, code.indexOf("$$;", code.indexOf("as $$", start)));
      assert.doesNotMatch(body, /author_user_id|owner_id|\*\s+into|returning\s+\*|returns public\.posts/, fn);
      assert.match(body, /returns public\.post_lifecycle_result/, fn);
      assert.match(body, /security invoker/, fn);
    }
  });

  it("funções recriadas não ficam executáveis por public/anon", () => {
    assert.match(code, /revoke all on function public\.publish_post\(uuid\), public\.unpublish_post\(uuid\), public\.soft_delete_post\(uuid\),\s+public\.save_post_changes\(uuid, text, text, jsonb, uuid, uuid\) from public, anon/);
    assert.doesNotMatch(code, /security definer/i);
  });

  it("nenhuma consulta do app lê ou filtra colunas internas", () => {
    const files = [
      "src/app/api/admin/media/[id]/route.ts", "src/app/api/media/[id]/route.ts", "src/app/admin/page.tsx",
      "src/app/admin/posts/[id]/edit/page.tsx", "src/app/admin/posts/[id]/preview/page.tsx", "src/lib/cms/repository.ts",
    ];
    for (const file of files) {
      const source = read(file);
      assert.doesNotMatch(source, /select\(\s*["'`]\*/, file);
      assert.doesNotMatch(source, /\.eq\(\s*["'](owner_id|author_user_id)["']/, file);
    }
  });
});

describe("resiliência da projeção pública", () => {
  const base: CmsPostRow = {
    id: "1", slug: "a", title: "T", excerpt: "E", body_json: ["p"], status: "published",
    first_published_at: "2026-01-01T00:00:00Z", published_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    category: { label: "Identificação" },
    media: { id: "m", width: 10, height: 10, alt_text: "alt", credit: "" },
  };

  it("registro completo vira post público sem campos administrativos", () => {
    const post = toPublicPostOrNull(base);
    assert.ok(post);
    assert.equal(post.media.src, "/api/media/m");
    assert.equal(JSON.stringify(post).includes("owner"), false);
  });

  it("registro sem mídia ou categoria é descartado em vez de derrubar o Diário", () => {
    assert.equal(toPublicPostOrNull({ ...base, media: null }), null);
    assert.equal(toPublicPostOrNull({ ...base, category: null }), null);
    assert.equal(toPublicPostOrNull({ ...base, published_at: null }), null);
  });
});

describe("origem do upload", () => {
  it("rejeita origem cruzada e aceita mesma origem", () => {
    assert.equal(isSameOrigin("https://evil.example", "microcosmos.example"), false);
    assert.equal(isSameOrigin("not a url", "microcosmos.example"), false);
    assert.equal(isSameOrigin("https://microcosmos.example", "microcosmos.example"), true);
    assert.equal(isSameOrigin(null, "microcosmos.example"), true);
  });
});

describe("datas publicadas pelo CMS", () => {
  it("formata timestamp com hora e fuso sem lançar (regressão: 500 após publicar)", () => {
    assert.match(formatDate("2026-10-11T03:28:53.120+00:00"), /out/);
    assert.equal(formatDate("2026-10-11T03:28:53.120+00:00"), "11 de out. de 2026");
  });

  it("mantém datas só-dia sem deslocar o dia e tolera valor inválido", () => {
    assert.equal(formatDate("2026-10-10"), "10 de out. de 2026");
    assert.equal(formatDate("lixo"), "");
  });
});
