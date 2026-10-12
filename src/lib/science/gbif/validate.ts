import { GBIF_ACCEPTED_LICENCES } from "../config.ts";
import type { ReasonCode } from "../types.ts";
import type { OccurrencePoint } from "./types.ts";

/**
 * Validação de registros de ocorrência da GBIF.
 * Regras de docs/phase2-scientific-content-architecture.md §6.1, apoiadas na documentação oficial
 * de flags (techdocs.gbif.org/en/data-use/occurrence-issues-and-flags): nem todo flag é erro.
 */

/** Coordenada inválida/impossível: exclusão obrigatória. */
export const FATAL_COORDINATE_FLAGS = new Set([
  "ZERO_COORDINATE",
  "COORDINATE_OUT_OF_RANGE",
  "COORDINATE_INVALID",
]);

/** Flags que sugerem posição ou incerteza duvidosas: exclusão, sem "consertar" a coordenada. */
export const QUALITY_REJECT_FLAGS = new Set([
  "COUNTRY_COORDINATE_MISMATCH",
  "COORDINATE_REPROJECTION_FAILED",
  "COORDINATE_REPROJECTION_SUSPICIOUS",
  "PRESUMED_SWAPPED_COORDINATE",
  "PRESUMED_NEGATED_LATITUDE",
  "PRESUMED_NEGATED_LONGITUDE",
  "COORDINATE_UNCERTAINTY_METERS_INVALID",
  "COORDINATE_PRECISION_INVALID",
  "GEODETIC_DATUM_INVALID",
  "INTERPRETATION_ERROR",
]);

/** Identidade taxonômica da própria ocorrência incerta ou sem correspondência. */
export const TAXON_REJECT_FLAGS = new Set(["TAXON_MATCH_NONE", "TAXON_MATCH_FUZZY"]);

export interface ValidationContext {
  /** Chaves do táxon consultado (aceito + chave de uso). */
  queryKeys: ReadonlySet<number>;
  acceptedLicences?: readonly string[];
}

export type Validation =
  | { ok: true; point: OccurrencePoint }
  | { ok: false; reason: ReasonCode | "MALFORMED"; gbifId: string | null };

type Raw = Record<string, unknown>;

function str(value: unknown, max = 300): string | null {
  if (typeof value !== "string") return null;
  // eslint-disable-next-line no-control-regex
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
  return cleaned.length > 0 ? cleaned : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function keyNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  return null;
}

function normalizeLicence(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.toLowerCase();
  if (v.includes("publicdomain/zero")) return "CC0_1_0";
  if (v.includes("by-nc/4.0")) return "CC_BY_NC_4_0";
  if (v.includes("by-nc/")) return "CC_BY_NC_OTHER";
  if (v.includes("licenses/by/4.0")) return "CC_BY_4_0";
  if (v.includes("licenses/by/")) return "CC_BY_OTHER";
  // A GBIF também pode devolver o enum (ex.: "CC_BY_4_0").
  if (/^CC[0-9A-Z_]+$/.test(value)) return value;
  return null;
}

/** Devolve os pontos de comparação de táxon do registro. */
function recordKeys(raw: Raw): number[] {
  const names = [
    "taxonKey",
    "acceptedTaxonKey",
    "speciesKey",
    "genusKey",
    "familyKey",
    "orderKey",
    "classKey",
    "phylumKey",
    "kingdomKey",
  ];
  return names.flatMap((name) => {
    const key = keyNumber(raw[name]);
    return key === null ? [] : [key];
  });
}

export function validateOccurrence(raw: unknown, context: ValidationContext): Validation {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false, reason: "MALFORMED", gbifId: null };
  const record = raw as Raw;
  const idNumber = keyNumber(record.key);
  const gbifId = idNumber !== null ? String(idNumber) : str(record.gbifID, 24);
  if (!gbifId || !/^\d{1,20}$/.test(gbifId)) return { ok: false, reason: "MALFORMED", gbifId: null };

  const issues = Array.isArray(record.issues)
    ? record.issues.filter((i): i is string => typeof i === "string" && /^[A-Z0-9_]{2,64}$/.test(i)).slice(0, 64)
    : [];

  if (typeof record.occurrenceStatus === "string" && record.occurrenceStatus.toUpperCase() === "ABSENT") {
    return { ok: false, reason: "OCCURRENCE_ABSENCE_RECORD", gbifId };
  }

  const lat = num(record.decimalLatitude);
  const lon = num(record.decimalLongitude);
  if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180 || (lat === 0 && lon === 0)) {
    return { ok: false, reason: "OCCURRENCE_INVALID_COORDINATES", gbifId };
  }
  if (issues.some((flag) => FATAL_COORDINATE_FLAGS.has(flag))) {
    return { ok: false, reason: "OCCURRENCE_INVALID_COORDINATES", gbifId };
  }
  if (issues.some((flag) => QUALITY_REJECT_FLAGS.has(flag))) {
    return { ok: false, reason: "OCCURRENCE_QUALITY_FLAG_REJECTED", gbifId };
  }

  // Compatibilidade taxonômica: o registro precisa estar sob o táxon consultado.
  const keys = recordKeys(record);
  if (issues.some((flag) => TAXON_REJECT_FLAGS.has(flag)) || !keys.some((key) => context.queryKeys.has(key))) {
    return { ok: false, reason: "OCCURRENCE_TAXON_MISMATCH", gbifId };
  }

  const licence = normalizeLicence(record.license);
  const accepted = context.acceptedLicences ?? GBIF_ACCEPTED_LICENCES;
  if (!licence || !accepted.includes(licence)) {
    return { ok: false, reason: "OCCURRENCE_LICENCE_UNSUPPORTED", gbifId };
  }

  const uncertainty = num(record.coordinateUncertaintyInMeters);
  const year = num(record.year);
  const informationalIssues = issues.filter(
    (flag) => !FATAL_COORDINATE_FLAGS.has(flag) && !QUALITY_REJECT_FLAGS.has(flag) && !TAXON_REJECT_FLAGS.has(flag),
  );

  const references = str(record.references, 500);
  return {
    ok: true,
    point: {
      gbifId,
      lat,
      lon,
      uncertaintyMeters: uncertainty !== null && uncertainty > 0 ? uncertainty : null,
      basisOfRecord: str(record.basisOfRecord, 40),
      year: year !== null && Number.isInteger(year) && year > 0 && year < 3000 ? year : null,
      eventDate: str(record.eventDate, 60),
      countryCode: (() => {
        const code = str(record.countryCode, 2);
        return code && /^[A-Z]{2}$/.test(code) ? code : null;
      })(),
      country: str(record.country, 80),
      datasetKey: (() => {
        const key = str(record.datasetKey, 40);
        return key && /^[0-9a-f-]{36}$/i.test(key) ? key.toLowerCase() : null;
      })(),
      datasetName: str(record.datasetName, 200),
      institutionCode: str(record.institutionCode, 80),
      rightsHolder: str(record.rightsHolder, 200),
      licence,
      recordedTaxonName: str(record.scientificName, 200),
      taxonRank: str(record.taxonRank, 40),
      issues,
      informationalIssues,
      url: `https://www.gbif.org/occurrence/${gbifId}`,
      // Só links http(s) vindos do conjunto de dados são mantidos como texto; a UI não os torna <a>.
      references: references && /^https?:\/\//i.test(references) ? references : null,
    },
  };
}
