import type { Provenance, ReasonCode } from "../types.ts";

export interface LineageNode {
  taxId: string;
  name: string;
  rank: string | null;
}

export interface TaxonSummary {
  taxId: string;
  scientificName: string;
  rank: string | null;
  division: string | null;
  /** Estado do registro no NCBI (ex.: "active"). */
  recordStatus: string | null;
  /** Preenchido quando o NCBI informa que o identificador foi mesclado em outro. */
  mergedInto: string | null;
}

export interface TaxonRecord extends TaxonSummary {
  parentTaxId: string | null;
  lineage: LineageNode[];
  synonyms: string[];
  commonNames: string[];
  authorities: string[];
  otherNames: Array<{ kind: string; name: string }>;
  geneticCode: string | null;
  createDate: string | null;
  updateDate: string | null;
}

export type NameMatchStatus = "exact" | "accepted_synonym" | "matched_alias";

export type TaxonLookup =
  | { status: "verified"; taxon: TaxonRecord; provenance: Provenance }
  | { status: "not_found"; taxId: string; provenance: Provenance }
  | { status: "invalid_query"; reason: ReasonCode }
  | { status: "unavailable"; reason: ReasonCode };

export type NameSearchResult =
  | { status: "invalid_query"; reason: ReasonCode; hint: string }
  | { status: "unavailable"; reason: ReasonCode }
  | { status: "not_found"; query: string; suggestions: TaxonSummary[]; provenance: Provenance }
  | {
      status: "verified";
      query: string;
      matchStatus: NameMatchStatus;
      taxon: TaxonSummary;
      /** Outros registros que também contêm o nome pesquisado (ex.: como sinônimo). */
      alsoMatched: TaxonSummary[];
      provenance: Provenance;
    }
  | { status: "ambiguous"; query: string; candidates: TaxonSummary[]; provenance: Provenance };

export type DescendantsResult =
  | { status: "verified"; total: number; shown: TaxonSummary[]; complete: boolean; rankFilter: string; provenance: Provenance }
  | { status: "not_applicable" }
  | { status: "unavailable"; reason: ReasonCode };
