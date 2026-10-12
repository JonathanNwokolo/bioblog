import { QUERY_LIMITS } from "./config.ts";
import type { ReasonCode } from "./types.ts";

export type QueryCheck = { ok: true; query: string; asTaxId: string | null } | { ok: false; reason: ReasonCode; hint: string };

/**
 * Valida e normaliza o texto digitado. Aceita letras (com diacríticos), dígitos, espaço, hífen,
 * ponto, apóstrofo e parênteses. Aspas, colchetes, curingas e operadores nunca chegam ao NCBI:
 * o termo é sempre montado como frase entre aspas pelo adaptador.
 */
export function checkNameQuery(raw: string | null | undefined): QueryCheck {
  const text = (raw ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
  if (text.length === 0) {
    return { ok: false, reason: "QUERY_INVALID", hint: "Digite um nome científico, por exemplo Giardia duodenalis." };
  }
  if (text.length < QUERY_LIMITS.minLength || text.length > QUERY_LIMITS.maxLength) {
    return {
      ok: false,
      reason: "QUERY_INVALID",
      hint: `Use entre ${QUERY_LIMITS.minLength} e ${QUERY_LIMITS.maxLength} caracteres.`,
    };
  }
  if (/^\d{1,10}$/.test(text)) {
    if (/^[1-9]\d{0,9}$/.test(text)) return { ok: true, query: text, asTaxId: text };
    return { ok: false, reason: "QUERY_INVALID", hint: "Esse identificador numérico não é válido." };
  }
  if (!/^[\p{L}\p{N}][\p{L}\p{N} .'()-]*$/u.test(text) || !/\p{L}/u.test(text)) {
    return {
      ok: false,
      reason: "QUERY_INVALID",
      hint: "Use apenas letras, números, espaços, hífen, ponto e parênteses. Sem aspas, colchetes ou símbolos.",
    };
  }
  return { ok: true, query: text, asTaxId: null };
}

export function foldName(value: string): string {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

