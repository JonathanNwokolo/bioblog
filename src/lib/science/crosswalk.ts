import { foldName } from "./query.ts";
import type { GbifTaxon } from "./gbif/types.ts";
import type { TaxonRecord } from "./ncbi/types.ts";

/**
 * Mapeamento explícito entre fontes. Identificadores NÃO são comparáveis: o TaxID do NCBI e a
 * chave do backbone da GBIF são espaços numéricos independentes (ex.: Plasmodium falciparum é
 * TaxID 5833 no NCBI e usageKey 10540993 na GBIF). Cada fonte resolve o nome por conta própria e a
 * ligação só é afirmada quando as identidades nominais conferem, com a evidência registrada.
 */
export type CrosswalkAgreement =
  /** Nomes científicos aceitos idênticos e mesmo nível taxonômico. */
  | "name_match"
  /** Nomes aceitos diferem, mas uma fonte lista o nome da outra como sinônimo. */
  | "synonym_match"
  /** Mesmo nome, níveis diferentes: não ligado. */
  | "rank_mismatch"
  /** Nomes aceitos incompatíveis e sem sinonímia: não ligado. */
  | "name_conflict"
  /** Só uma das fontes resolveu o nome. */
  | "single_source";

export interface Crosswalk {
  agreement: CrosswalkAgreement;
  /** `true` somente quando é seguro tratar os dois registros como o mesmo táxon. */
  linked: boolean;
  ncbi: { taxId: string; scientificName: string; rank: string | null } | null;
  gbif: { acceptedKey: number; canonicalName: string; rank: string } | null;
  evidence: string[];
}

const RANK_ALIASES: Record<string, string> = { varietas: "variety", forma: "form", subgenus: "subgenus" };

function normalizeRank(rank: string | null): string | null {
  if (!rank) return null;
  const lower = rank.toLowerCase().replace(/_/g, " ");
  return RANK_ALIASES[lower] ?? lower;
}

export function buildCrosswalk(
  ncbi: Pick<TaxonRecord, "taxId" | "scientificName" | "rank" | "synonyms"> | null,
  gbif: Pick<GbifTaxon, "acceptedKey" | "canonicalName" | "acceptedName" | "rank" | "isSynonym"> | null,
): Crosswalk {
  const ncbiRef = ncbi ? { taxId: ncbi.taxId, scientificName: ncbi.scientificName, rank: ncbi.rank } : null;
  const gbifRef = gbif ? { acceptedKey: gbif.acceptedKey, canonicalName: gbif.acceptedName, rank: gbif.rank } : null;
  if (!ncbi || !gbif) {
    return {
      agreement: "single_source",
      linked: false,
      ncbi: ncbiRef,
      gbif: gbifRef,
      evidence: [ncbi ? "Somente o NCBI resolveu este nome." : gbif ? "Somente a GBIF resolveu este nome." : "Nenhuma fonte resolveu este nome."],
    };
  }

  const ncbiName = foldName(ncbi.scientificName);
  const gbifName = foldName(gbif.acceptedName);
  const sameRank = normalizeRank(ncbi.rank) === normalizeRank(gbif.rank);
  const evidence: string[] = [];

  if (ncbiName === gbifName) {
    if (!sameRank) {
      evidence.push(`Mesmo nome (${ncbi.scientificName}), mas níveis diferentes: ${ncbi.rank ?? "sem nível"} no NCBI e ${gbif.rank.toLowerCase()} na GBIF.`);
      return { agreement: "rank_mismatch", linked: false, ncbi: ncbiRef, gbif: gbifRef, evidence };
    }
    evidence.push(`Nome científico aceito idêntico nas duas fontes: ${ncbi.scientificName}.`);
    if (gbif.isSynonym) evidence.push("O nome pesquisado é sinônimo na GBIF; a busca usa o nome aceito.");
    return { agreement: "name_match", linked: true, ncbi: ncbiRef, gbif: gbifRef, evidence };
  }

  if (ncbi.synonyms.some((name) => foldName(name) === gbifName)) {
    evidence.push(`O NCBI lista "${gbif.acceptedName}" como sinônimo de "${ncbi.scientificName}".`);
    return { agreement: sameRank ? "synonym_match" : "rank_mismatch", linked: sameRank, ncbi: ncbiRef, gbif: gbifRef, evidence };
  }

  evidence.push(`Nomes aceitos diferentes e sem sinonímia declarada: "${ncbi.scientificName}" (NCBI) e "${gbif.acceptedName}" (GBIF).`);
  return { agreement: "name_conflict", linked: false, ncbi: ncbiRef, gbif: gbifRef, evidence };
}
