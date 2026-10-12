import { SciCache } from "../cache.ts";
import { ADAPTER_VERSION, CACHE_TTL, GBIF_ACCEPTED_LICENCES, GBIF_SAMPLING, GBIF_SITE } from "../config.ts";
import { checkNameQuery, foldName } from "../query.ts";
import { ProviderError, type Provenance, type ReasonCode } from "../types.ts";
import { getDataset, isUuid, searchOccurrences, speciesMatch, type GbifMatchRaw } from "./client.ts";
import type {
  DatasetCitation,
  ExclusionTally,
  FacetCount,
  GbifResolveResult,
  GbifTaxon,
  OccurrenceResult,
  OccurrencePoint,
} from "./types.ts";
import { validateOccurrence } from "./validate.ts";

export const GBIF_ATTRIBUTION =
  "GBIF.org, Global Biodiversity Information Facility. Os dados pertencem aos conjuntos de dados e publicadores listados em cada registro.";
export const GBIF_RIGHTS = "Licença por registro (CC0 1.0, CC BY 4.0 ou CC BY-NC 4.0). Registros sem licença aceita são excluídos.";

/** Ranks com sentido para uma busca de ocorrência (gênero ou abaixo). */
const SEARCHABLE_RANKS = new Set(["GENUS", "SUBGENUS", "SPECIES", "SUBSPECIES", "VARIETY", "FORM", "STRAIN", "INFRASPECIFIC_NAME"]);

function provenance(taxonKey: number | null, reasonCodes: ReasonCode[] = []): Provenance {
  return {
    provider: "gbif",
    sourceUrl:
      taxonKey === null
        ? GBIF_SITE
        : `${GBIF_SITE}/occurrence/search?taxon_key=${taxonKey}&has_coordinate=true&has_geospatial_issue=false&occurrence_status=present`,
    sourceRecordIds: taxonKey === null ? [] : [String(taxonKey)],
    fetchedAt: new Date().toISOString(),
    adapterVersion: ADAPTER_VERSION,
    upstreamVersion: "v1",
    attribution: GBIF_ATTRIBUTION,
    licenceOrRights: GBIF_RIGHTS,
    reasonCodes,
  };
}

const matchCache = new SciCache<GbifResolveResult>(300);
const occurrenceCache = new SciCache<OccurrenceResult>(120);
const datasetCache = new SciCache<DatasetCitation | null>(300);

const stored = (value: unknown) => (value as { status?: string } | null)?.status !== "unavailable";

export function clearGbifCaches() {
  matchCache.clear();
  occurrenceCache.clear();
  datasetCache.clear();
}

function reasonOf(error: unknown): ReasonCode {
  return error instanceof ProviderError ? error.code : "UPSTREAM_ERROR";
}

function fieldOrNull(value: string | undefined): string | null {
  return value && value.trim().length > 0 ? value.trim() : null;
}

/** Interpreta a resposta de `species/match` sem escolher silenciosamente um táxon incerto. */
export function interpretMatch(query: string, raw: GbifMatchRaw): GbifResolveResult {
  const matchType = raw.matchType.toUpperCase();
  const usageKey = raw.usageKey ?? null;
  const rank = raw.rank?.toUpperCase() ?? null;
  const canonical = raw.canonicalName ?? raw.scientificName ?? null;

  if (matchType === "NONE" || usageKey === null || !canonical || !rank) {
    return { status: "not_found", query, provenance: provenance(null, ["TAXON_NOT_FOUND"]) };
  }
  const suggestion = { canonicalName: canonical, rank, usageKey };
  if (matchType === "HIGHERRANK") {
    return {
      status: "ambiguous",
      query,
      kind: "higher_rank",
      suggestion,
      provenance: provenance(usageKey, ["TAXON_AMBIGUOUS", "TAXON_RANK_NOT_SPECIES"]),
    };
  }
  if (matchType === "FUZZY") {
    return { status: "ambiguous", query, kind: "fuzzy", suggestion, provenance: provenance(usageKey, ["TAXON_AMBIGUOUS"]) };
  }
  const status = raw.status?.toUpperCase() ?? "";
  if (status === "DOUBTFUL" || (status !== "ACCEPTED" && status !== "SYNONYM" && !status.endsWith("SYNONYM"))) {
    return { status: "ambiguous", query, kind: "doubtful", suggestion, provenance: provenance(usageKey, ["TAXON_AMBIGUOUS"]) };
  }
  if (!SEARCHABLE_RANKS.has(rank)) {
    return {
      status: "ambiguous",
      query,
      kind: "rank_too_broad",
      suggestion,
      provenance: provenance(usageKey, ["TAXON_RANK_NOT_SPECIES"]),
    };
  }

  const isSynonym = status.endsWith("SYNONYM");
  const acceptedKey = isSynonym ? (raw.acceptedUsageKey ?? null) : usageKey;
  if (acceptedKey === null) {
    return { status: "ambiguous", query, kind: "doubtful", suggestion, provenance: provenance(usageKey, ["TAXON_AMBIGUOUS"]) };
  }
  const taxon: GbifTaxon = {
    query,
    usageKey,
    acceptedKey,
    scientificName: raw.scientificName ?? canonical,
    canonicalName: canonical,
    // Para sinônimos de espécie, `species` traz o nome aceito (observado em respostas reais).
    acceptedName: isSynonym ? (fieldOrNull(raw.species) ?? canonical) : canonical,
    rank,
    taxonomicStatus: status,
    matchType,
    confidence: typeof raw.confidence === "number" ? raw.confidence : null,
    isSynonym,
    classification: {
      kingdom: fieldOrNull(raw.kingdom),
      phylum: fieldOrNull(raw.phylum),
      class: fieldOrNull(raw.class),
      order: fieldOrNull(raw.order),
      family: fieldOrNull(raw.family),
      genus: fieldOrNull(raw.genus),
      species: fieldOrNull(raw.species),
    },
  };
  return { status: "verified", taxon, provenance: provenance(acceptedKey) };
}

export async function resolveGbifTaxon(rawName: string): Promise<GbifResolveResult> {
  const check = checkNameQuery(rawName);
  if (!check.ok) return { status: "invalid_query", reason: check.reason, hint: check.hint };
  if (check.asTaxId) {
    return {
      status: "invalid_query",
      reason: "QUERY_INVALID",
      hint: "Informe um nome científico. Identificadores numéricos do NCBI não valem na GBIF.",
    };
  }
  const query = check.query;
  return matchCache.getOrLoad(
    `match:${foldName(query)}`,
    async () => {
      try {
        return interpretMatch(query, await speciesMatch(query));
      } catch (error) {
        return { status: "unavailable", reason: reasonOf(error) } as const;
      }
    },
    { ttlMs: CACHE_TTL.gbifMatch * 1000, staleIfErrorMs: 3600_000, shouldStore: stored },
  );
}

/**
 * Países amostrados em conjuntos grandes: os que têm mais registros (ordem do facet da própria GBIF).
 * Só aceita códigos ISO de duas letras, que entram na URL como filtro.
 */
export function pickSampleCountries(countries: FacetCount[], max: number): string[] {
  return countries
    .filter((c) => /^[A-Z]{2}$/.test(c.name) && c.count > 0)
    .slice(0, Math.max(0, max))
    .map((c) => c.name);
}

function facet(page: { facets?: Array<{ field: string; counts: FacetCount[] }> }, field: string): FacetCount[] {
  return page.facets?.find((f) => f.field === field)?.counts ?? [];
}

async function citationFor(datasetKey: string, records: number): Promise<DatasetCitation | null> {
  const base = await datasetCache.getOrLoad(
    `dataset:${datasetKey}`,
    async () => {
      try {
        const dataset = await getDataset(datasetKey);
        return {
          datasetKey,
          title: dataset.title,
          citation: dataset.citation?.text ?? null,
          doi: dataset.doi ?? null,
          licence: dataset.license ?? null,
          records: 0,
        } satisfies DatasetCitation;
      } catch {
        return null;
      }
    },
    { ttlMs: CACHE_TTL.gbifDataset * 1000, shouldStore: (value) => value !== null },
  );
  return base ? { ...base, records } : null;
}

export async function getOccurrenceSample(taxon: GbifTaxon): Promise<OccurrenceResult> {
  return occurrenceCache.getOrLoad(
    `occ:${taxon.acceptedKey}:${GBIF_ACCEPTED_LICENCES.join(",")}`,
    async () => {
      try {
        const head = await searchOccurrences({
          taxonKey: taxon.acceptedKey,
          offset: 0,
          limit: 0,
          facets: ["COUNTRY", "LICENSE", "BASIS_OF_RECORD", "DATASET_KEY"],
          facetLimit: 12,
        });
        const total = head.count;
        const { perCountry, maxCountries, fullFetchThreshold, minReliableOccurrences } = GBIF_SAMPLING;

        const sampled = total > fullFetchThreshold;
        const sampleCountries = sampled ? pickSampleCountries(facet(head, "COUNTRY"), maxCountries) : [];
        const requests: Array<{ offset: number; limit: number; country?: string }> = !sampled
          ? total > 0
            ? [{ offset: 0, limit: Math.min(total, 300) }]
            : []
          : sampleCountries.length > 0
            ? sampleCountries.map((country) => ({ offset: 0, limit: perCountry, country }))
            : [{ offset: 0, limit: perCountry }];

        const pages = await Promise.all(
          requests.map((request) => searchOccurrences({ taxonKey: taxon.acceptedKey, ...request })),
        );

        const queryKeys = new Set([taxon.acceptedKey, taxon.usageKey]);
        const excluded: ExclusionTally = {};
        const seen = new Set<string>();
        const points: OccurrencePoint[] = [];
        let fetched = 0;
        for (const page of pages) {
          for (const raw of page.results) {
            const result = validateOccurrence(raw, { queryKeys });
            if (result.ok) {
              if (seen.has(result.point.gbifId)) continue;
              seen.add(result.point.gbifId);
              fetched += 1;
              points.push(result.point);
            } else {
              fetched += 1;
              const reason: ReasonCode = result.reason === "MALFORMED" ? "UPSTREAM_MALFORMED_RESPONSE" : result.reason;
              excluded[reason] = (excluded[reason] ?? 0) + 1;
            }
          }
        }

        if (points.length < minReliableOccurrences) {
          return {
            status: "insufficient",
            taxon,
            totalGeoreferenced: total,
            fetched,
            retained: points.length,
            excluded,
            minRequired: minReliableOccurrences,
            provenance: provenance(taxon.acceptedKey, ["OCCURRENCE_INSUFFICIENT_RELIABLE_RECORDS"]),
          } as const;
        }

        const perDataset = new Map<string, number>();
        for (const point of points) {
          if (point.datasetKey) perDataset.set(point.datasetKey, (perDataset.get(point.datasetKey) ?? 0) + 1);
        }
        const top = [...perDataset.entries()].sort((a, b) => b[1] - a[1]).slice(0, GBIF_SAMPLING.datasetCitationsShown);
        const datasets = (await Promise.all(top.map(([key, count]) => citationFor(key, count)))).filter(
          (d): d is DatasetCitation => d !== null,
        );

        const topFacet = facet(head, "DATASET_KEY")[0];
        const topDatasetInfo = topFacet && isUuid(topFacet.name) ? await citationFor(topFacet.name.toLowerCase(), 0) : null;
        const topDataset =
          topFacet && total > 0
            ? { datasetKey: topFacet.name, title: topDatasetInfo?.title ?? null, count: topFacet.count, share: topFacet.count / total }
            : null;

        return {
          status: "verified",
          taxon,
          points,
          totalGeoreferenced: total,
          fetched,
          excluded,
          sampled,
          pagesFetched: pages.length,
          sampleCountries,
          topDataset,
          countries: facet(head, "COUNTRY"),
          licences: facet(head, "LICENSE"),
          datasets,
          provenance: provenance(taxon.acceptedKey),
        } as const;
      } catch (error) {
        return { status: "unavailable", reason: reasonOf(error) } as const;
      }
    },
    { ttlMs: CACHE_TTL.gbifOccurrences * 1000, staleIfErrorMs: 3600_000, shouldStore: stored },
  );
}
