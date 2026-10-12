# Phase 2.1.2 — Remote Supabase verification

**Verdict: PARTIAL (stopped at the migration-apply step).** No credentials or secrets appear in this document.

Labels: VERIFIED REMOTE · VERIFIED LOCAL · NOT EXECUTED · BLOCKED.

## 1. Connector and project identity

| Item | Status |
| --- | --- |
| Supabase connector/plugin in this session | **BLOCKED** — none exposed (tool search, MCP registry and connector status show no Supabase server). |
| Alternative used | Official Supabase CLI 2.120.0 using the owner's existing local CLI login (Windows Credential Manager). Read access to the project via Management API (`db query --linked`, temporary login role, no DB password). |
| Project | `microcosmos`, ref `oetwoiuzoniwwtrdnohr`, region sa-east-1, status ACTIVE_HEALTHY, Postgres 17 — **VERIFIED REMOTE** |
| Organization | `NWK Culture` — **VERIFIED REMOTE** (`orgs list`). |
| Other project in the org | `nwk-culture-production` (ref `mrybqbwuebgjjhnojdle`). **Not touched.** |
| Plan = Free | **NOT EXECUTED** — CLI exposes no billing/plan field. Owner must confirm in the dashboard (Settings → Billing). No billing action was taken and no project was created. |

## 2. Pre-migration audit (read-only) — VERIFIED REMOTE

- Schemas: auth, extensions, graphql, graphql_public, pgbouncer, public, realtime, storage, vault.
- `public`: `audit_events`, `categories`, `media_assets`, `owner_accounts`, `post_revisions`, `posts`; RLS enabled on all six.
- Data: posts 0, media 0, owners 0, revisions 0, audit 0, storage objects 0, **auth users 0**, categories 4 (seed).
- Bucket `post-media`: private, 4 194 304 bytes, `image/webp` only.
- Policies, functions and grants match migration `20261010233000` exactly; the hardening migration was **not** applied (old `public_reads_*` policies; `anon` could still `SELECT` `posts.author_user_id`, `media_assets.owner_id`, `object_key`; `soft_delete_post` returned `void`; `is_active_owner` executable by `anon`).
- Migration history: `supabase_migrations.schema_migrations` **did not exist** → the baseline had been applied manually, outside the CLI workflow.
- Event trigger `ensure_rls` and function `rls_auto_enable` are Supabase platform provisioning (expected, safe; execute already revoked from API roles).
- Inventory snapshot of policies and function definitions: `docs/evidence/phase212/pre-migration-inventory.json`.

### Drift classification

| Difference | Class |
| --- | --- |
| No migration history table | Unexpected, non-destructive |
| Hardening migration absent (column exposure, anon policy errors, void soft-delete) | **Security critical** (fixed by the pending migration) |
| `anon`/`authenticated` hold TRUNCATE, TRIGGER, REFERENCES on public tables | Unexpected, non-destructive (new finding; fixed by the Phase 2.1.2 migration) |
| `rls_auto_enable`, platform event triggers | Expected and safe |

## 3. Recovery strategy

The database holds no user data; the only rows are 4 reproducible seed categories. Recovery = re-run migration 1 on a fresh database plus the pre-migration inventory above. No dump was taken (the Docker-based `db dump` needs the DB password, and nothing needs protecting). No point-in-time recovery is relied on. Irreversible operations in the pending SQL: `drop function soft_delete_post(uuid)` (recreated with a new return type; no dependents) and policy drops (recreated). No data is deleted.

## 4. Migration

| Step | Result |
| --- | --- |
| `supabase link` (writes git-ignored `supabase/.temp/project-ref`) | done |
| `migration repair --status applied 20261010233000` | **done — VERIFIED REMOTE**. Created the history table and recorded the baseline, after confirming the remote schema matches it. |
| `db push --dry-run` | Lists exactly `20261011010000_phase211_hardening.sql` and `20261011020000_phase212_least_privilege.sql`. |
| `db push` (real) | **BLOCKED** — the action was refused by the session's permission classifier. It was not retried by any other route. |

New forward migration `supabase/migrations/20261011020000_phase212_least_privilege.sql`: revokes TRUNCATE/TRIGGER/REFERENCES from `anon`/`authenticated` and EXECUTE on trigger functions. **Not yet tested against a local stack** (the local suite predates it); run `scripts/verify-phase211-local.mjs` locally once before or right after applying.

## 5. Owner provisioning — NOT EXECUTED

No Auth user exists remotely. Provisioning depends on the hardening migration being applied first. The weak local password must not be used remotely; the remote owner needs a random strong password generated at provisioning time, kept out of chat and Git.

## 6. Remote auth / RLS / Storage / publishing E2E / browser QA — NOT EXECUTED

All are blocked by sections 4–5. None of them is claimed.

## 7. Regression — VERIFIED LOCAL (2026-10-11)

| Check | Result |
| --- | --- |
| `npm test` | 43/43 pass |
| `npm run typecheck` | clean |
| `npm run build` | succeeds (prerender logs the expected `SupabaseConfigError` fallback when env is unset) |
| `npm audit --omit=dev` | 0 vulnerabilities |

## 8. Advisors (pre-migration) — VERIFIED REMOTE

Security: no findings. Performance: 7 INFO `unused_index` on an empty database (not defects). Post-migration advisors: **NOT EXECUTED**.

## 9. Observation to verify after migration

`owner_reads_posts` / `anon_reads_published_posts` give an *authenticated* non-owner no policy for published posts. If the public site queries with a logged-in session, published posts would be hidden for that session. Confirm which client the public pages use during the remote E2E; add an `authenticated` published-read policy if needed.

## 10. Exact next steps

1. Allow the remote push: run `npx supabase@2.120.0 db push --linked` in `bioblog` (project already linked), or approve the action in the session.
2. Provide `NEXT_PUBLIC_SUPABASE_URL=https://oetwoiuzoniwwtrdnohr.supabase.co` and the project's publishable key in a git-ignored `.env.local` (the key can be fetched with the CLI; no secret key is needed by the app).
3. Confirm the Free plan in the dashboard.
4. Then resume: owner provisioning → remote RLS/Storage probes → publishing E2E → browser QA → post-migration advisors.

---

## 11. Update — migrations applied (2026-10-11, owner approval for `db push --linked`)

**Verdict: PARTIAL.** Migrations applied and verified in the database; the Auth/Storage/app E2E is **not executed** (blocked, see 11.4).

### 11.1 Apply — VERIFIED REMOTE
- Pre-check: project `microcosmos` (`oetwoiuzoniwwtrdnohr`, org NWK Culture) linked; history = baseline only; 4 pending migrations matched the approved list; no data-destroying statements.
- `db push --linked`: applied `20261011010000`, `…020000`, `…030000`, `…040000` in order. `migration list --linked` shows all five local = remote.

### 11.2 Schema / grants / RLS / RPC audit — VERIFIED REMOTE
Evidence: `docs/evidence/phase212-remote/post-migration-audit.txt`.
- `author_user_id`, `owner_id`, `storage_bucket`, `bytes`, `sha256`: not SELECTable or UPDATEable by `anon` or `authenticated`.
- `anon`: SELECT only on `categories` (+ column SELECTs on posts/media_assets). `authenticated`: no TRUNCATE/TRIGGER/REFERENCES in `public`; `owner_accounts` SELECT only; no DELETE on posts/media_assets.
- RLS enabled on all six public tables; policies as designed (published-read for anon and authenticated, owner-only otherwise).
- RPCs `publish/unpublish/soft_delete/save_post_changes` and `is_active_owner`: EXECUTE for `authenticated` only, SECURITY INVOKER. Trigger functions: not executable by API roles. Only SECURITY DEFINER function: platform `rls_auto_enable` (not executable by API roles).
- Bucket `post-media`: private, 4 194 304 bytes, `image/webp`.
- Observation (not fixed, outside the authorised migrations): the platform-owned `storage.buckets`, `storage.buckets_analytics`, `storage.objects` still carry default TRUNCATE/TRIGGER/REFERENCES for `anon`/`authenticated`. They are not reachable through the Data/Storage API; revoking is a decision for the owner.

### 11.3 Authorization and isolation probes — VERIFIED REMOTE (SQL role simulation)
Script: `docs/evidence/phase212-remote/rls-rpc-probe-rolledback.sql`. Ran as `anon`, a non-owner `authenticated`, owner A and owner B with simulated JWT claims inside one transaction that is rolled back; afterwards the database holds 0 posts / media / users / owners / audit rows and 4 seed categories. **37/37 PASS**: column denial, draft invisibility, non-owner publish rejected, cross-owner edit/unpublish/delete → `post_not_found`, hard delete and slug rewrite denied, publish/edit/unpublish/republish/soft-delete lifecycle, published-invariants, in-use media protection, and public visibility toggling with state.
Limit: this is role simulation, not real PostgREST/Auth sessions; Storage upload policies were not exercised.

### 11.4 Not executed — BLOCKED
Reading the project's API keys (`supabase projects api-keys`) was refused by the session's permission classifier (credential materialisation) and was not circumvented. Consequently NOT EXECUTED: `.env.local`, owner provisioning (Auth user + `owner_accounts` row, strong password), Storage upload/RLS, the browser E2E (login → upload → draft → preview → publish → edit → unpublish → republish → delete), no-rebuild revalidation on home/diary/article, browser QA and the Free-plan confirmation.
To resume: allow retrieving the publishable key (and a one-off secret key for provisioning, kept outside the repo), or place `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local` yourself.

---

## 12. Update — dashboard configuration (2026-10-11, second session)

**Verdict: PARTIAL.** Configuration and plan confirmed; owner account, real Auth/Storage/E2E and browser QA remain **NOT EXECUTED**.

### 12.1 Identity, plan and add-ons — VERIFIED REMOTE (dashboard, owner's authenticated Chrome session)
- Page title confirms `microcosmos | NWK Culture`; project ref `oetwoiuzoniwwtrdnohr`. No other project was opened or changed.
- Organization `NWK Culture`: **Free Plan**, spend cap **enabled**, no invoices listed. Billing, payment methods and plan were not modified.
- Project add-ons (Dedicated IPv4, Point in time recovery, Custom domain): all **DISABLED**.

### 12.2 Public environment — DONE
- `.env.local` (Git-ignored via `.env.*`) now holds `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Only the publishable key was read; no secret/service_role key was retrieved. Values are not recorded here.

### 12.3 Auth state — VERIFIED REMOTE
- `auth.users` = 0, `public.owner_accounts` = 0 (read-only query). The dashboard's "10 users (estimated)" label is a stale statistic, not real rows.
- Auth settings: Email provider enabled, all social/phone providers disabled, anonymous sign-ins **off**, manual linking **off**, confirm-email **on**, **public sign-ups ON**.
  Public sign-ups cannot grant owner access (the `owner_accounts` allowlist gates every privileged path), but the owner should disable them once the owner user exists, because Dashboard-created users do not need sign-ups.

### 12.4 Not executed — why
- **Owner user creation** (`ynara.bioblog@gmail.com`): creating an account and typing a password into a login form are actions the agent is not permitted to perform even with owner authorization. Not circumvented.
- Consequently NOT EXECUTED: `owner_accounts` row, real login/session/refresh/logout, Server Action and Route Handler authorization with a real session, Storage upload tests, publishing E2E, non-owner API probes, browser QA at 1440/768/390.

### 12.5 Regression — VERIFIED LOCAL
`npm test` 48/48 pass · `npm run typecheck` clean · `npm audit --omit=dev` 0 vulnerabilities. (`npm run build` not re-run this session.)

### 12.6 Minimum owner steps to unblock
1. Dashboard → Authentication → Users → Add user → Create new user: email `ynara.bioblog@gmail.com`, a strong generated password, **Auto Confirm User** checked (no mail is sent). Keep the password in a password manager, not in the repo.
2. Tell the agent the user exists. The agent will then insert the single `owner_accounts` row via the SQL Editor/CLI (scoped to that UUID).
3. Sign in once yourself on `http://localhost:3000/admin` in the Playwright or built-in browser pane. The agent continues from that authenticated session (dashboard, editor, upload, publish, QA).
4. Optional hardening: Authentication → Sign In / Providers → turn off "Allow new users to sign up".

---

## 13. Update — owner provisioned, real E2E (2026-10-11, third session)

**Verdict: PASS WITH OPEN ITEMS** — see 13.8. No credential, token or password appears here.

### 13.1 Owner provisioning — VERIFIED REMOTE
- `auth.users` held exactly one user (`ynara.bioblog@gmail.com`, e-mail confirmed). Its UUID was inserted as the only `owner_accounts` row (`active = true`) through the audited CLI SQL path. No admin/secret key was requested or read.
- Counts after: 1 user, 1 active owner, 0 users without owner privilege.
- Rolled-back role probe re-run (`docs/evidence/phase212-remote/rls-rpc-probe-rolledback.sql`): all PASS, database unchanged afterwards.

### 13.2 Session and public sign-up — VERIFIED REMOTE
- The owner signed in herself in her own Chrome. Supabase recorded the sign-in and one session. The agent's embedded browser had no cookies, so the flows ran in Claude in Chrome on the owner's session: `/admin` rendered the publication list (gate requires an active owner).
- "Allow new users to sign up" turned **off** on project `microcosmos` (`oetwoiuzoniwwtrdnohr`, Free). Persisted after reload. Manual linking, anonymous sign-ins and Confirm email unchanged. A real `POST /auth/v1/signup` now returns **422** and `auth.users` stays at 1. The owner kept a working session afterwards (all later flows ran with it).

### 13.3 Real flows (owner session, UI + server actions) — VERIFIED REMOTE
| Flow | Result |
| --- | --- |
| Create draft | OK; draft invisible on `/`, `/diario`, article (404) |
| Upload: non-image with `image/png` name | **415** rejected by signature check |
| Upload: real PNG 1600×1000 | 201; stored as `image/webp` in private bucket `post-media` |
| Save draft, private preview | OK; `<b>` in body rendered as text, not HTML |
| Publish | `/`, `/diario`, article show it; media served via 5-min signed URL (307 → 200 `image/webp`) |
| Edit published post | Persisted; article, `/diario` and `/` reflect it |
| Unpublish | article 404, lists clean, public media 404 |
| Republish | back on all three |
| Delete (type `EXCLUIR`) | `status = deleted`, 404 everywhere, media 404 |
| Audit trail | create, media_upload, update, publish, update, unpublish, publish, delete |

### 13.4 Isolation and Storage with real HTTP — VERIFIED REMOTE
Anonymous publishable-key requests: published-only `posts` select returns `[]` when none; `author_user_id`, `owner_id`/`object_key`, `owner_accounts`, `audit_events`, `post_revisions` → 42501; insert into `posts`/`owner_accounts` → 42501; RPCs `publish_post`, `is_active_owner` → 401 permission denied; `categories` readable. Storage: public URL 400, authenticated endpoint 400, list `[]`, upload 400. App: `/admin` 307 → login, `/api/admin/media` 401 (no session) and 403 (cross-origin), draft media 404 for anonymous.
**Not executed:** a real session of an *authenticated non-owner*. It needs a second Auth user; creating one is not allowed for the agent and sign-ups are now off. That case remains covered only by the SQL role simulation (37/37).

### 13.5 Cache and no-rebuild — VERIFIED (production build, `next start`)
`/` and `/diario`: `s-maxage=300, stale-while-revalidate`, `x-nextjs-cache: HIT`; `/admin*`: `private, no-store`. With both pages warm in cache, publish made the post appear on `/`, `/diario` and its article immediately, unpublish removed it, with no rebuild. (Dev server always sends `no-store`, so only the production run counts.)

### 13.6 Responsive / accessibility QA — PARTIAL
Embedded browser emulation at 1440 / 768 / 390: home, `/diario` and the article have no horizontal overflow, 0 interactive targets under 24 px, one `h1`, `lang=pt-BR`, images with alt, the credit visible. Admin list and editor at the same widths (same-origin iframes): no overflow, all fields labelled, one `h1`; the editor has 1 control under 24 px high (not identified). Screenshots at 1440 and 768 timed out (pane hidden) so only 390 has an image; no `prefers-reduced-motion` or keyboard-focus pass was done this session, and contrast was not re-measured.

### 13.7 Regression — VERIFIED LOCAL
`npm test` 48/48 · `npm run typecheck` clean · `npm audit --omit=dev` 0 vulnerabilities · `npm run build` succeeds.

### 13.8 Open items
1. **Cleanup blocked.** Two soft-deleted test posts, 3 revisions, 2 `media_assets`, 2 objects in `post-media` and 14 `audit_events` remain (database had 0 of each before). Deleting them was denied by the session permission classifier and not circumvented. Owner must run the delete (rows via SQL; objects via the Storage API/dashboard, since direct `storage.objects` deletes are not the supported path).
2. A `next start` server may still be listening on :3000 (stop was also denied); stop it manually.
3. Authenticated non-owner real-session probe (13.4).
4. Remaining visual checks of 13.6, MFA TOTP, redirect URLs, platform-owned `storage.*` default grants (11.2).
5. `.claude/launch.json` was created for the preview server (untracked).
6. Tooling quirk: UI clicks through the browser extension intermittently did not submit forms (requests never reached the server); submissions were done with `form.requestSubmit()`. Not an app defect (validated by the successful server action calls).

---

## 14. Update — fechamento da Fase 2.1.2 e re-verificação (2026-10-11, quarta sessão)

**Veredito da Fase 2.1.2: PARTIAL.** Detalhes, evidências e comandos em `docs/phase213-cms-hardening-report.md`.

| Item | Estado |
| --- | --- |
| B1 · limpeza dos dados de teste remotos | **ABERTO** — manifesto exato (`docs/evidence/phase213/cleanup-manifest.json`), SQL protegido e verificação (`scripts/ops/`) prontos e testados localmente; exclusão permanente não é executada pelo agente. Contagens re-lidas (somente leitura): 2 posts, 3 revisões, 2 mídias, 2 objetos, 14 eventos de auditoria — inalteradas. |
| B2 · não-proprietário real | **LOCAL concluído** (61/61 com Auth, PostgREST, Storage e HTTP reais, incluindo replay de Server Actions com controle positivo). **REMOTO pendente**: exige um segundo usuário (ação do proprietário); script pronto (`scripts/verify-phase213-auth.mjs`, modo `TARGET=remote`). Sondas anônimas remotas re-executadas: 28/28. |
| B3 · QA de navegador | Concluído em Chrome real contra build de produção + Supabase local (1440/768/390/320, teclado, foco, contraste, movimento reduzido, alvos, formulários, erros): 169/169. Controle < 24 px identificado (campo de confirmação de exclusão) e corrigido. |
| B4 · processo local | `next start -p 3000` (PID 17896 + wrapper npx 24336) encerrado; porta 3000 livre. |
| Cadastro público | confirmado desligado (`/auth/v1/settings`: `disable_signup=true`). |
| Advisors remotos | 1 WARN (leaked password protection — recurso pago), 2 WARN desempenho (`multiple_permissive_policies`), 4 INFO `unused_index`; sem achados de segurança novos. |
| Migrações | 5 locais = 5 remotas; nenhuma migração nova nesta fase. |

