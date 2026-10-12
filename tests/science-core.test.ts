import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SciCache } from "../src/lib/science/cache.ts";
import { PROVIDER_HOSTS } from "../src/lib/science/config.ts";
import { assertAllowedUrl, buildProviderUrl, injectedFault, providerGetJson, providerGetText } from "../src/lib/science/http.ts";
import { CallerBudget, ProviderLimiter } from "../src/lib/science/limiter.ts";
import { checkNameQuery, foldName } from "../src/lib/science/query.ts";
import { ProviderError } from "../src/lib/science/types.ts";
import { decodeEntities, parseXml, XmlParseError } from "../src/lib/science/ncbi/xml.ts";
import { installFakeProviders, jsonResponse, xmlResponse } from "./helpers/science.ts";

const matchUrl = () => buildProviderUrl("gbif", "https://api.gbif.org/v1/species/match", { name: "x" });

describe("consulta do visitante (checkNameQuery)", () => {
  it("normaliza espaços e aceita nomes com diacríticos, hífen e parênteses", () => {
    assert.deepEqual(checkNameQuery("  Giardia   duodenalis "), { ok: true, query: "Giardia duodenalis", asTaxId: null });
    assert.equal(checkNameQuery("Escherichia coli (K-12)").ok, true);
    assert.equal(checkNameQuery("Pseudomonas aeruginosa PAO1").ok, true);
    assert.equal(checkNameQuery("Giardia OR Homo").ok, true, "operadores viram texto de frase, sem efeito");
  });

  it("rejeita vazio, curto, longo e caracteres de sintaxe do Entrez", () => {
    const bad = ["", "   ", "a", "x".repeat(81), 'Giardia"[Subtree]', "Giardia* ", "a[b]c", "txid2[Subtree]", "Giardia\u0000", "<script>", "a;b", "a/b", "a\\b", "../../etc"];
    for (const value of bad) assert.equal(checkNameQuery(value).ok, false, `deveria rejeitar ${JSON.stringify(value)}`);
  });

  it("trata número como TaxID e rejeita zero, negativos e números enormes", () => {
    assert.deepEqual(checkNameQuery("5741"), { ok: true, query: "5741", asTaxId: "5741" });
    assert.equal(checkNameQuery("0").ok, false);
    assert.equal(checkNameQuery("12345678901").ok, false);
    assert.equal(checkNameQuery("-5").ok, false);
  });

  it("foldName ignora caixa e diacríticos", () => {
    assert.equal(foldName("  GIÁRDIA   Lamblia "), "giardia lamblia");
  });
});

describe("construção de URL e SSRF", () => {
  it("monta URL com host fixo e codifica o valor do visitante", () => {
    const url = buildProviderUrl("ncbi-taxonomy", "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi", {
      term: '"x"&db=nucleotide#frag',
      db: "taxonomy",
    });
    assert.equal(url.hostname, "eutils.ncbi.nlm.nih.gov");
    assert.equal(url.searchParams.get("db"), "taxonomy");
    assert.equal(url.searchParams.get("term"), '"x"&db=nucleotide#frag');
    assert.equal(url.hash, "");
  });

  it("recusa qualquer host fora da lista, protocolo http, credenciais e porta", () => {
    const bad = [
      "https://evil.example/entrez/eutils/esearch.fcgi",
      "http://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi",
      "https://eutils.ncbi.nlm.nih.gov@evil.example/",
      "https://user:pw@eutils.ncbi.nlm.nih.gov/",
      "https://eutils.ncbi.nlm.nih.gov:8443/",
      "https://eutils.ncbi.nlm.nih.gov.evil.example/",
      "https://169.254.169.254/latest/meta-data",
      "https://localhost/",
    ];
    for (const raw of bad) assert.throws(() => assertAllowedUrl("ncbi-taxonomy", new URL(raw)), ProviderError, raw);
    assert.throws(() => assertAllowedUrl("gbif", new URL("https://eutils.ncbi.nlm.nih.gov/")), ProviderError);
    assert.deepEqual(PROVIDER_HOSTS.gbif, ["api.gbif.org"]);
  });

  it("buildProviderUrl rejeita base fora da lista de hosts", () => {
    assert.throws(() => buildProviderUrl("gbif", "https://evil.example/v1/species/match", { name: "x" }), ProviderError);
  });
});

describe("transporte (timeouts, tentativas, tamanho)", () => {
  it("repete 429 com limite e acaba em UPSTREAM_RATE_LIMITED sem expor o corpo", async () => {
    const fake = installFakeProviders(() => new Response("segredo-interno", { status: 429, headers: { "retry-after": "0" } }));
    try {
      await assert.rejects(providerGetJson("gbif", matchUrl()), (error: unknown) => {
        assert.ok(error instanceof ProviderError);
        assert.equal(error.code, "UPSTREAM_RATE_LIMITED");
        assert.ok(!String(error.message).includes("segredo"));
        return true;
      });
      assert.equal(fake.calls.length, 3, "1 tentativa + 2 repetições, nunca mais");
    } finally {
      fake.restore();
    }
  });

  it("não repete 4xx", async () => {
    const fake = installFakeProviders(() => new Response("nope", { status: 404 }));
    try {
      await assert.rejects(providerGetJson("gbif", matchUrl()), ProviderError);
      assert.equal(fake.calls.length, 1);
    } finally {
      fake.restore();
    }
  });

  it("converte timeout do fetch em UPSTREAM_TIMEOUT", async () => {
    const fake = installFakeProviders(() => {
      const error = new Error("timeout");
      error.name = "TimeoutError";
      throw error;
    });
    try {
      await assert.rejects(providerGetJson("gbif", matchUrl()), (e: unknown) => e instanceof ProviderError && e.code === "UPSTREAM_TIMEOUT");
    } finally {
      fake.restore();
    }
  });

  it("rejeita corpo acima do teto e tipo de conteúdo inesperado", async () => {
    let fake = installFakeProviders(() => jsonResponse("x".repeat(5_100_000)));
    try {
      await assert.rejects(providerGetText("gbif", matchUrl(), { accept: "json" }), (e: unknown) => e instanceof ProviderError && e.code === "UPSTREAM_TOO_LARGE");
    } finally {
      fake.restore();
    }
    fake = installFakeProviders(() => new Response("<html>", { status: 200, headers: { "content-type": "text/html" } }));
    try {
      await assert.rejects(providerGetText("gbif", matchUrl(), { accept: "json" }), (e: unknown) => e instanceof ProviderError && e.code === "UPSTREAM_MALFORMED_RESPONSE");
    } finally {
      fake.restore();
    }
  });

  it("JSON inválido vira UPSTREAM_MALFORMED_RESPONSE", async () => {
    const fake = installFakeProviders(() => jsonResponse("{not json"));
    try {
      await assert.rejects(providerGetJson("gbif", matchUrl()), (e: unknown) => e instanceof ProviderError && e.code === "UPSTREAM_MALFORMED_RESPONSE");
    } finally {
      fake.restore();
    }
  });

  it("envia só cabeçalhos neutros, sem credenciais nem cookies, e proíbe redirecionamento", async () => {
    const fake = installFakeProviders((_url, init) => {
      const names = Object.keys((init.headers ?? {}) as Record<string, string>).map((n) => n.toLowerCase()).sort();
      assert.deepEqual(names, ["accept", "user-agent"]);
      assert.equal(init.redirect, "error");
      assert.equal(init.credentials, undefined);
      return jsonResponse("{}");
    });
    try {
      await providerGetJson("gbif", matchUrl());
      assert.equal(fake.calls.length, 1);
    } finally {
      fake.restore();
    }
  });

  it("aceita XML do NCBI", async () => {
    const fake = installFakeProviders(() => xmlResponse("<TaxaSet></TaxaSet>"));
    try {
      const url = buildProviderUrl("ncbi-taxonomy", "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi", { db: "taxonomy" });
      assert.equal(await providerGetText("ncbi-taxonomy", url, { accept: "xml" }), "<TaxaSet></TaxaSet>");
    } finally {
      fake.restore();
    }
  });
});

describe("injeção de falhas (somente desenvolvimento)", () => {
  it("lê SCIENCE_FAULT por provedor fora de produção", () => {
    const env = { NODE_ENV: "development", SCIENCE_FAULT: "gbif=timeout, ncbi-taxonomy=slow" };
    assert.equal(injectedFault("gbif", env), "timeout");
    assert.equal(injectedFault("ncbi-taxonomy", env), "slow");
    assert.equal(injectedFault("gbif", {}), null);
  });

  it("é ignorada em produção, mesmo se a variável estiver definida", () => {
    const env = { NODE_ENV: "production", SCIENCE_FAULT: "gbif=timeout" };
    assert.equal(injectedFault("gbif", env), null);
    assert.equal(injectedFault("ncbi-taxonomy", env), null);
  });
});

describe("limitadores", () => {
  it("espaça o início das requisições e respeita a concorrência", async () => {
    const limiter = new ProviderLimiter({ provider: "gbif", minIntervalMs: 60, maxConcurrent: 1, maxQueue: 10 });
    const starts: number[] = [];
    let running = 0;
    let peak = 0;
    await Promise.all(
      [0, 1, 2].map(() =>
        limiter.run(async () => {
          starts.push(Date.now());
          running += 1;
          peak = Math.max(peak, running);
          await new Promise((r) => setTimeout(r, 5));
          running -= 1;
        }),
      ),
    );
    assert.equal(peak, 1);
    assert.ok(starts[1] - starts[0] >= 55);
    assert.ok(starts[2] - starts[1] >= 55);
  });

  it("rejeita rápido quando a fila está cheia", async () => {
    const limiter = new ProviderLimiter({ provider: "ncbi-taxonomy", minIntervalMs: 1000, maxConcurrent: 1, maxQueue: 1 });
    const first = limiter.run(async () => new Promise<void>((r) => setTimeout(r, 30)));
    const second = limiter.run(async () => undefined);
    await assert.rejects(limiter.run(async () => undefined), (e: unknown) => e instanceof ProviderError && e.code === "UPSTREAM_RATE_LIMITED");
    await first;
    await second;
  });

  it("orçamento por visitante: bloqueia acima do teto e libera após a janela", () => {
    const budget = new CallerBudget(1000, 3);
    assert.ok(budget.consume("ip", 0));
    assert.ok(budget.consume("ip", 10));
    assert.ok(budget.consume("ip", 20));
    assert.equal(budget.consume("ip", 30), false);
    assert.ok(budget.consume("outro", 30));
    assert.ok(budget.consume("ip", 1500));
  });
});

describe("cache", () => {
  it("deduplica chamadas simultâneas e respeita o TTL", async () => {
    const cache = new SciCache<number>();
    let loads = 0;
    const loader = async () => {
      loads += 1;
      await new Promise((r) => setTimeout(r, 10));
      return loads;
    };
    const [a, b] = await Promise.all([cache.getOrLoad("k", loader, { ttlMs: 50 }), cache.getOrLoad("k", loader, { ttlMs: 50 })]);
    assert.equal(a, 1);
    assert.equal(b, 1);
    assert.equal(await cache.getOrLoad("k", loader, { ttlMs: 50 }), 1);
    await new Promise((r) => setTimeout(r, 60));
    assert.equal(await cache.getOrLoad("k", loader, { ttlMs: 50 }), 2);
  });

  it("usa o valor antigo se a renovação falhar (stale-if-error) e não guarda resultados excluídos", async () => {
    const cache = new SciCache<{ status: string }>();
    await cache.getOrLoad("k", async () => ({ status: "verified" }), { ttlMs: 10, staleIfErrorMs: 1000 });
    await new Promise((r) => setTimeout(r, 20));
    const served = await cache.getOrLoad("k", async () => ({ status: "unavailable" }), {
      ttlMs: 10,
      staleIfErrorMs: 1000,
      shouldStore: (v) => (v as { status: string }).status !== "unavailable",
    });
    assert.equal(served.status, "verified");
    const failing = await cache.getOrLoad("k", async () => { throw new Error("x"); }, { ttlMs: 10, staleIfErrorMs: 1000 });
    assert.equal(failing.status, "verified");
  });

  it("limita o número de entradas (LRU)", async () => {
    const cache = new SciCache<number>(3);
    for (let i = 0; i < 6; i += 1) await cache.getOrLoad(`k${i}`, async () => i, { ttlMs: 1000 });
    assert.equal(cache.size, 3);
  });

  it("cache não promove confiança: um resultado ambíguo continua ambíguo", async () => {
    const cache = new SciCache<{ status: string }>();
    const first = await cache.getOrLoad("a", async () => ({ status: "ambiguous" }), { ttlMs: 1000 });
    const second = await cache.getOrLoad("a", async () => ({ status: "verified" }), { ttlMs: 1000 });
    assert.equal(first.status, "ambiguous");
    assert.equal(second.status, "ambiguous");
  });
});

describe("leitor XML defensivo", () => {
  it("lê elementos, texto, CDATA, comentários e entidades predefinidas e numéricas", () => {
    const root = parseXml('<?xml version="1.0"?><!DOCTYPE A SYSTEM "x.dtd"><A><!-- c --><B>um &amp; dois &#x41; &#66;</B><C><![CDATA[<raw>]]></C><D/></A>');
    assert.equal(root.name, "A");
    assert.equal(root.children[0].text, "um & dois A B");
    assert.equal(root.children[1].text, "<raw>");
    assert.equal(root.children[2].name, "D");
  });

  it("rejeita declaração de entidade (XXE / billion laughs) e documentos malformados", () => {
    assert.throws(() => parseXml('<!DOCTYPE a [<!ENTITY x SYSTEM "file:///etc/passwd">]><a>&x;</a>'), XmlParseError);
    assert.throws(() => parseXml("<a><b></a>"), XmlParseError);
    assert.throws(() => parseXml("<a>"), XmlParseError);
    assert.throws(() => parseXml(""), XmlParseError);
  });

  it("limita a profundidade", () => {
    assert.throws(() => parseXml("<a>".repeat(60) + "</a>".repeat(60)), XmlParseError);
  });

  it("não resolve entidades desconhecidas e descarta códigos de controle", () => {
    assert.equal(decodeEntities("&foo; &#1; &amp;"), "&foo;  &");
  });
});
