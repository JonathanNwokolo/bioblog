import { ADAPTER_VERSION, CACHE_TTL } from "../config.ts";
import { checkNameQuery, foldName } from "../query.ts";
import { SciCache } from "../cache.ts";
import { ProviderError, type Provenance, type ReasonCode } from "../types.ts";
import { efetchTaxonomy, esearchTaxonomy, esummaryTaxonomy, isTaxId } from "./client.ts";
import type {
  DescendantsResult,
  NameMatchStatus,
  NameSearchResult,
  TaxonLookup,
  TaxonRecord,
  TaxonSummary,
} from "./types.ts";

export const NCBI_TAXON_URL = "https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=";
export const NCBI_ATTRIBUTION = "NCBI Taxonomy, National Center for Biotechnology Information (NIH/NLM)";
export const NCBI_RIGHTS =
  "O NCBI não impõe restrições ao uso dos dados; consulte a política de uso do NCBI. O NCBI Taxonomy não é uma autoridade taxonômica primária.";

export function ncbiTaxonUrl(taxId: string) {
  return `${NCBI_TAXON_URL}${encodeURIComponent(taxId)}`;
}

function provenance(taxIds: string[], reasonCodes: ReasonCode[] = []): Provenance {
  return {
    provider: "ncbi-taxonomy",
    sourceUrl: taxIds.length === 1 ? ncbiTaxonUrl(taxIds[0]) : "https://www.ncbi.nlm.nih.gov/taxonomy",
    sourceRecordIds: taxIds,
    fetchedAt: new Date().toISOString(),
    adapterVersion: ADAPTER_VERSION,
    upstreamVersion: null,
    attribution: NCBI_ATTRIBUTION,
    licenceOrRights: NCBI_RIGHTS,
    reasonCodes,
  };
}

export { checkNameQuery, foldName, type QueryCheck } from "../query.ts";

// ---------------------------------------------------------------------------------------------
// Cache (processo) — resultados `unavailable` nunca são guardados.
// ---------------------------------------------------------------------------------------------

const recordCache = new SciCache<TaxonLookup>(300);
const searchCache = new SciCache<NameSearchResult>(300);
const descendantsCache = new SciCache<DescendantsResult>(200);

const stored = (value: unknown) => {
  const status = (value as { status?: string }).status;
  return status !== "unavailable";
};

export function clearNcbiCaches() {
  recordCache.clear();
  searchCache.clear();
  descendantsCache.clear();
}

function reasonOf(error: unknown): ReasonCode {
  return error instanceof ProviderError ? error.code : "UPSTREAM_ERROR";
}

// ---------------------------------------------------------------------------------------------
// Registro por TaxID
// ---------------------------------------------------------------------------------------------

export async function getTaxonById(taxId: string): Promise<TaxonLookup> {
  if (!isTaxId(taxId)) return { status: "invalid_query", reason: "QUERY_INVALID" };
  return recordCache.getOrLoad(
    `taxon:${taxId}`,
    async () => {
      try {
        const records = await efetchTaxonomy([taxId]);
        const taxon = records.find((record) => record.taxId === taxId);
        if (!taxon) return { status: "not_found", taxId, provenance: provenance([taxId], ["TAXON_NOT_FOUND"]) } as const;
        return { status: "verified", taxon, provenance: provenance([taxId]) } as const;
      } catch (error) {
        return { status: "unavailable", reason: reasonOf(error) } as const;
      }
    },
    { ttlMs: CACHE_TTL.ncbiTaxon * 1000, staleIfErrorMs: 3600_000, shouldStore: stored },
  );
}

// ---------------------------------------------------------------------------------------------
// Busca por nome
// ---------------------------------------------------------------------------------------------

/** Classifica como o nome pesquisado se relaciona com o registro (usa a lista de nomes do NCBI). */
export function classifyNameMatch(query: string, taxon: Pick<TaxonRecord, "scientificName" | "synonyms">): NameMatchStatus {
  const q = foldName(query);
  if (foldName(taxon.scientificName) === q) return "exact";
  if (taxon.synonyms.some((name) => foldName(name) === q)) return "accepted_synonym";
  return "matched_alias";
}

export async function searchTaxaByName(rawQuery: string): Promise<NameSearchResult> {
  const check = checkNameQuery(rawQuery);
  if (!check.ok) return { status: "invalid_query", reason: check.reason, hint: check.hint };
  const query = check.query;
  if (check.asTaxId) {
    const lookup = await getTaxonById(check.asTaxId);
    if (lookup.status === "verified") {
      return {
        status: "verified",
        query,
        matchStatus: "exact",
        taxon: lookup.taxon,
        alsoMatched: [],
        provenance: lookup.provenance,
      };
    }
    if (lookup.status === "not_found") {
      return { status: "not_found", query, suggestions: [], provenance: lookup.provenance };
    }
    return { status: "unavailable", reason: lookup.status === "unavailable" ? lookup.reason : "UPSTREAM_ERROR" };
  }

  return searchCache.getOrLoad(
    `name:${foldName(query)}`,
    async () => {
      try {
        // 1) Frase exata em todos os nomes (científico, sinônimos, nomes comuns).
        const phrase = `"${query.replaceAll('"', "")}"[All Names]`;
        const exact = await esearchTaxonomy(phrase, 10);
        if (exact.ids.length === 0) {
          // 2) Sugestões por prefixo, nunca resolvidas automaticamente.
          let suggestions: TaxonSummary[] = [];
          if (query.length >= 4 && /^[\p{L}][\p{L} -]*$/u.test(query)) {
            const prefix = await esearchTaxonomy(`${query}*[All Names]`, 8);
            suggestions = await esummaryTaxonomy(prefix.ids);
          }
          return {
            status: "not_found",
            query,
            suggestions,
            provenance: provenance(suggestions.map((s) => s.taxId), ["TAXON_NOT_FOUND"]),
          } as const;
        }

        const candidates = await esummaryTaxonomy(exact.ids);
        if (candidates.length === 0) {
          throw new ProviderError("ncbi-taxonomy", "UPSTREAM_MALFORMED_RESPONSE");
        }
        const q = foldName(query);
        const byScientificName = candidates.filter((c) => foldName(c.scientificName) === q);

        // Homônimos: o mesmo nome científico em mais de um registro → incerteza explícita.
        if (byScientificName.length > 1 || (byScientificName.length === 0 && candidates.length > 1)) {
          return {
            status: "ambiguous",
            query,
            candidates,
            provenance: provenance(candidates.map((c) => c.taxId), ["TAXON_AMBIGUOUS"]),
          } as const;
        }

        const chosen = byScientificName[0] ?? candidates[0];
        const alsoMatched = candidates.filter((c) => c.taxId !== chosen.taxId);
        let matchStatus: NameMatchStatus = "exact";
        if (byScientificName.length === 0) {
          const [detail] = await efetchTaxonomy([chosen.taxId]);
          matchStatus = detail ? classifyNameMatch(query, detail) : "matched_alias";
        }
        return {
          status: "verified",
          query,
          matchStatus,
          taxon: chosen,
          alsoMatched,
          provenance: provenance([chosen.taxId, ...alsoMatched.map((c) => c.taxId)]),
        } as const;
      } catch (error) {
        return { status: "unavailable", reason: reasonOf(error) } as const;
      }
    },
    { ttlMs: CACHE_TTL.ncbiSearch * 1000, staleIfErrorMs: 3600_000, shouldStore: stored },
  );
}

// ---------------------------------------------------------------------------------------------
// Táxons descendentes (amostra)
// ---------------------------------------------------------------------------------------------

/** Categorias abaixo de espécie (ou sem descendência útil): não listamos "filhos". */
const LEAF_RANKS = new Set([
  "species",
  "subspecies",
  "strain",
  "varietas",
  "forma",
  "isolate",
  "serotype",
  "serogroup",
  "biotype",
  "genotype",
  "pathogroup",
  "morph",
  "subvariety",
  "forma specialis",
]);

const SAMPLE_SIZE = 40;

export async function getSpeciesBelow(taxId: string, rank: string | null): Promise<DescendantsResult> {
  if (!isTaxId(taxId)) return { status: "unavailable", reason: "QUERY_INVALID" };
  if (rank && LEAF_RANKS.has(rank)) return { status: "not_applicable" };
  return descendantsCache.getOrLoad(
    `below:${taxId}`,
    async () => {
      try {
        const found = await esearchTaxonomy(`txid${taxId}[Subtree] AND species[Rank]`, SAMPLE_SIZE);
        if (found.count === 0) return { status: "not_applicable" } as const;
        const shown = (await esummaryTaxonomy(found.ids)).sort((a, b) => a.scientificName.localeCompare(b.scientificName, "en"));
        return {
          status: "verified",
          total: found.count,
          shown,
          complete: found.count <= found.ids.length,
          rankFilter: "species",
          provenance: provenance([taxId]),
        } as const;
      } catch (error) {
        return { status: "unavailable", reason: reasonOf(error) } as const;
      }
    },
    { ttlMs: CACHE_TTL.ncbiTaxon * 1000, staleIfErrorMs: 3600_000, shouldStore: stored },
  );
}
