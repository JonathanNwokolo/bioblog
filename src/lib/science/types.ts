/**
 * Contratos compartilhados das integrações científicas (Fase 2.2).
 *
 * Princípio: dado externo é evidência com procedência, não verdade publicável. Todo resultado
 * normalizado carrega `provenance`; valores ausentes ficam `null`/ausentes, nunca preenchidos.
 * Ver docs/phase2-scientific-content-architecture.md e docs/phase22-scientific-api-integration-report.md.
 */

export type ProviderId = "ncbi-taxonomy" | "gbif" | "cdc-dpdx";

/** Códigos estáveis e testáveis (docs/phase2-scientific-content-architecture.md §8). */
export type ReasonCode =
  | "TAXON_NOT_FOUND"
  | "TAXON_AMBIGUOUS"
  | "TAXON_UPSTREAM_UNAVAILABLE"
  | "TAXON_RANK_NOT_SPECIES"
  | "QUERY_INVALID"
  | "IMAGE_RIGHTS_UNVERIFIED"
  | "IMAGE_PERMISSION_REQUIRED"
  | "IMAGE_REUSE_PROHIBITED"
  | "OCCURRENCE_INVALID_COORDINATES"
  | "OCCURRENCE_TAXON_MISMATCH"
  | "OCCURRENCE_QUALITY_FLAG_REJECTED"
  | "OCCURRENCE_LICENCE_UNSUPPORTED"
  | "OCCURRENCE_ABSENCE_RECORD"
  | "OCCURRENCE_INSUFFICIENT_RELIABLE_RECORDS"
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_RATE_LIMITED"
  | "UPSTREAM_ERROR"
  | "UPSTREAM_MALFORMED_RESPONSE"
  | "UPSTREAM_TOO_LARGE"
  | "CALLER_RATE_LIMITED";

export type ScienceStatus =
  | "verified"
  | "ambiguous"
  | "insufficient"
  | "blocked"
  | "unavailable"
  | "not_found"
  | "invalid_query";

export interface Provenance {
  provider: ProviderId;
  /** Página humana do registro de origem (nunca uma URL fornecida pelo visitante). */
  sourceUrl: string;
  sourceRecordIds: string[];
  /** ISO 8601 do momento em que os dados foram obtidos do provedor. */
  fetchedAt: string;
  adapterVersion: string;
  upstreamVersion: string | null;
  attribution: string;
  licenceOrRights: string | null;
  reasonCodes: ReasonCode[];
}

/** Falha de provedor: mensagem sempre segura para exibir; nunca contém corpo ou URL do provedor. */
export class ProviderError extends Error {
  readonly code: Extract<
    ReasonCode,
    | "UPSTREAM_TIMEOUT"
    | "UPSTREAM_RATE_LIMITED"
    | "UPSTREAM_ERROR"
    | "UPSTREAM_MALFORMED_RESPONSE"
    | "UPSTREAM_TOO_LARGE"
    | "CALLER_RATE_LIMITED"
  >;
  readonly provider: ProviderId;

  constructor(provider: ProviderId, code: ProviderError["code"]) {
    super(`${provider}:${code}`);
    this.name = "ProviderError";
    this.provider = provider;
    this.code = code;
  }
}

export function userFacingProviderMessage(code: ReasonCode): string {
  switch (code) {
    case "UPSTREAM_TIMEOUT":
      return "A fonte científica demorou demais para responder. Tente novamente em instantes.";
    case "UPSTREAM_RATE_LIMITED":
    case "CALLER_RATE_LIMITED":
      return "Muitas consultas em pouco tempo. Aguarde alguns segundos e tente novamente.";
    case "UPSTREAM_MALFORMED_RESPONSE":
    case "UPSTREAM_TOO_LARGE":
      return "A fonte científica devolveu uma resposta que não pôde ser validada, então nada foi exibido.";
    default:
      return "A fonte científica está indisponível no momento. Nada foi inventado para preencher a lacuna.";
  }
}
