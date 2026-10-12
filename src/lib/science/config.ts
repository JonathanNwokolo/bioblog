import type { ProviderId } from "./types.ts";

/**
 * Configuração das integrações científicas. Valores aqui são decisões de engenharia documentadas;
 * os marcados `OWNER_DECISION` dependem de confirmação da proprietária (ver relatório da Fase 2.2).
 */

export const ADAPTER_VERSION = "2.2.0";

/** Hosts upstream fixos. Nada fora desta lista é consultado, e o visitante nunca fornece host/caminho. */
export const PROVIDER_HOSTS: Record<Exclude<ProviderId, "cdc-dpdx">, readonly string[]> = {
  "ncbi-taxonomy": ["eutils.ncbi.nlm.nih.gov"],
  gbif: ["api.gbif.org"],
};

export const PROVIDER_LIMITS = {
  "ncbi-taxonomy": {
    /** NCBI: 3 req/s sem chave (X-RateLimit-Limit: 3 observado); 400 ms de espaçamento = 2,5 req/s. */
    minIntervalMs: 400,
    maxConcurrent: 1,
    maxQueue: 12,
    timeoutMs: 8000,
    maxBytes: 1_000_000,
    retries: 2,
  },
  gbif: {
    /** A GBIF não publica limite numérico; mantemos uso moderado e sem rajadas. */
    minIntervalMs: 120,
    maxConcurrent: 3,
    maxQueue: 24,
    timeoutMs: 10000,
    maxBytes: 5_000_000,
    retries: 2,
  },
} as const;

/** Janelas de cache (segundos). Resultados `unavailable` nunca são cacheados. */
export const CACHE_TTL = {
  ncbiTaxon: 60 * 60 * 24,
  ncbiSearch: 60 * 60 * 6,
  gbifMatch: 60 * 60 * 24,
  gbifOccurrences: 60 * 60 * 6,
  gbifDataset: 60 * 60 * 24 * 7,
} as const;

/** Orçamento por visitante para consultas que disparam chamadas externas (cache miss). */
export const CALLER_BUDGET = { windowMs: 60_000, max: 20 } as const;

/** Limites de entrada. */
export const QUERY_LIMITS = { minLength: 2, maxLength: 80 } as const;

/**
 * GBIF: tamanho da amostra e porta de suficiência.
 * OWNER_DECISION: `minReliableOccurrences` é um limiar de produto; 10 é o padrão de engenharia
 * até a proprietária decidir. O mapa nunca é publicado abaixo dele.
 */
export const GBIF_SAMPLING = {
  /**
   * Conjuntos grandes são amostrados por país (os N países com mais registros, sempre no início da
   * lista). Paginação profunda NÃO é usada: medimos offset 20000 em 111 s na GBIF (Aedes aegypti).
   */
  perCountry: 75,
  maxCountries: 4,
  /** Abaixo disto buscamos tudo em uma única página de 300 (limite máximo da API). */
  fullFetchThreshold: 300,
  minReliableOccurrences: 10,
  datasetCitationsShown: 6,
} as const;

/**
 * Licenças GBIF aceitas por registro.
 * OWNER_DECISION: CC BY-NC cobre a maior parte dos registros de parasitas (91% em T. cruzi, amostra
 * real). O site é divulgação científica sem fins comerciais; se a Microcosmos passar a ter uso
 * comercial, remova `CC_BY_NC_4_0` e `CC_BY_NC_3_0` daqui e o mapa passa a excluí-los.
 */
export const GBIF_ACCEPTED_LICENCES = [
  "CC0_1_0",
  "CC_BY_4_0",
  "CC_BY_NC_4_0",
] as const;

export const GBIF_LICENCE_LABELS: Record<string, string> = {
  CC0_1_0: "CC0 1.0",
  CC_BY_4_0: "CC BY 4.0",
  CC_BY_NC_4_0: "CC BY-NC 4.0",
};

/** Formato do cabeçalho do site de origem usado em links humanos. */
export const NCBI_TAXONOMY_BROWSER = "https://www.ncbi.nlm.nih.gov/datasets/taxonomy/";
export const GBIF_SITE = "https://www.gbif.org";
