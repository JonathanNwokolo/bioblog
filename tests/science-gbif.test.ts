import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { buildCrosswalk } from "../src/lib/science/crosswalk.ts";
import { clearGbifCaches, getOccurrenceSample, interpretMatch, pickSampleCountries, resolveGbifTaxon } from "../src/lib/science/gbif/service.ts";
import type { GbifTaxon } from "../src/lib/science/gbif/types.ts";
import { validateOccurrence } from "../src/lib/science/gbif/validate.ts";
import { parseTaxaSet } from "../src/lib/science/ncbi/client.ts";
import { fixture, installFakeProviders, jsonResponse, type Handler } from "./helpers/science.ts";

const matchFile: Record<string, string> = {
  "Giardia lamblia": "match-giardia-lamblia.json",
  "Giardia duodenalis": "match-giardia-duodenalis.json",
  "Plasmodium falciparum": "match-plasmodium-falciparum.json",
  "Plasmodium vivax": "match-plasmodium-vivax.json",
  "Trichomonas vaginalis": "match-trichomonas-vaginalis.json",
  Morganella: "match-morganella.json",
  "Giardia duodenallis": "match-fuzzy.json",
  Hexamitidae: "match-family.json",
};

const gbifHandler: Handler = (url) => {
  if (url.pathname.endsWith("/species/match")) {
    const file = matchFile[url.searchParams.get("name") ?? ""];
    return file ? jsonResponse(fixture(`gbif/${file}`)) : jsonResponse('{"matchType":"NONE","confidence":100}');
  }
  if (url.pathname.endsWith("/occurrence/search")) {
    const key = url.searchParams.get("taxonKey");
    if (key === "3210448") return jsonResponse(fixture("gbif/occurrence-naegleria-fowleri.json"));
    if (key === "8205154") {
      if (url.searchParams.get("limit") === "0") return jsonResponse(fixture("gbif/occurrence-tcruzi-head.json"));
      return jsonResponse(fixture("gbif/occurrence-tcruzi-40.json"));
    }
  }
  if (url.pathname.includes("/dataset/")) return jsonResponse(fixture("gbif/dataset-insdc-host.json"));
  return new Response("?", { status: 404 });
};

let fake: ReturnType<typeof installFakeProviders>;
beforeEach(() => {
  clearGbifCaches();
  fake = installFakeProviders(gbifHandler);
});
afterEach(() => fake.restore());

const baseRecord = (over: Record<string, unknown> = {}) => ({
  key: 1,
  datasetKey: "393b8c26-e4e0-4dd0-a218-93fc074ebf4e",
  taxonKey: 100,
  speciesKey: 100,
  acceptedTaxonKey: 100,
  decimalLatitude: -10.5,
  decimalLongitude: -50.25,
  license: "http://creativecommons.org/licenses/by/4.0/legalcode",
  occurrenceStatus: "PRESENT",
  issues: [],
  ...over,
});
const ctx = { queryKeys: new Set([100]) };

describe("GBIF: identidade taxonômica (species/match real)", () => {
  it("Giardia lamblia é sinônimo; a busca usa o nome aceito Giardia duodenalis", async () => {
    const result = await resolveGbifTaxon("Giardia lamblia");
    assert.equal(result.status, "verified");
    if (result.status !== "verified") return;
    assert.equal(result.taxon.isSynonym, true);
    assert.equal(result.taxon.usageKey, 5425222);
    assert.equal(result.taxon.acceptedKey, 8562913);
    assert.equal(result.taxon.acceptedName, "Giardia duodenalis");
    assert.equal(result.provenance.provider, "gbif");
  });

  it("chaves GBIF e TaxIDs do NCBI são independentes (Plasmodium falciparum: 10540993 vs 5833)", async () => {
    const result = await resolveGbifTaxon("Plasmodium falciparum");
    assert.equal(result.status, "verified");
    if (result.status !== "verified") return;
    assert.equal(result.taxon.acceptedKey, 10540993);
    assert.notEqual(String(result.taxon.acceptedKey), "5833");
    const [ncbi] = parseTaxaSet(fixture("ncbi/efetch-5833.xml"));
    const crosswalk = buildCrosswalk(ncbi, result.taxon);
    assert.equal(crosswalk.agreement, "name_match");
    assert.equal(crosswalk.linked, true);
    assert.equal(crosswalk.ncbi?.taxId, "5833");
    assert.equal(crosswalk.gbif?.acceptedKey, 10540993);
  });

  it("sem correspondência (Plasmodium vivax no backbone, Morganella homônimo): not_found, sem substituto", async () => {
    for (const name of ["Plasmodium vivax", "Morganella"]) {
      const result = await resolveGbifTaxon(name);
      assert.equal(result.status, "not_found", name);
    }
  });

  it("só o gênero reconhecido (Trichomonas vaginalis, HIGHERRANK/DOUBTFUL) não é aceito como espécie", async () => {
    const result = await resolveGbifTaxon("Trichomonas vaginalis");
    assert.equal(result.status, "ambiguous");
    if (result.status !== "ambiguous") return;
    assert.equal(result.kind, "higher_rank");
    assert.equal(result.suggestion?.rank, "GENUS");
  });

  it("correspondência aproximada (FUZZY) exige confirmação", async () => {
    const result = await resolveGbifTaxon("Giardia duodenallis");
    assert.equal(result.status, "ambiguous");
    if (result.status === "ambiguous") {
      assert.equal(result.kind, "fuzzy");
      assert.equal(result.suggestion?.canonicalName, "Giardia duodenalis");
    }
  });

  it("família é ampla demais para ocorrências", async () => {
    const result = await resolveGbifTaxon("Hexamitidae");
    assert.equal(result.status === "ambiguous" && result.kind === "rank_too_broad", true);
  });

  it("identificador numérico do NCBI não é aceito como nome", async () => {
    const result = await resolveGbifTaxon("5833");
    assert.equal(result.status, "invalid_query");
    assert.equal(fake.calls.length, 0);
  });

  it("interpretMatch nunca devolve verificado para NONE", () => {
    assert.equal(interpretMatch("x", { matchType: "NONE" }).status, "not_found");
  });
});

describe("GBIF: validação de ocorrências", () => {
  it("coordenadas válidas passam; limites inclusivos", () => {
    for (const [lat, lon] of [[-90, 180], [90, -180], [0.0001, 0], [-23.5, -46.6]]) {
      assert.equal(validateOccurrence(baseRecord({ decimalLatitude: lat, decimalLongitude: lon }), ctx).ok, true, `${lat},${lon}`);
    }
  });

  it("AC-GBIF-01: fora de faixa, zero, ausentes e não numéricas são excluídas com código estável", () => {
    const cases: Array<Record<string, unknown>> = [
      { decimalLatitude: 91, decimalLongitude: 0 },
      { decimalLatitude: 0, decimalLongitude: -181 },
      { decimalLatitude: 0, decimalLongitude: 0 },
      { decimalLatitude: null, decimalLongitude: 10 },
      { decimalLatitude: "12.5", decimalLongitude: 10 },
      { decimalLatitude: Number.NaN, decimalLongitude: 10 },
      { decimalLatitude: undefined, decimalLongitude: undefined },
    ];
    for (const over of cases) {
      const result = validateOccurrence(baseRecord(over), ctx);
      assert.equal(result.ok, false, JSON.stringify(over));
      if (!result.ok) assert.equal(result.reason, "OCCURRENCE_INVALID_COORDINATES");
    }
    const flagged = validateOccurrence(baseRecord({ issues: ["ZERO_COORDINATE"] }), ctx);
    assert.equal(!flagged.ok && flagged.reason, "OCCURRENCE_INVALID_COORDINATES");
  });

  it("flags de qualidade que sugerem posição duvidosa excluem sem 'consertar' a coordenada", () => {
    for (const flag of ["COUNTRY_COORDINATE_MISMATCH", "PRESUMED_SWAPPED_COORDINATE", "PRESUMED_NEGATED_LATITUDE", "COORDINATE_REPROJECTION_SUSPICIOUS", "COORDINATE_UNCERTAINTY_METERS_INVALID"]) {
      const result = validateOccurrence(baseRecord({ issues: [flag] }), ctx);
      assert.equal(!result.ok && result.reason, "OCCURRENCE_QUALITY_FLAG_REJECTED", flag);
    }
  });

  it("AC-GBIF-02: táxon incompatível é excluído", () => {
    const result = validateOccurrence(baseRecord({ taxonKey: 999, speciesKey: 999, acceptedTaxonKey: 999 }), ctx);
    assert.equal(!result.ok && result.reason, "OCCURRENCE_TAXON_MISMATCH");
    const fuzzy = validateOccurrence(baseRecord({ issues: ["TAXON_MATCH_FUZZY"] }), ctx);
    assert.equal(!fuzzy.ok && fuzzy.reason, "OCCURRENCE_TAXON_MISMATCH");
  });

  it("AC-GBIF-03: flag informativo e incerteza válida são preservados", () => {
    const result = validateOccurrence(
      baseRecord({ issues: ["GEODETIC_DATUM_ASSUMED_WGS84", "TAXON_MATCH_HIGHERRANK"], coordinateUncertaintyInMeters: 1902 }),
      ctx,
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.point.uncertaintyMeters, 1902);
    assert.deepEqual(result.point.issues, ["GEODETIC_DATUM_ASSUMED_WGS84", "TAXON_MATCH_HIGHERRANK"]);
    assert.deepEqual(result.point.informationalIssues, ["GEODETIC_DATUM_ASSUMED_WGS84", "TAXON_MATCH_HIGHERRANK"]);
  });

  it("AC-PUB-04: incerteza ausente permanece null, nunca 0", () => {
    const result = validateOccurrence(baseRecord(), ctx);
    assert.equal(result.ok && result.point.uncertaintyMeters, null);
    const zero = validateOccurrence(baseRecord({ coordinateUncertaintyInMeters: 0 }), ctx);
    assert.equal(zero.ok && zero.point.uncertaintyMeters, null);
  });

  it("licença ausente ou não aceita é excluída; CC0, CC BY e CC BY-NC passam", () => {
    for (const license of [undefined, "UNSPECIFIED", "http://creativecommons.org/licenses/by-sa/4.0/legalcode", "http://example.com/restrict"]) {
      const result = validateOccurrence(baseRecord({ license }), ctx);
      assert.equal(!result.ok && result.reason, "OCCURRENCE_LICENCE_UNSUPPORTED", String(license));
    }
    for (const license of [
      "http://creativecommons.org/publicdomain/zero/1.0/legalcode",
      "http://creativecommons.org/licenses/by/4.0/legalcode",
      "http://creativecommons.org/licenses/by-nc/4.0/legalcode",
    ]) {
      assert.equal(validateOccurrence(baseRecord({ license }), ctx).ok, true, license);
    }
  });

  it("registro de ausência e registro sem chave são tratados", () => {
    const absent = validateOccurrence(baseRecord({ occurrenceStatus: "ABSENT" }), ctx);
    assert.equal(!absent.ok && absent.reason, "OCCURRENCE_ABSENCE_RECORD");
    const broken = validateOccurrence({ decimalLatitude: 1 }, ctx);
    assert.equal(!broken.ok && broken.reason, "MALFORMED");
    assert.equal(validateOccurrence(null, ctx).ok, false);
  });

  it("propriedade: nenhuma coordenada aceita fica fora da faixa válida", () => {
    let seed = 42;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let i = 0; i < 2000; i += 1) {
      const lat = rand() * 400 - 200;
      const lon = rand() * 800 - 400;
      const result = validateOccurrence(baseRecord({ decimalLatitude: lat, decimalLongitude: lon }), ctx);
      if (result.ok) {
        assert.ok(Math.abs(result.point.lat) <= 90 && Math.abs(result.point.lon) <= 180);
      } else {
        assert.ok(Math.abs(lat) > 90 || Math.abs(lon) > 180);
      }
    }
  });

  it("registros reais (T. cruzi): todos passam com táxon coerente e flags preservados", () => {
    const page = JSON.parse(fixture("gbif/occurrence-tcruzi-40.json")) as { results: unknown[] };
    const keys = { queryKeys: new Set([8205154]) };
    const results = page.results.map((raw) => validateOccurrence(raw, keys));
    const kept = results.filter((r) => r.ok);
    assert.ok(kept.length >= 30, `esperado a maioria retida, obtido ${kept.length}`);
    for (const r of kept) {
      if (r.ok) {
        assert.match(r.point.url, /^https:\/\/www\.gbif\.org\/occurrence\/\d+$/);
        assert.equal(r.point.licence !== null, true);
      }
    }
  });
});

describe("GBIF: amostra de ocorrências (fluxo completo com respostas reais)", () => {
  it("T. cruzi: publica pontos, contagens, países, licenças e citação de conjunto de dados", async () => {
    const resolved = { usageKey: 8205154, acceptedKey: 8205154 } as GbifTaxon;
    const taxon: GbifTaxon = { ...resolved, query: "Trypanosoma cruzi", scientificName: "Trypanosoma cruzi Chagas, 1909", canonicalName: "Trypanosoma cruzi", acceptedName: "Trypanosoma cruzi", rank: "SPECIES", taxonomicStatus: "ACCEPTED", matchType: "EXACT", confidence: 99, isSynonym: false, classification: { kingdom: "Protozoa", phylum: "Euglenozoa", class: null, order: null, family: null, genus: "Trypanosoma", species: "Trypanosoma cruzi" } };
    const result = await getOccurrenceSample(taxon);
    assert.equal(result.status, "verified");
    if (result.status !== "verified") return;
    assert.equal(result.totalGeoreferenced, 2088);
    assert.equal(result.sampled, true);
    assert.deepEqual(result.sampleCountries, ["CO", "BR", "US", "BZ"]);
    assert.equal(result.pagesFetched, 4);
    assert.ok(result.points.length > 0 && result.points.length <= 160);
    assert.ok(new Set(result.points.map((p) => p.gbifId)).size === result.points.length, "sem duplicatas");
    assert.equal(result.countries[0].name, "CO");
    assert.ok(result.licences.some((l) => l.name === "CC_BY_NC_4_0"));
    assert.ok(result.datasets.length >= 1);
    assert.match(result.datasets[0].citation ?? "", /accessed via GBIF\.org/);
    // Orçamento: 1 requisição de cabeçalho + 1 por país amostrado. Nunca paginação profunda nem download em massa.
    const occurrenceCalls = fake.calls.filter((c) => c.pathname.endsWith("/occurrence/search"));
    assert.equal(occurrenceCalls.length, 5);
    for (const call of occurrenceCalls) {
      assert.ok(Number(call.searchParams.get("limit")) <= 75);
      assert.equal(Number(call.searchParams.get("offset")), 0, "sem paginação profunda");
      assert.equal(call.searchParams.get("hasCoordinate"), "true");
      assert.equal(call.searchParams.get("hasGeospatialIssue"), "false");
      assert.equal(call.searchParams.get("occurrenceStatus"), "PRESENT");
    }
    assert.deepEqual(
      occurrenceCalls.filter((c) => c.searchParams.has("country")).map((c) => c.searchParams.get("country")),
      ["CO", "BR", "US", "BZ"],
    );
    assert.ok(result.topDataset && result.topDataset.share > 0 && result.topDataset.share <= 1);
    assert.ok(fake.calls.every((c) => c.hostname === "api.gbif.org"));
  });

  it("AC-GBIF-04: poucos registros (Naegleria fowleri, 8) → insuficiente, sem pontos", async () => {
    const taxon = { query: "Naegleria fowleri", usageKey: 3210448, acceptedKey: 3210448 } as GbifTaxon;
    const result = await getOccurrenceSample(taxon);
    assert.equal(result.status, "insufficient");
    if (result.status !== "insufficient") return;
    assert.equal(result.retained, 8);
    assert.ok(result.minRequired > 8);
    assert.deepEqual(result.provenance.reasonCodes, ["OCCURRENCE_INSUFFICIENT_RELIABLE_RECORDS"]);
    assert.equal("points" in result, false);
  });

  it("provedor fora do ar: unavailable, sem pontos fabricados, sem cache do erro", async () => {
    fake.restore();
    fake = installFakeProviders(() => new Response("", { status: 503 }));
    clearGbifCaches();
    const taxon = { query: "x", usageKey: 8205154, acceptedKey: 8205154 } as GbifTaxon;
    const down = await getOccurrenceSample(taxon);
    assert.equal(down.status, "unavailable");
  });

  it("pickSampleCountries só aceita códigos ISO de duas letras e respeita o limite", () => {
    const facets = [
      { name: "CO", count: 10 },
      { name: "xx", count: 9 },
      { name: "BR", count: 8 },
      { name: "Brazil; DROP", count: 7 },
      { name: "US", count: 0 },
      { name: "BZ", count: 5 },
    ];
    assert.deepEqual(pickSampleCountries(facets, 2), ["CO", "BR"]);
    assert.deepEqual(pickSampleCountries(facets, 10), ["CO", "BR", "BZ"]);
    assert.deepEqual(pickSampleCountries([], 4), []);
  });

  it("o código de país só entra na URL se for ISO de duas letras", async () => {
    const taxon = { query: "x", usageKey: 8205154, acceptedKey: 8205154 } as GbifTaxon;
    await getOccurrenceSample(taxon);
    for (const call of fake.calls) {
      const country = call.searchParams.get("country");
      if (country !== null) assert.match(country, /^[A-Z]{2}$/);
    }
  });
});
