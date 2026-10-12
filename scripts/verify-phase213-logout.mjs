// Phase 2.1.3 — a session cookie captured BEFORE logout must not open the admin area AFTER logout.
import { createServerClient } from "@supabase/ssr";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync(".env.e2e.local", "utf8").split("\n").map((l) => l.trim()).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const app = process.env.APP_URL ?? "http://localhost:3100";
const jar = new Map();
const ssr = createServerClient(env.LOCAL_SUPABASE_URL, env.LOCAL_PUBLISHABLE_KEY, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (cs) => cs.forEach(({ name, value }) => jar.set(name, value)) } });
const login = await ssr.auth.signInWithPassword({ email: env.E2E_OWNER_EMAIL, password: env.E2E_OWNER_PASSWORD });
if (login.error) throw new Error(login.error.message);
const cookie = [...jar].map(([n, v]) => `${n}=${v}`).join("; ");
const get = (path) => fetch(`${app}${path}`, { redirect: "manual", headers: { cookie } });
const before = await get("/admin");
console.log(`${before.status === 200 ? "PASS" : "FAIL"}  antes do logout: /admin → ${before.status}`);
await ssr.auth.signOut();
const results = [];
for (const path of ["/admin", "/admin/posts/new", "/api/admin/media/00000000-0000-4000-8000-000000000000"]) {
  const r = await get(path);
  const blocked = r.status === 404 || (r.status >= 300 && r.status < 400 && /\/admin\/login/.test(r.headers.get("location") ?? ""));
  results.push(blocked);
  console.log(`${blocked ? "PASS" : "FAIL"}  após o logout (cookie antigo): ${path} → ${r.status}`);
}
process.exit(results.every(Boolean) && before.status === 200 ? 0 : 1);
