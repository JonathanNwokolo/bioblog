import { PROVIDER_HOSTS, PROVIDER_LIMITS } from "./config.ts";
import { ProviderLimiter } from "./limiter.ts";
import { ProviderError, type ProviderId } from "./types.ts";

type HttpProvider = Exclude<ProviderId, "cdc-dpdx">;

const limiters = new Map<HttpProvider, ProviderLimiter>();

export function limiterFor(provider: HttpProvider): ProviderLimiter {
  let limiter = limiters.get(provider);
  if (!limiter) {
    const { minIntervalMs, maxConcurrent, maxQueue } = PROVIDER_LIMITS[provider];
    limiter = new ProviderLimiter({ provider, minIntervalMs, maxConcurrent, maxQueue });
    limiters.set(provider, limiter);
  }
  return limiter;
}

/** Transporte injetável: testes substituem `fetch` por fixtures sem tocar a rede. */
export type Transport = (url: string, init: RequestInit) => Promise<Response>;

let transport: Transport = (url, init) => fetch(url, init);

export function setTransportForTests(next: Transport | null) {
  transport = next ?? ((url, init) => fetch(url, init));
}

/** Substitui/zera limitadores (testes com tempo controlado). */
export function setLimiterForTests(provider: HttpProvider, limiter: ProviderLimiter | null) {
  if (limiter) limiters.set(provider, limiter);
  else limiters.delete(provider);
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Monta uma URL upstream a partir de um caminho fixo e parâmetros. O visitante só influencia
 * valores de parâmetros (codificados); host, protocolo e caminho vêm de constantes do adaptador.
 */
export function buildProviderUrl(
  provider: HttpProvider,
  base: string,
  params: Record<string, string | number | boolean | undefined | readonly string[]>,
): URL {
  const url = new URL(base);
  assertAllowedUrl(provider, url);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(key, item);
    } else {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

export function assertAllowedUrl(provider: HttpProvider, url: URL) {
  const allowed = PROVIDER_HOSTS[provider];
  if (url.protocol !== "https:" || url.username || url.password || url.port || !allowed.includes(url.hostname)) {
    // Falha de programação, não de rede: nunca chega ao visitante com detalhes.
    throw new ProviderError(provider, "UPSTREAM_ERROR");
  }
}

async function readLimited(response: Response, maxBytes: number, provider: HttpProvider): Promise<string> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw new ProviderError(provider, "UPSTREAM_TOO_LARGE");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new ProviderError(provider, "UPSTREAM_TOO_LARGE");
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

function retryAfterMs(response: Response): number | null {
  const header = response.headers.get("retry-after");
  if (!header) return null;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.min(seconds * 1000, 2000) : null;
}

/**
 * Injeção de falhas SÓ para QA em desenvolvimento: `SCIENCE_FAULT=gbif=timeout,ncbi-taxonomy=slow`.
 * Ignorada quando NODE_ENV=production, então não existe em produção.
 */
export function injectedFault(provider: HttpProvider, env: Record<string, string | undefined> = process.env): string | null {
  if (env.NODE_ENV === "production") return null;
  const raw = env.SCIENCE_FAULT;
  if (!raw) return null;
  for (const entry of raw.split(",")) {
    const [name, kind] = entry.split("=").map((part) => part.trim());
    if (name === provider && kind) return kind;
  }
  return null;
}

export interface FetchOptions {
  accept: "json" | "xml";
  signal?: AbortSignal;
}

/**
 * GET com host fixo, sem redirecionamentos, timeout, teto de bytes, tentativas limitadas e
 * limitação de taxa por provedor. Devolve texto bruto; a validação de esquema é do chamador.
 */
export async function providerGetText(provider: HttpProvider, url: URL, options: FetchOptions): Promise<string> {
  assertAllowedUrl(provider, url);
  const fault = injectedFault(provider);
  if (fault === "timeout") throw new ProviderError(provider, "UPSTREAM_TIMEOUT");
  if (fault === "rate_limited") throw new ProviderError(provider, "UPSTREAM_RATE_LIMITED");
  if (fault === "error") throw new ProviderError(provider, "UPSTREAM_ERROR");
  if (fault === "malformed") throw new ProviderError(provider, "UPSTREAM_MALFORMED_RESPONSE");
  if (fault === "slow") await sleep(4000);
  const { timeoutMs, maxBytes, retries } = PROVIDER_LIMITS[provider];
  const limiter = limiterFor(provider);
  let lastError: ProviderError = new ProviderError(provider, "UPSTREAM_ERROR");

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (options.signal?.aborted) throw new ProviderError(provider, "UPSTREAM_TIMEOUT");
    try {
      return await limiter.run(async () => {
        const timeout = AbortSignal.timeout(timeoutMs);
        const signal = options.signal ? AbortSignal.any([timeout, options.signal]) : timeout;
        let response: Response;
        try {
          response = await transport(url.toString(), {
            method: "GET",
            redirect: "error",
            cache: "no-store",
            signal,
            headers: {
              accept: options.accept === "json" ? "application/json" : "application/xml, text/xml",
              "user-agent": "Microcosmos/2.2 (+scientific-editorial; read-only)",
            },
          });
        } catch (error) {
          const name = error instanceof Error ? error.name : "";
          throw new ProviderError(provider, name === "TimeoutError" || name === "AbortError" ? "UPSTREAM_TIMEOUT" : "UPSTREAM_ERROR");
        }

        if (response.status === 429) {
          const wait = retryAfterMs(response);
          await response.body?.cancel().catch(() => undefined);
          const error = new ProviderError(provider, "UPSTREAM_RATE_LIMITED");
          (error as ProviderError & { retryAfter?: number }).retryAfter = wait ?? undefined;
          throw error;
        }
        if (response.status >= 500) {
          await response.body?.cancel().catch(() => undefined);
          throw new ProviderError(provider, "UPSTREAM_ERROR");
        }
        if (!response.ok) {
          await response.body?.cancel().catch(() => undefined);
          // 4xx não é repetido: o pedido em si é que está errado ou o recurso não existe.
          const error = new ProviderError(provider, "UPSTREAM_ERROR");
          (error as ProviderError & { final?: boolean }).final = true;
          throw error;
        }
        const type = response.headers.get("content-type") ?? "";
        const expected = options.accept === "json" ? /json/i : /xml/i;
        if (!expected.test(type) && !/text\/plain/i.test(type)) {
          await response.body?.cancel().catch(() => undefined);
          throw new ProviderError(provider, "UPSTREAM_MALFORMED_RESPONSE");
        }
        return readLimited(response, maxBytes, provider);
      });
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error;
      lastError = error;
      const final = (error as ProviderError & { final?: boolean }).final === true;
      const retryable = error.code === "UPSTREAM_RATE_LIMITED" || error.code === "UPSTREAM_TIMEOUT" || error.code === "UPSTREAM_ERROR";
      if (final || !retryable || attempt === retries) break;
      const hinted = (error as ProviderError & { retryAfter?: number }).retryAfter;
      const backoff = hinted ?? Math.min(300 * 3 ** attempt, 2000) + Math.floor(Math.random() * 120);
      await sleep(backoff);
    }
  }
  throw lastError;
}

export async function providerGetJson(provider: HttpProvider, url: URL, signal?: AbortSignal): Promise<unknown> {
  const text = await providerGetText(provider, url, { accept: "json", signal });
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ProviderError(provider, "UPSTREAM_MALFORMED_RESPONSE");
  }
}
