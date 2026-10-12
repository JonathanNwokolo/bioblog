// Validação ao vivo da Fase 2.2: executa os MESMOS módulos do site contra os provedores reais.
// Diagnóstico, não teste de regressão (os testes determinísticos usam fixtures gravadas).
// Uso: node scripts/verify-phase22-live.mjs [saida.json]
// Respeita os limitadores do projeto (NCBI ~2,5 req/s); leva cerca de 1 minuto.
import { writeFileSync } from "node:fs";
import { buildCrosswalk } from "../src/lib/science/crosswalk.ts";
import { getOccurrenceSample, resolveGbifTaxon } from "../src/lib/science/gbif/service.ts";
import { getSpeciesBelow, getTaxonById, searchTaxaByName } from "../src/lib/science/ncbi/service.ts";
import { dpdxOrganisms, imagesForOrganism } from "../src/lib/science/dpdx/registry.ts";

const QUERIES = [
  "Giardia lamblia",
  "Giardia duodenalis",
  "Plasmodium falciparum",
  "Plasmodium vivax",
  "Trypanosoma cruzi",
  "Entamoeba histolytica",
  "Leishmania infantum",
  "Toxoplasma gondii",
  "Schistosoma mansoni",
  "Ascaris lumbricoides",
  "Aedes aegypti",
  "Naegleria fowleri",
  "Trichomonas vaginalis",
  "Morganella",
  "Giardia",
  "Xyzzyfoo bar",
];

const out = { startedAt: new Date().toISOString(), rows: [] };
const dpdxBy = new Map(dpdxOrganisms.map((o) => [o.scientificName.toLowerCase(), o]));

for (const query of QUERIES) {
  const row = { query };
  const t0 = Date.now();

  const ncbi = await searchTaxaByName(query);
  row.ncbi = { status: ncbi.status };
  let record = null;
  if (ncbi.status === "verified") {
    row.ncbi.matchStatus = ncbi.matchStatus;
    row.ncbi.taxId = ncbi.taxon.taxId;
    row.ncbi.scientificName = ncbi.taxon.scientificName;
    row.ncbi.rank = ncbi.taxon.rank;
    row.ncbi.alsoMatched = ncbi.alsoMatched.map((t) => `${t.scientificName} (${t.taxId})`);
    const lookup = await getTaxonById(ncbi.taxon.taxId);
    if (lookup.status === "verified") {
      record = lookup.taxon;
      row.ncbi.lineageLength = record.lineage.length;
      row.ncbi.synonyms = record.synonyms;
      row.ncbi.division = record.division;
      row.ncbi.sourceUrl = lookup.provenance.sourceUrl;
    }
  } else if (ncbi.status === "ambiguous") {
    row.ncbi.candidates = ncbi.candidates.map((c) => `${c.scientificName} (${c.taxId}; ${c.division ?? "sem divisão"})`);
  } else if (ncbi.status === "not_found") {
    row.ncbi.suggestions = ncbi.suggestions.map((s) => s.scientificName);
  } else if (ncbi.status === "unavailable") {
    row.ncbi.reason = ncbi.reason;
  }

  const gbif = await resolveGbifTaxon(query);
  row.gbif = { status: gbif.status };
  let gbifTaxon = null;
  if (gbif.status === "verified") {
    gbifTaxon = gbif.taxon;
    Object.assign(row.gbif, {
      acceptedKey: gbif.taxon.acceptedKey,
      usageKey: gbif.taxon.usageKey,
      acceptedName: gbif.taxon.acceptedName,
      rank: gbif.taxon.rank,
      isSynonym: gbif.taxon.isSynonym,
      matchType: gbif.taxon.matchType,
      confidence: gbif.taxon.confidence,
    });
    const occ = await getOccurrenceSample(gbif.taxon);
    row.gbif.occurrences = { status: occ.status };
    if (occ.status === "verified") {
      Object.assign(row.gbif.occurrences, {
        totalGeoreferenced: occ.totalGeoreferenced,
        evaluated: occ.fetched,
        shown: occ.points.length,
        excluded: occ.excluded,
        sampled: occ.sampled,
        withUncertainty: occ.points.filter((p) => p.uncertaintyMeters !== null).length,
        topCountries: occ.countries.slice(0, 3).map((c) => `${c.name}:${c.count}`),
        datasetsCited: occ.datasets.length,
      });
    } else if (occ.status === "insufficient") {
      Object.assign(row.gbif.occurrences, {
        totalGeoreferenced: occ.totalGeoreferenced,
        retained: occ.retained,
        excluded: occ.excluded,
        minRequired: occ.minRequired,
      });
    } else {
      row.gbif.occurrences.reason = occ.reason;
    }
  } else if (gbif.status === "ambiguous") {
    row.gbif.kind = gbif.kind;
    row.gbif.suggestion = gbif.suggestion?.canonicalName ?? null;
  }

  const cross = buildCrosswalk(record, gbifTaxon);
  row.crosswalk = { agreement: cross.agreement, linked: cross.linked };

  const dpdx = dpdxBy.get((record?.scientificName ?? query).toLowerCase()) ?? dpdxBy.get(query.toLowerCase());
  if (dpdx) {
    const images = imagesForOrganism(dpdx.slug);
    row.dpdx = { shown: images.shown.length, withheld: images.withheld.length };
  }

  row.ms = Date.now() - t0;
  out.rows.push(row);
  console.log(`${query.padEnd(24)} ncbi=${row.ncbi.status}${row.ncbi.taxId ? `:${row.ncbi.taxId}` : ""} gbif=${row.gbif.status}${row.gbif.acceptedKey ? `:${row.gbif.acceptedKey}` : ""} occ=${row.gbif.occurrences?.status ?? "-"} cross=${row.crosswalk.agreement} (${row.ms} ms)`);
}

// Descendentes (amostra) para um gênero real.
const genus = await getSpeciesBelow("5740", "genus");
out.speciesBelowGiardia = genus.status === "verified" ? { total: genus.total, shown: genus.shown.length, complete: genus.complete } : genus;
out.finishedAt = new Date().toISOString();

const target = process.argv[2];
if (target) writeFileSync(target, JSON.stringify(out, null, 2) + "\n");
console.log("fim", out.finishedAt);
