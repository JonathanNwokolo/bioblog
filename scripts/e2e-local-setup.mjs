// Phase 2.1.3 — provisions TEST accounts on the LOCAL Supabase stack only.
// Refuses any non-loopback URL. Writes generated credentials to .env.e2e.local (git-ignored via .env.*).
import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const FILE = ".env.e2e.local";
const supabase = (...args) => execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", ["--yes", "supabase@2.120.0", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32" });

const status = Object.fromEntries(
  supabase("status", "-o", "env").split(/\r?\n/).map((l) => l.match(/^([A-Z0-9_]+)="?(.*?)"?$/)).filter(Boolean).map((m) => [m[1], m[2]]),
);
const url = status.API_URL;
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url ?? "")) throw new Error("Somente Supabase local.");
const service = status.SERVICE_ROLE_KEY ?? status.SECRET_KEY;
const publishable = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
if (!service || !publishable) throw new Error("Chaves locais indisponíveis.");

const existing = existsSync(FILE) ? Object.fromEntries(readFileSync(FILE, "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])) : {};
const accounts = {
  OWNER: { email: "e2e-owner@microcosmos.test", password: existing.E2E_OWNER_PASSWORD ?? `Mc!${randomBytes(12).toString("base64url")}` },
  NONOWNER: { email: "e2e-nonowner@microcosmos.test", password: existing.E2E_NONOWNER_PASSWORD ?? `Mc!${randomBytes(12).toString("base64url")}` },
};

const headers = { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" };
const ids = {};
for (const [key, account] of Object.entries(accounts)) {
  const list = await (await fetch(`${url}/auth/v1/admin/users?per_page=200`, { headers })).json();
  const found = (list.users ?? []).find((u) => u.email === account.email);
  if (found) {
    const r = await fetch(`${url}/auth/v1/admin/users/${found.id}`, { method: "PUT", headers, body: JSON.stringify({ password: account.password, email_confirm: true }) });
    if (!r.ok) throw new Error(`update ${key}: ${r.status}`);
    ids[key] = found.id;
  } else {
    const r = await fetch(`${url}/auth/v1/admin/users`, { method: "POST", headers, body: JSON.stringify({ email: account.email, password: account.password, email_confirm: true }) });
    const body = await r.json();
    if (!r.ok) throw new Error(`create ${key}: ${r.status}`);
    ids[key] = body.id;
  }
}

const sqlFile = join(tmpdir(), `mc-e2e-${randomUUID()}.sql`);
writeFileSync(sqlFile, `with removed as (delete from public.owner_accounts where user_id = '${ids.NONOWNER}' returning 1)
insert into public.owner_accounts(user_id, active) values ('${ids.OWNER}', true) on conflict (user_id) do update set active = true;
`);
supabase("db", "query", "--local", "-f", sqlFile);
unlinkSync(sqlFile);

writeFileSync(FILE, [
  `LOCAL_SUPABASE_URL=${url}`,
  `LOCAL_PUBLISHABLE_KEY=${publishable}`,
  `E2E_OWNER_EMAIL=${accounts.OWNER.email}`,
  `E2E_OWNER_PASSWORD=${accounts.OWNER.password}`,
  `E2E_NONOWNER_EMAIL=${accounts.NONOWNER.email}`,
  `E2E_NONOWNER_PASSWORD=${accounts.NONOWNER.password}`,
  `E2E_OWNER_ID=${ids.OWNER}`,
  `E2E_NONOWNER_ID=${ids.NONOWNER}`,
  "",
].join("\n"));
console.log("OK: contas de teste locais prontas em .env.e2e.local (não versionado).");
