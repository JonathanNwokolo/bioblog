/**
 * Cache em memória com TTL, LRU limitado, deduplicação de chamadas simultâneas (single-flight) e
 * "stale-if-error": se a renovação falhar, o último valor verificado continua servido por uma
 * janela curta, sempre com seu `fetchedAt` original (a procedência não é renovada por cache).
 *
 * Regra de confiança: o cache guarda o resultado normalizado inteiro, incluindo o status. Um
 * `ambiguous`/`not_found` em cache nunca vira `verified` por ter sido cacheado.
 */
interface Entry<T> {
  value: T;
  storedAt: number;
  ttlMs: number;
}

export interface CacheOptions {
  ttlMs: number;
  /** Quanto tempo após o vencimento um valor antigo ainda pode cobrir uma falha de renovação. */
  staleIfErrorMs?: number;
  /** Decide se o valor carregado deve ser cacheado (ex.: nunca cachear `unavailable`). */
  shouldStore?: (value: unknown) => boolean;
}

export class SciCache<T> {
  private readonly entries = new Map<string, Entry<T>>();
  private readonly inflight = new Map<string, Promise<T>>();
  private readonly maxEntries: number;

  constructor(maxEntries = 500) {
    this.maxEntries = maxEntries;
  }

  get size() {
    return this.entries.size;
  }

  clear() {
    this.entries.clear();
    this.inflight.clear();
  }

  /** Invalidação manual por chave (ex.: revogação de direitos, ver AC-CACHE-02). */
  invalidate(key: string) {
    this.entries.delete(key);
  }

  async getOrLoad(key: string, loader: () => Promise<T>, options: CacheOptions): Promise<T> {
    const now = Date.now();
    const hit = this.entries.get(key);
    if (hit && now - hit.storedAt < hit.ttlMs) {
      // Reinsere para manter a ordem LRU.
      this.entries.delete(key);
      this.entries.set(key, hit);
      return hit.value;
    }

    const pending = this.inflight.get(key);
    if (pending) return pending;

    const load = (async () => {
      try {
        const value = await loader();
        if (!options.shouldStore || options.shouldStore(value)) {
          this.store(key, value, options.ttlMs);
          return value;
        }
        // Resultado não armazenável (ex.: provedor indisponível): um valor verificado e ainda dentro
        // da janela de tolerância cobre a falha, mantendo o fetchedAt original.
        const grace = options.staleIfErrorMs ?? 0;
        if (hit && grace > 0 && Date.now() - hit.storedAt < hit.ttlMs + grace) return hit.value;
        return value;
      } catch (error) {
        const grace = options.staleIfErrorMs ?? 0;
        if (hit && grace > 0 && Date.now() - hit.storedAt < hit.ttlMs + grace) return hit.value;
        throw error;
      } finally {
        this.inflight.delete(key);
      }
    })();
    this.inflight.set(key, load);
    return load;
  }

  private store(key: string, value: T, ttlMs: number) {
    this.entries.delete(key);
    this.entries.set(key, { value, storedAt: Date.now(), ttlMs });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
}
