import "server-only";
import { headers } from "next/headers";
import { callerBudget } from "./limiter.ts";

/** Chave do visitante para o orçamento de consultas externas (cabeçalho da plataforma, nunca confiável sozinho). */
async function callerKey(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = h.get("x-real-ip")?.trim();
  const raw = forwarded || real || "unknown";
  // Limita o tamanho para o mapa de contagem não ser usado como vetor de memória.
  return raw.slice(0, 64);
}

/**
 * `true` se este visitante ainda está dentro do orçamento de consultas que acionam provedores.
 * É uma segunda barreira: o limitador por provedor e o cache continuam protegendo o upstream
 * mesmo quando o cabeçalho de IP é forjado.
 */
export async function withinCallerBudget(): Promise<boolean> {
  return callerBudget.consume(await callerKey());
}
