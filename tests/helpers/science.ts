import { readFileSync } from "node:fs";
import { ProviderLimiter } from "../../src/lib/science/limiter.ts";
import { setLimiterForTests, setTransportForTests } from "../../src/lib/science/http.ts";

export function fixture(path: string): string {
  return readFileSync(new URL(`../fixtures/science/${path}`, import.meta.url), "utf8");
}

export function jsonResponse(body: string, init: ResponseInit = {}) {
  return new Response(body, { status: 200, headers: { "content-type": "application/json; charset=UTF-8" }, ...init });
}

export function xmlResponse(body: string, init: ResponseInit = {}) {
  return new Response(body, { status: 200, headers: { "content-type": "text/xml; charset=UTF-8" }, ...init });
}

export type Handler = (url: URL, init: RequestInit) => Response | Promise<Response>;

/** Instala transporte falso e limitadores rápidos; devolve as URLs requisitadas e um `restore`. */
export function installFakeProviders(handler: Handler) {
  const calls: URL[] = [];
  setTransportForTests(async (raw, init) => {
    const url = new URL(raw);
    calls.push(url);
    return handler(url, init);
  });
  for (const provider of ["ncbi-taxonomy", "gbif"] as const) {
    setLimiterForTests(provider, new ProviderLimiter({ provider, minIntervalMs: 0, maxConcurrent: 4, maxQueue: 50 }));
  }
  return {
    calls,
    restore() {
      setTransportForTests(null);
      setLimiterForTests("ncbi-taxonomy", null);
      setLimiterForTests("gbif", null);
    },
  };
}
