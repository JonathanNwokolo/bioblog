import { CALLER_BUDGET } from "./config.ts";
import { ProviderError, type ProviderId } from "./types.ts";

export interface LimiterOptions {
  provider: ProviderId;
  /** Intervalo mínimo entre inícios de requisição. */
  minIntervalMs: number;
  maxConcurrent: number;
  /** Fila máxima: acima disto rejeitamos rápido em vez de empilhar chamadas externas. */
  maxQueue: number;
}

/**
 * Limitador por provedor dentro do processo: espaça requisições e limita concorrência e fila.
 * Em ambientes serverless cada instância tem o seu; o teto por instância continua valendo e o
 * cache de dados reduz a repetição entre instâncias.
 */
export class ProviderLimiter {
  private readonly options: LimiterOptions;
  private active = 0;
  private lastStart = 0;
  private readonly queue: Array<() => void> = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: LimiterOptions) {
    this.options = options;
  }

  get queued() {
    return this.queue.length;
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.active -= 1;
      this.pump();
    }
  }

  private acquire(): Promise<void> {
    if (this.queue.length >= this.options.maxQueue) {
      return Promise.reject(new ProviderError(this.options.provider, "UPSTREAM_RATE_LIMITED"));
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
      this.pump();
    });
  }

  private pump() {
    if (this.active >= this.options.maxConcurrent || this.queue.length === 0) return;
    const now = Date.now();
    const wait = Math.max(0, this.lastStart + this.options.minIntervalMs - now);
    if (wait > 0) {
      if (!this.timer) {
        this.timer = setTimeout(() => {
          this.timer = null;
          this.pump();
        }, wait);
      }
      return;
    }
    const next = this.queue.shift();
    if (!next) return;
    this.active += 1;
    this.lastStart = Date.now();
    next();
    // Pode haver folga de concorrência para mais um, respeitando o intervalo.
    if (this.queue.length > 0) this.pump();
  }
}

/**
 * Orçamento por visitante para consultas que acionam provedores. Janela deslizante em memória,
 * chaveada por IP bruto ou "unknown"; o mapa é limitado para não crescer sem fim.
 */
export class CallerBudget {
  private readonly hits = new Map<string, number[]>();
  private readonly windowMs: number;
  private readonly max: number;
  private readonly maxKeys = 5000;

  constructor(windowMs: number = CALLER_BUDGET.windowMs, max: number = CALLER_BUDGET.max) {
    this.windowMs = windowMs;
    this.max = max;
  }

  /** `true` se a chamada está dentro do orçamento (e a registra). */
  consume(key: string, now: number = Date.now()): boolean {
    const bucket = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (bucket.length >= this.max) {
      this.hits.set(key, bucket);
      return false;
    }
    bucket.push(now);
    this.hits.set(key, bucket);
    if (this.hits.size > this.maxKeys) {
      for (const [k, v] of this.hits) {
        if (v.every((t) => now - t >= this.windowMs)) this.hits.delete(k);
        if (this.hits.size <= this.maxKeys * 0.8) break;
      }
      // Último recurso: descarta as chaves mais antigas.
      while (this.hits.size > this.maxKeys) {
        const oldest = this.hits.keys().next().value;
        if (oldest === undefined) break;
        this.hits.delete(oldest);
      }
    }
    return true;
  }
}

export const callerBudget = new CallerBudget();

export function providerOf(error: unknown): ProviderId | null {
  return error instanceof ProviderError ? error.provider : null;
}
