import { z } from "zod";
import { buildProviderUrl, providerGetJson } from "../http.ts";
import { ProviderError } from "../types.ts";

/**
 * Cliente da API pública v1 da GBIF (sem autenticação). Endpoints reais usados:
 *   GET /v1/species/match           → resolução de nome para o backbone GBIF
 *   GET /v1/occurrence/search       → ocorrências (limit ≤ 300; offset + limit ≤ 100000)
 *   GET /v1/dataset/{uuid}          → título, citação, DOI e licença do conjunto de dados
 * A chave de táxon é sempre validada como inteiro e a de conjunto como UUID antes de entrar na URL.
 */
const BASE = "https://api.gbif.org/v1/";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return UUID.test(value);
}

const matchSchema = z.object({
  usageKey: z.number().int().positive().optional(),
  acceptedUsageKey: z.number().int().positive().optional(),
  scientificName: z.string().max(300).optional(),
  canonicalName: z.string().max(300).optional(),
  rank: z.string().max(40).optional(),
  status: z.string().max(40).optional(),
  confidence: z.number().optional(),
  matchType: z.string().max(40),
  kingdom: z.string().max(100).optional(),
  phylum: z.string().max(100).optional(),
  class: z.string().max(100).optional(),
  order: z.string().max(100).optional(),
  family: z.string().max(100).optional(),
  genus: z.string().max(100).optional(),
  species: z.string().max(200).optional(),
});

export type GbifMatchRaw = z.infer<typeof matchSchema>;

export async function speciesMatch(name: string): Promise<GbifMatchRaw> {
  const url = buildProviderUrl("gbif", `${BASE}species/match`, { name });
  const parsed = matchSchema.safeParse(await providerGetJson("gbif", url));
  if (!parsed.success) throw new ProviderError("gbif", "UPSTREAM_MALFORMED_RESPONSE");
  return parsed.data;
}

const occurrencePageSchema = z.object({
  offset: z.number().int().nonnegative(),
  limit: z.number().int().nonnegative(),
  endOfRecords: z.boolean(),
  count: z.number().int().nonnegative(),
  // Registros são validados um a um por `validateOccurrence`; aqui só o contêiner.
  results: z.array(z.unknown()).max(300),
  facets: z
    .array(
      z.object({
        field: z.string().max(60),
        counts: z.array(z.object({ name: z.string().max(200), count: z.number().int().nonnegative() })).max(50),
      }),
    )
    .optional(),
});

export type OccurrencePage = z.infer<typeof occurrencePageSchema>;

export interface OccurrenceQuery {
  taxonKey: number;
  offset: number;
  limit: number;
  /** Código ISO 3166-1 alfa-2 (validado antes de entrar na URL). */
  country?: string;
  facets?: readonly ("COUNTRY" | "LICENSE" | "BASIS_OF_RECORD" | "DATASET_KEY")[];
  facetLimit?: number;
}

export async function searchOccurrences(query: OccurrenceQuery): Promise<OccurrencePage> {
  if (!Number.isInteger(query.taxonKey) || query.taxonKey <= 0) throw new ProviderError("gbif", "UPSTREAM_ERROR");
  const url = buildProviderUrl("gbif", `${BASE}occurrence/search`, {
    taxonKey: query.taxonKey,
    country: query.country && /^[A-Z]{2}$/.test(query.country) ? query.country : undefined,
    hasCoordinate: true,
    hasGeospatialIssue: false,
    occurrenceStatus: "PRESENT",
    offset: Math.max(0, Math.floor(query.offset)),
    limit: Math.min(Math.max(0, Math.floor(query.limit)), 300),
    facet: query.facets ? [...query.facets] : undefined,
    facetLimit: query.facets ? (query.facetLimit ?? 10) : undefined,
  });
  const parsed = occurrencePageSchema.safeParse(await providerGetJson("gbif", url));
  if (!parsed.success) throw new ProviderError("gbif", "UPSTREAM_MALFORMED_RESPONSE");
  return parsed.data;
}

const datasetSchema = z.object({
  key: z.string().regex(UUID),
  title: z.string().max(500),
  doi: z.string().max(200).optional(),
  license: z.string().max(200).optional(),
  citation: z.object({ text: z.string().max(2000) }).optional(),
});

export type DatasetRaw = z.infer<typeof datasetSchema>;

export async function getDataset(datasetKey: string): Promise<DatasetRaw> {
  if (!isUuid(datasetKey)) throw new ProviderError("gbif", "UPSTREAM_ERROR");
  const url = buildProviderUrl("gbif", `${BASE}dataset/${datasetKey.toLowerCase()}`, {});
  const parsed = datasetSchema.safeParse(await providerGetJson("gbif", url));
  if (!parsed.success) throw new ProviderError("gbif", "UPSTREAM_MALFORMED_RESPONSE");
  return parsed.data;
}
