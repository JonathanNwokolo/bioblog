import type { Provenance, ReasonCode } from "../types.ts";

export interface GbifTaxon {
  /** Texto pesquisado, como o visitante digitou (já normalizado). */
  query: string;
  /** Chave de uso devolvida pelo match (pode ser um sinônimo). */
  usageKey: number;
  /** Chave aceita, usada na busca de ocorrências. */
  acceptedKey: number;
  scientificName: string;
  canonicalName: string;
  /** Nome do táxon aceito (igual a `canonicalName` quando o match já é o aceito). */
  acceptedName: string;
  rank: string;
  taxonomicStatus: string;
  matchType: string;
  confidence: number | null;
  isSynonym: boolean;
  classification: {
    kingdom: string | null;
    phylum: string | null;
    class: string | null;
    order: string | null;
    family: string | null;
    genus: string | null;
    species: string | null;
  };
}

export type GbifResolveResult =
  | { status: "verified"; taxon: GbifTaxon; provenance: Provenance }
  | {
      status: "ambiguous";
      query: string;
      /** Motivo explicável ao visitante. */
      kind: "fuzzy" | "doubtful" | "higher_rank" | "rank_too_broad";
      suggestion: { canonicalName: string; rank: string; usageKey: number } | null;
      provenance: Provenance;
    }
  | { status: "not_found"; query: string; provenance: Provenance }
  | { status: "invalid_query"; reason: ReasonCode; hint: string }
  | { status: "unavailable"; reason: ReasonCode };

export interface OccurrencePoint {
  gbifId: string;
  lat: number;
  lon: number;
  /** Incerteza informada pela fonte; ausente fica `null` (nunca inventada). */
  uncertaintyMeters: number | null;
  basisOfRecord: string | null;
  year: number | null;
  eventDate: string | null;
  countryCode: string | null;
  country: string | null;
  datasetKey: string | null;
  datasetName: string | null;
  institutionCode: string | null;
  rightsHolder: string | null;
  licence: string | null;
  recordedTaxonName: string | null;
  taxonRank: string | null;
  /** Todos os flags originais da GBIF, preservados. */
  issues: string[];
  /** Subconjunto dos flags que são informativos e não motivaram exclusão. */
  informationalIssues: string[];
  /** Link humano do registro no gbif.org. */
  url: string;
  references: string | null;
}

export type ExclusionTally = Partial<Record<ReasonCode, number>>;

export interface DatasetCitation {
  datasetKey: string;
  title: string;
  citation: string | null;
  doi: string | null;
  licence: string | null;
  /** Quantos registros exibidos pertencem a este conjunto. */
  records: number;
}

export interface FacetCount {
  name: string;
  count: number;
}

export type OccurrenceResult =
  | {
      status: "verified";
      taxon: GbifTaxon;
      points: OccurrencePoint[];
      /** Total de registros com coordenadas segundo a GBIF para este filtro. */
      totalGeoreferenced: number;
      /** Registros efetivamente baixados e avaliados nesta amostra. */
      fetched: number;
      excluded: ExclusionTally;
      sampled: boolean;
      pagesFetched: number;
      /** Países amostrados quando o conjunto é grande (vazio quando tudo foi avaliado). */
      sampleCountries: string[];
      /** Conjunto de dados que mais contribui, para sinalizar concentração. */
      topDataset: { datasetKey: string; title: string | null; count: number; share: number } | null;
      countries: FacetCount[];
      licences: FacetCount[];
      datasets: DatasetCitation[];
      provenance: Provenance;
    }
  | {
      status: "insufficient";
      taxon: GbifTaxon;
      totalGeoreferenced: number;
      fetched: number;
      retained: number;
      excluded: ExclusionTally;
      minRequired: number;
      provenance: Provenance;
    }
  | { status: "unavailable"; reason: ReasonCode };
