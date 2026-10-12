import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { parseTaxaSet } from "../src/lib/science/ncbi/client.ts";
import {
  classifyNameMatch,
  clearNcbiCaches,
  getSpeciesBelow,
  getTaxonById,
  searchTaxaByName,
} from "../src/lib/science/ncbi/service.ts";
import { fixture, installFakeProviders, jsonResponse, xmlResponse, type Handler } from "./helpers/science.ts";

/** Roteia as chamadas E-utilities para respostas reais gravadas em tests/fixtures/science/ncbi. */
const ncbiHandler: Handler = (url) => {
  const term = url.searchParams.get("term");
  const id = url.searchParams.get("id");
  if (url.pathname.endsWith("esearch.fcgi")) {
    const table: Record<string, string> = {
      '"Giardia lamblia"[All Names]': "esearch-giardia-lamblia.json",
      '"Giardia duodenalis"[All Names]': "esearch-giardia-lamblia.json",
      '"Giardia"[All Names]': "esearch-giardia-genus.json",
      '"Morganella"[All Names]': "esearch-morganella.json",
      '"Xyzzyfoo bar"[All Names]': "esearch-notfound.json",
      "Giardia lam*[All Names]": "esearch-prefix-giardia-lam.json",
      "txid5740[Subtree] AND species[Rank]": "esearch-subtree-5740-species.json",
    };
    const lowered = Object.fromEntries(Object.entries(table).map(([k, v]) => [k.toLowerCase(), v]));
    const file = term ? lowered[term.toLowerCase()] : undefined;
    return jsonResponse(file ? fixture(`ncbi/${file}`) : fixture("ncbi/esearch-notfound.json"));
  }
  if (url.pathname.endsWith("esummary.fcgi")) {
    const idToFile: Record<string, string> = {
      "5741": "esummary-5741.json",
      "2876047,5740": "esummary-giardia-genus.json",
      "108061,90690,581": "esummary-morganella.json",
      "99999999999": "esummary-error.json",
    };
    if (id && idToFile[id]) return jsonResponse(fixture(`ncbi/${idToFile[id]}`));
    return jsonResponse(fixture("ncbi/esummary-subtree-5740.json"));
  }
  if (url.pathname.endsWith("efetch.fcgi")) {
    const file = id === "5741" ? "efetch-5741.xml" : id === "5833" ? "efetch-5833.xml" : "efetch-empty.xml";
    return xmlResponse(fixture(`ncbi/${file}`));
  }
  return new Response("?", { status: 404 });
};

let fake: ReturnType<typeof installFakeProviders>;
beforeEach(() => {
  clearNcbiCaches();
  fake = installFakeProviders(ncbiHandler);
});
afterEach(() => fake.restore());

describe("NCBI Taxonomy: registro real (EFetch XML)", () => {
  it("normaliza Giardia duodenalis (TaxID 5741) com linhagem, sinônimos e autoridade", () => {
    const [taxon] = parseTaxaSet(fixture("ncbi/efetch-5741.xml"));
    assert.equal(taxon.taxId, "5741");
    assert.equal(taxon.scientificName, "Giardia duodenalis");
    assert.equal(taxon.rank, "species");
    assert.equal(taxon.parentTaxId, "5740");
    assert.deepEqual(taxon.synonyms, ["Giardia intestinalis", "Giardia lamblia", "Lamblia intestinalis"]);
    assert.equal(taxon.authorities.length, 1);
    assert.match(taxon.authorities[0], /Lambl, 1859/);
    assert.deepEqual(
      taxon.lineage.map((n) => [n.taxId, n.name, n.rank]),
      [
        ["131567", "cellular organisms", "cellular root"],
        ["2759", "Eukaryota", "domain"],
        ["2611341", "Metamonada", "clade"],
        ["207245", "Fornicata", "phylum"],
        ["5738", "Diplomonadida", "order"],
        ["5739", "Hexamitidae", "family"],
        ["68459", "Giardiinae", "subfamily"],
        ["5740", "Giardia", "genus"],
      ],
    );
    assert.equal(taxon.division, "Invertebrates");
  });

  it("não inventa nada: registro vazio resulta em lista vazia", () => {
    assert.deepEqual(parseTaxaSet(fixture("ncbi/efetch-empty.xml")), []);
  });

  it("descarta entradas sem TaxId válido ou sem nome", () => {
    const xml =
      "<TaxaSet><Taxon><TaxId>abc</TaxId><ScientificName>X</ScientificName></Taxon><Taxon><TaxId>7</TaxId></Taxon><Taxon><TaxId>9</TaxId><ScientificName>Ok</ScientificName></Taxon></TaxaSet>";
    const records = parseTaxaSet(xml);
    assert.equal(records.length, 1);
    assert.equal(records[0].taxId, "9");
    assert.equal(records[0].rank, null, "rank ausente fica null");
    assert.deepEqual(records[0].lineage, []);
  });

  it("recusa documento que não é TaxaSet e XML com entidade", () => {
    assert.throws(() => parseTaxaSet("<html></html>"));
    assert.throws(() => parseTaxaSet('<!DOCTYPE TaxaSet [<!ENTITY a "b">]><TaxaSet/>'));
  });
});

describe("NCBI Taxonomy: busca por nome", () => {
  it("sinônimo aceito: Giardia lamblia resolve para Giardia duodenalis (5741)", async () => {
    const result = await searchTaxaByName("Giardia lamblia");
    assert.equal(result.status, "verified");
    if (result.status !== "verified") return;
    assert.equal(result.matchStatus, "accepted_synonym");
    assert.equal(result.taxon.taxId, "5741");
    assert.equal(result.taxon.scientificName, "Giardia duodenalis");
    assert.equal(result.provenance.provider, "ncbi-taxonomy");
    assert.match(result.provenance.sourceUrl, /wwwtax\.cgi\?id=5741$/);
    assert.deepEqual(result.provenance.sourceRecordIds, ["5741"]);
    assert.ok(Date.parse(result.provenance.fetchedAt) > 0);
  });

  it("nome aceito: correspondência exata sem consulta adicional de detalhe", async () => {
    const result = await searchTaxaByName("giardia DUODENALIS");
    assert.equal(result.status, "verified");
    if (result.status !== "verified") return;
    assert.equal(result.matchStatus, "exact");
    assert.equal(fake.calls.filter((c) => c.pathname.endsWith("efetch.fcgi")).length, 0);
  });

  it("homônimos (Morganella) viram ambiguidade explícita, sem escolher um", async () => {
    const result = await searchTaxaByName("Morganella");
    assert.equal(result.status, "ambiguous");
    if (result.status !== "ambiguous") return;
    assert.equal(result.candidates.length, 3);
    assert.deepEqual(result.candidates.map((c) => c.division).sort(), ["basidiomycete fungi", "g-proteobacteria", "scale insects"]);
    assert.ok(result.provenance.reasonCodes.includes("TAXON_AMBIGUOUS"));
  });

  it("nome científico idêntico vence sinônimo de outro táxon (Giardia vs Anceyoconcha)", async () => {
    const result = await searchTaxaByName("Giardia");
    assert.equal(result.status, "verified");
    if (result.status !== "verified") return;
    assert.equal(result.taxon.taxId, "5740");
    assert.equal(result.taxon.rank, "genus");
    assert.deepEqual(result.alsoMatched.map((t) => t.scientificName), ["Anceyoconcha"]);
  });

  it("não encontrado: lista vazia e código estável", async () => {
    const result = await searchTaxaByName("Xyzzyfoo bar");
    assert.equal(result.status, "not_found");
    if (result.status !== "not_found") return;
    assert.deepEqual(result.provenance.reasonCodes, ["TAXON_NOT_FOUND"]);
  });

  it("consulta inválida nunca chega ao provedor", async () => {
    const result = await searchTaxaByName('Giardia"[Subtree]');
    assert.equal(result.status, "invalid_query");
    assert.equal(fake.calls.length, 0);
  });

  it("cacheia a repetição: segunda busca não chama o NCBI", async () => {
    await searchTaxaByName("Morganella");
    const before = fake.calls.length;
    await searchTaxaByName("morganella");
    assert.equal(fake.calls.length, before);
  });

  it("termo enviado é sempre frase entre aspas no campo All Names (sem sintaxe do visitante)", async () => {
    await searchTaxaByName("Giardia OR Homo");
    const call = fake.calls.find((c) => c.pathname.endsWith("esearch.fcgi"));
    assert.equal(call?.searchParams.get("term"), '"Giardia OR Homo"[All Names]');
    assert.equal(call?.searchParams.get("db"), "taxonomy");
    assert.equal(call?.hostname, "eutils.ncbi.nlm.nih.gov");
    assert.equal(call?.searchParams.get("api_key"), null);
  });

  it("classifyNameMatch diferencia exato, sinônimo e alias", () => {
    const taxon = { scientificName: "Giardia duodenalis", synonyms: ["Giardia lamblia"] };
    assert.equal(classifyNameMatch("giardia duodenalis", taxon), "exact");
    assert.equal(classifyNameMatch("Giardia lamblia", taxon), "accepted_synonym");
    assert.equal(classifyNameMatch("giárdia", taxon), "matched_alias");
  });
});

describe("NCBI Taxonomy: registro e descendentes", () => {
  it("getTaxonById devolve registro verificado com procedência", async () => {
    const result = await getTaxonById("5741");
    assert.equal(result.status, "verified");
    if (result.status !== "verified") return;
    assert.equal(result.taxon.lineage.at(-1)?.name, "Giardia");
    assert.equal(result.provenance.attribution.includes("NCBI"), true);
  });

  it("TaxID inexistente: not_found; formato inválido: invalid_query sem rede", async () => {
    const missing = await getTaxonById("99999999999");
    assert.equal(missing.status, "invalid_query", "11 dígitos não é TaxID válido");
    const unknown = await getTaxonById("987654321");
    assert.equal(unknown.status, "not_found");
    fake.calls.length = 0;
    assert.equal((await getTaxonById("../etc/passwd")).status, "invalid_query");
    assert.equal(fake.calls.length, 0);
  });

  it("espécies abaixo de um gênero: total real e amostra ordenada", async () => {
    const result = await getSpeciesBelow("5740", "genus");
    assert.equal(result.status, "verified");
    if (result.status !== "verified") return;
    assert.equal(result.total, 55);
    assert.ok(result.shown.length > 0 && result.shown.length <= 40);
    assert.equal(result.complete, false);
    const names = result.shown.map((s) => s.scientificName);
    assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, "en")));
  });

  it("não lista descendentes para espécie", async () => {
    assert.deepEqual(await getSpeciesBelow("5741", "species"), { status: "not_applicable" });
  });
});

describe("NCBI Taxonomy: falhas do provedor", () => {
  it("timeout e 5xx viram 'unavailable' amigável e não são cacheados", async () => {
    fake.restore();
    let failing = true;
    fake = installFakeProviders((url, init) => {
      if (failing) return new Response("boom", { status: 503 });
      return ncbiHandler(url, init);
    });
    clearNcbiCaches();
    const down = await searchTaxaByName("Giardia lamblia");
    assert.equal(down.status, "unavailable");
    failing = false;
    const up = await searchTaxaByName("Giardia lamblia");
    assert.equal(up.status, "verified", "resultado indisponível não pode ter sido cacheado");
  });

  it("resposta malformada (esquema inesperado) não vira dado", async () => {
    fake.restore();
    fake = installFakeProviders(() => jsonResponse('{"esearchresult":{"count":"x","idlist":["abc"]}}'));
    clearNcbiCaches();
    const result = await searchTaxaByName("Giardia lamblia");
    assert.equal(result.status, "unavailable");
    if (result.status === "unavailable") assert.equal(result.reason, "UPSTREAM_MALFORMED_RESPONSE");
  });

  it("429 persistente vira UPSTREAM_RATE_LIMITED", async () => {
    fake.restore();
    fake = installFakeProviders(() => new Response("", { status: 429, headers: { "retry-after": "0" } }));
    clearNcbiCaches();
    const result = await searchTaxaByName("Giardia lamblia");
    assert.equal(result.status, "unavailable");
    if (result.status === "unavailable") assert.equal(result.reason, "UPSTREAM_RATE_LIMITED");
  });
});
