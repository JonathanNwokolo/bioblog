/** Apresentação (pt-BR) de dados científicos. Sem rede e sem efeitos; testável. */

const RANKS_PT: Record<string, string> = {
  "cellular root": "raiz celular",
  "acellular root": "raiz acelular",
  superkingdom: "superreino",
  domain: "domínio",
  kingdom: "reino",
  subkingdom: "subreino",
  phylum: "filo",
  subphylum: "subfilo",
  class: "classe",
  subclass: "subclasse",
  infraclass: "infraclasse",
  superorder: "superordem",
  order: "ordem",
  suborder: "subordem",
  infraorder: "infraordem",
  superfamily: "superfamília",
  family: "família",
  subfamily: "subfamília",
  tribe: "tribo",
  genus: "gênero",
  subgenus: "subgênero",
  "species group": "grupo de espécies",
  "species subgroup": "subgrupo de espécies",
  species: "espécie",
  subspecies: "subespécie",
  varietas: "variedade",
  forma: "forma",
  strain: "linhagem",
  isolate: "isolado",
  clade: "clado",
  "no rank": "sem categoria",
};

/** Categorias cujo nome científico se escreve em itálico por convenção de nomenclatura. */
const ITALIC_RANKS = new Set(["genus", "subgenus", "species", "subspecies", "species group", "species subgroup", "varietas", "forma"]);

export function ncbiTaxonUrl(taxId: string): string {
  return `https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=${encodeURIComponent(taxId)}`;
}

export function rankLabel(rank: string | null): { text: string; translated: boolean } {
  if (!rank) return { text: "categoria não informada", translated: true };
  const pt = RANKS_PT[rank.toLowerCase()];
  return pt ? { text: pt, translated: true } : { text: rank, translated: false };
}

export function isItalicRank(rank: string | null): boolean {
  return rank !== null && ITALIC_RANKS.has(rank.toLowerCase());
}

const retrievedFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

export function formatRetrieved(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "data indisponível" : retrievedFormatter.format(date);
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

/** "2025/06/09 18:02:44" (NCBI) → "9 de junho de 2025"; valores fora do padrão voltam como null. */
export function formatNcbiDate(value: string | null): string | null {
  if (!value) return null;
  const match = /^(\d{4})\/(\d{2})\/(\d{2})/.exec(value);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

const BASIS_PT: Record<string, string> = {
  PRESERVED_SPECIMEN: "Espécime preservado",
  LIVING_SPECIMEN: "Espécime vivo",
  MATERIAL_SAMPLE: "Amostra de material",
  HUMAN_OBSERVATION: "Observação humana",
  MACHINE_OBSERVATION: "Observação por máquina",
  OBSERVATION: "Observação",
  FOSSIL_SPECIMEN: "Espécime fóssil",
  MATERIAL_CITATION: "Citação de material",
  OCCURRENCE: "Ocorrência",
  LITERATURE: "Literatura",
};

export function basisLabel(value: string | null): string | null {
  if (!value) return null;
  return BASIS_PT[value] ?? value.replace(/_/g, " ").toLowerCase();
}

/** Explicação em linguagem simples de flags da GBIF (os desconhecidos aparecem pelo código). */
const ISSUE_PT: Record<string, string> = {
  GEODETIC_DATUM_ASSUMED_WGS84: "Datum geodésico não informado; a GBIF assumiu WGS84.",
  CONTINENT_DERIVED_FROM_COORDINATES: "Continente derivado das coordenadas.",
  COUNTRY_DERIVED_FROM_COORDINATES: "País derivado das coordenadas.",
  COORDINATE_ROUNDED: "A coordenada original foi arredondada para 5 casas decimais.",
  TAXON_MATCH_HIGHERRANK: "O nome científico original só pôde ser associado ao backbone da GBIF em um nível taxonômico superior.",
  TAXON_CONCEPT_ID_NOT_FOUND: "Identificador do conceito taxonômico não encontrado.",
  TAXON_ID_NOT_FOUND: "Identificador do táxon não encontrado.",
  INSTITUTION_MATCH_NONE: "Instituição não reconhecida no registro de coleções.",
  INSTITUTION_MATCH_FUZZY: "Instituição reconhecida de forma aproximada.",
  COLLECTION_MATCH_NONE: "Coleção não reconhecida no registro de coleções.",
  RECORDED_DATE_INVALID: "Data do evento inválida na origem.",
  OCCURRENCE_STATUS_INFERRED_FROM_BASIS_OF_RECORD: "Status de presença inferido do tipo de registro.",
  BASIS_OF_RECORD_INVALID: "Tipo de registro inválido ou ausente na origem.",
};

export function issueLabel(code: string): string {
  return ISSUE_PT[code] ?? `Sinalizado pela GBIF como ${code}.`;
}

export function formatMeters(value: number): string {
  if (value >= 1000) return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value / 1000)} km`;
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value)} m`;
}

const regionNames = typeof Intl !== "undefined" && "DisplayNames" in Intl ? new Intl.DisplayNames(["pt-BR"], { type: "region" }) : null;

/** Código ISO 3166-1 alfa-2 → nome em português; devolve o próprio código se o ambiente não souber. */
export function countryName(code: string): string {
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
}

const EXCLUSION_PT: Record<string, string> = {
  OCCURRENCE_INVALID_COORDINATES: "Coordenadas ausentes, inválidas ou 0°, 0°",
  OCCURRENCE_TAXON_MISMATCH: "Táxon do registro incompatível com o consultado",
  OCCURRENCE_QUALITY_FLAG_REJECTED: "Sinalização de qualidade que torna a posição duvidosa",
  OCCURRENCE_LICENCE_UNSUPPORTED: "Licença ausente ou não aceita por este site",
  OCCURRENCE_ABSENCE_RECORD: "Registro de ausência",
  UPSTREAM_MALFORMED_RESPONSE: "Registro malformado na resposta da fonte",
};

export function exclusionLabel(code: string): string {
  return EXCLUSION_PT[code] ?? code;
}

const AGREEMENT_PT: Record<string, string> = {
  name_match: "Mesmo nome científico aceito nas duas fontes",
  synonym_match: "Nomes diferentes, ligados por sinonímia declarada pelo NCBI",
  rank_mismatch: "Mesmo nome, níveis taxonômicos diferentes: não ligado",
  name_conflict: "Nomes aceitos incompatíveis: não ligado",
  single_source: "Só uma das fontes resolveu o nome",
};

export function agreementLabel(code: string): string {
  return AGREEMENT_PT[code] ?? code;
}
