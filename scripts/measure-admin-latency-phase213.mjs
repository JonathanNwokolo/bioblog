// Phase 2.1.3 — server response time of CMS pages (lab, localhost production build, local Supabase).
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync(".env.e2e.local", "utf8").split("\n").map((l) => l.trim()).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const app = process.env.APP_URL ?? "http://localhost:3100";
const jar = new Map();
const ssr = createServerClient(env.LOCAL_SUPABASE_URL, env.LOCAL_PUBLISHABLE_KEY, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (cs) => cs.forEach(({ name, value }) => jar.set(name, value)) } });
await ssr.auth.signInWithPassword({ email: env.E2E_OWNER_EMAIL, password: env.E2E_OWNER_PASSWORD });
const cookie = [...jar].map(([n, v]) => `${n}=${v}`).join("; ");
const c = createClient(env.LOCAL_SUPABASE_URL, env.LOCAL_PUBLISHABLE_KEY);
await c.auth.signInWithPassword({ email: env.E2E_OWNER_EMAIL, password: env.E2E_OWNER_PASSWORD });
const post = (await c.from("posts").select("id").neq("status", "deleted").limit(1).single()).data;
const pages = ["/admin", "/admin/posts/new", `/admin/posts/${post.id}/edit`, `/admin/posts/${post.id}/preview`, "/", "/diario"];
const rows = [];
for (const path of pages) {
  const times = [];
  let bytes = 0;
  for (let i = 0; i < 8; i += 1) {
    const t = performance.now();
    const r = await fetch(`${app}${path}`, { headers: path.startsWith("/admin") ? { cookie } : {} });
    const body = await r.arrayBuffer();
    times.push(performance.now() - t); bytes = body.byteLength;
  }
  times.shift(); // warm-up
  times.sort((a, b) => a - b);
  rows.push({ path: path.replace(post.id, "<id>"), medianMs: Math.round(times[Math.floor(times.length / 2)]), maxMs: Math.round(times.at(-1)), htmlKB: +(bytes / 1024).toFixed(1) });
}
console.table(rows);
writeFileSync("docs/evidence/phase213/admin-latency.json", JSON.stringify({ at: new Date().toISOString(), note: "server response + body, 7 samples after warm-up, localhost production build, local Supabase (no WAN latency)", rows }, null, 2));
