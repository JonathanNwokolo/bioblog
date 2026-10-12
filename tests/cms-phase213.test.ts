import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { describe, it } from "node:test";
import { flashFromSearchParams } from "../src/app/admin/flash.ts";
import { BodyTooLargeError, readBodyWithLimit } from "../src/lib/cms/upload.ts";
import { fieldErrors, isTrustedMutationRequest, loginSchema, postInputSchema } from "../src/lib/cms/validation.ts";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

function sourceFiles(dir: string): string[] {
  return readdirSync(new URL(dir, root)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    return statSync(new URL(rel, root)).isDirectory() ? sourceFiles(rel) : [rel];
  });
}

const headers = (init: Record<string, string>) => new Headers(init);

describe("Fase 2.1.3 · CSRF em mutações com cookie", () => {
  it("exige que Origin coincida com o host", () => {
    assert.equal(isTrustedMutationRequest(headers({ host: "site.example", origin: "https://site.example" })), true);
    assert.equal(isTrustedMutationRequest(headers({ host: "site.example", origin: "https://evil.example" })), false);
    assert.equal(isTrustedMutationRequest(headers({ host: "site.example", origin: "null" })), false);
  });

  it("sem Origin, recusa Sec-Fetch-Site cross-site/same-site e aceita same-origin/none/ausente", () => {
    assert.equal(isTrustedMutationRequest(headers({ host: "site.example", "sec-fetch-site": "cross-site" })), false);
    assert.equal(isTrustedMutationRequest(headers({ host: "site.example", "sec-fetch-site": "same-site" })), false);
    assert.equal(isTrustedMutationRequest(headers({ host: "site.example", "sec-fetch-site": "same-origin" })), true);
    assert.equal(isTrustedMutationRequest(headers({ host: "site.example", "sec-fetch-site": "none" })), true);
    assert.equal(isTrustedMutationRequest(headers({ host: "site.example" })), true);
  });

  it("atrás de proxy usa x-forwarded-host", () => {
    assert.equal(isTrustedMutationRequest(headers({ host: "internal:3000", "x-forwarded-host": "site.example", origin: "https://site.example" })), true);
    assert.equal(isTrustedMutationRequest(headers({ host: "internal:3000", origin: "https://site.example" })), false);
  });
});

describe("Fase 2.1.3 · limite de corpo do upload", () => {
  const request = (body: BodyInit | null, init: Record<string, string> = {}) =>
    new Request("http://localhost/api/admin/media", { method: "POST", body, headers: init, duplex: "half" } as RequestInit);

  it("lê corpo dentro do limite", async () => {
    const bytes = await readBodyWithLimit(request(new Uint8Array(100)), 1024);
    assert.equal(bytes.byteLength, 100);
  });

  it("recusa Content-Length declarado acima do limite sem ler o corpo", async () => {
    await assert.rejects(readBodyWithLimit(request(new Uint8Array(10), { "content-length": "999999" }), 1024), BodyTooLargeError);
  });

  it("interrompe corpo em stream (sem Content-Length) que ultrapassa o limite", async () => {
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(new Uint8Array(512));
        if (pulled > 1000) controller.close();
      },
    });
    await assert.rejects(readBodyWithLimit(request(stream), 2048), BodyTooLargeError);
    assert.ok(pulled < 20, `leu ${pulled} blocos antes de abortar`);
  });
});

describe("Fase 2.1.3 · validação em português com erro por campo", () => {
  it("mensagens de limite estão em português (sem texto padrão em inglês)", () => {
    const result = postInputSchema.safeParse({
      title: "a".repeat(200), excerpt: "curto", body: "x", categoryId: "nao-e-uuid",
    });
    assert.equal(result.success, false);
    if (result.success) return;
    const errors = fieldErrors(result.error);
    assert.deepEqual(Object.keys(errors).sort(), ["body", "categoryId", "excerpt", "title"]);
    for (const message of Object.values(errors)) assert.doesNotMatch(message, /Too (big|small)|Invalid|expected/i);
    assert.match(errors.title ?? "", /180/);
  });

  it("login devolve mensagem em português", () => {
    const result = loginSchema.safeParse({ email: "x", password: "123" });
    assert.equal(result.success, false);
    if (!result.success) for (const issue of result.error.issues) assert.doesNotMatch(issue.message, /Invalid|Too small/i);
  });
});

describe("Fase 2.1.3 · mensagens de retorno só por allowlist", () => {
  it("não reflete texto arbitrário da query string", () => {
    assert.equal(flashFromSearchParams({ error: "<script>alert(1)</script>" }), null);
    assert.equal(flashFromSearchParams({ error: "publish_generic" })?.kind, "error");
    assert.equal(flashFromSearchParams({ published: "1" })?.kind, "success");
    assert.equal(flashFromSearchParams({ media_cleaned: "abc" }), null);
    assert.match(flashFromSearchParams({ media_cleaned: "2" })?.text ?? "", /^2 imagens/);
  });
});

describe("Fase 2.1.3 · cabeçalhos de segurança", async () => {
  const config = (await import("../next.config.ts")).default;
  const rules = await config.headers!();
  const all = rules.find((rule) => rule.source === "/:path*")!;
  const value = (key: string) => all.headers.find((header) => header.key === key)?.value ?? "";

  it("CSP bloqueia plugins, enquadramento e base/form externos", () => {
    const csp = value("Content-Security-Policy");
    for (const directive of ["default-src 'self'", "object-src 'none'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'"]) {
      assert.ok(csp.includes(directive), directive);
    }
    assert.doesNotMatch(csp, /\*|unsafe-eval/);
  });

  it("define Referrer-Policy, nosniff, Permissions-Policy, HSTS e X-Frame-Options", () => {
    assert.equal(value("X-Content-Type-Options"), "nosniff");
    assert.equal(value("Referrer-Policy"), "strict-origin-when-cross-origin");
    assert.match(value("Permissions-Policy"), /camera=\(\)/);
    assert.match(value("Strict-Transport-Security"), /max-age=\d{7,}/);
    assert.equal(value("X-Frame-Options"), "DENY");
    assert.equal(config.poweredByHeader, false);
  });

  it("área administrativa não é indexável nem cacheável", () => {
    const admin = rules.filter((rule) => rule.source.startsWith("/admin") || rule.source.startsWith("/api/admin"));
    assert.equal(admin.length, 2);
    for (const rule of admin) {
      assert.ok(rule.headers.some((h) => h.key === "X-Robots-Tag" && /noindex/.test(h.value)));
      assert.ok(rule.headers.some((h) => h.key === "Cache-Control" && /no-store/.test(h.value)));
    }
  });
});

describe("Fase 2.1.3 · XSS armazenado e superfície de código", () => {
  const files = sourceFiles("src").filter((file) => /\.(ts|tsx)$/.test(file));

  it("nenhum componente injeta HTML bruto", () => {
    for (const file of files) {
      const source = read(file);
      assert.doesNotMatch(source, /dangerouslySetInnerHTML|\.innerHTML\s*=|document\.write\(|\beval\(|new Function\(/, file);
    }
  });

  it("todo link target=_blank traz rel noopener", () => {
    for (const file of files) {
      const source = read(file);
      for (const match of source.matchAll(/target="_blank"[\s\S]{0,120}?\/?>/g)) {
        assert.match(match[0], /rel="[^"]*noopener/, file);
      }
    }
  });

  it("segredos de serviço nunca são referenciados no código da aplicação", () => {
    for (const file of files) {
      assert.doesNotMatch(read(file), /SERVICE_ROLE|service_role|SUPABASE_SECRET|sb_secret_/i, file);
    }
  });

  it("Server Actions invalidam o cache com updateTag (expiração imediata), não stale-while-revalidate", () => {
    const actions = read("src/app/admin/actions.ts");
    assert.match(actions, /updateTag\("posts"\)/);
    assert.doesNotMatch(actions, /revalidateTag/);
  });

  it("upload é lido com limite de bytes e falha com mensagens em português", () => {
    const route = read("src/app/api/admin/media/route.ts");
    assert.match(route, /readBodyWithLimit/);
    assert.doesNotMatch(route, /request\.formData\(\)/);
    assert.match(route, /isTrustedMutationRequest/);
    assert.match(route, /limitInputPixels/);
  });

  it("mídia pública só é servida se publicada (consulta anon filtra por estado)", () => {
    const repository = read("src/lib/cms/repository.ts");
    assert.match(repository, /getPublishedMediaUrl[\s\S]*\.eq\("state", "published"\)[\s\S]*\.is\("deleted_at", null\)/);
  });

  it("limpeza de mídia sem uso nunca toca mídia publicada nem uploads recentes", () => {
    const media = read("src/lib/cms/media.ts");
    assert.match(media, /\.eq\("state", "draft"\)/);
    assert.match(media, /\.lt\("created_at", cutoff\)/);
    const actions = read("src/app/admin/actions.ts");
    assert.match(actions, /cleanupUnusedMediaAction[\s\S]*requireEditor\(\{ verify: true \}\)/);
  });
});

describe("Fase 2.1.3 · sessão: verificação no servidor por padrão", () => {
  it("getCurrentEditor confirma a sessão no Auth (getUser) a menos que verify:false seja explícito", () => {
    const auth = read("src/lib/cms/auth.ts");
    assert.match(auth, /options\.verify \?\? true/);
    assert.match(auth, /auth\.getUser\(\)/);
  });

  it("nenhuma página ou rota administrativa desativa a verificação", () => {
    for (const file of sourceFiles("src/app").filter((f) => /(admin|api)/.test(f))) {
      assert.doesNotMatch(read(file), /verify:\s*false/, file);
    }
  });
});

describe("Fase 2.1.3 · proxy bloqueia mutações cross-site (Server Actions e rotas)", () => {
  const proxySource = read("src/proxy.ts");

  it("toda requisição não segura passa por isTrustedMutationRequest antes de qualquer outra lógica", () => {
    assert.match(proxySource, /SAFE_METHODS\s*=\s*new Set\(\["GET", "HEAD", "OPTIONS"\]\)/);
    assert.match(proxySource, /!SAFE_METHODS\.has\(request\.method\)\s*&&\s*!isTrustedMutationRequest\(request\.headers\)[\s\S]*status: 403/);
    assert.ok(proxySource.indexOf("isTrustedMutationRequest(request.headers)") < proxySource.indexOf("refreshSupabaseSession(request)"));
  });

  it("o matcher cobre /admin (Server Actions) e /api/admin (rotas)", () => {
    assert.match(proxySource, /matcher: \["\/admin\/:path\*", "\/api\/admin\/:path\*"\]/);
  });

  it("a decisão aplicada no proxy recusa cross-site sem Origin (comportamento)", () => {
    assert.equal(isTrustedMutationRequest(new Headers({ host: "site.example", "sec-fetch-site": "cross-site" })), false);
    assert.equal(isTrustedMutationRequest(new Headers({ host: "site.example", origin: "https://evil.example" })), false);
  });
});

describe("Fase 2.1.3 · configuração", () => {
  it("CSP inclui a origem do Supabase quando configurada", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
    const mod = await import(`../next.config.ts?${Date.now()}`);
    const rules = await mod.default.headers();
    const csp = rules[0].headers.find((h: { key: string }) => h.key === "Content-Security-Policy").value as string;
    assert.match(csp, /img-src [^;]*https:\/\/abc\.supabase\.co/);
    assert.match(csp, /connect-src [^;]*https:\/\/abc\.supabase\.co/);
  });
});
