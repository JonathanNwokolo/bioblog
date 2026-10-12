# Fase 2.1.1 — Verificação local real, correções e bloqueios

Veredito: **PARTIAL**. Validação **local** (Supabase CLI + Docker, projeto isolado `microcosmos-local`) concluída com sucesso. Validação **remota** (projeto Supabase Free `microcosmos`) **não executada**; nenhuma alteração remota foi feita. Não é prontidão para produção.

## Ambiente local

| Item | Valor |
| --- | --- |
| Docker Engine | 29.0.1, `docker info` e `docker ps` OK; nenhum volume/contêiner de outros projetos foi tocado |
| Supabase CLI | `npx supabase@latest` 2.120.0 (sem instalação global) |
| Projeto local | `project_id = "microcosmos-local"` (volumes e contêineres próprios), Postgres 17 |
| Serviços | db, auth, rest, storage; `edge-runtime, logflare, vector, imgproxy, realtime, studio, mailpit, supavisor` desligados |
| Migrations | `20261010233000_phase2_private_cms.sql` + `20261011010000_phase211_hardening.sql` aplicadas |
| Signup local | `enable_signup = false` (`supabase/config.toml`), usuário criado pela Admin API local |
| Conta de teste | `ynara.bioblog@gmail.com`, registrada em `owner_accounts` — **somente local** |

Chaves do stack local (`supabase status`) são as chaves de demonstração do CLI e só valem para `127.0.0.1`. Nenhuma chave remota foi lida ou usada.

### Sobre a senha `1234567`
O Supabase local aceita (mínimo local = 6) e o usuário foi criado com ela. **A própria aplicação a rejeita**: `loginSchema` e `<input minLength={8}>` exigem 8+ caracteres. Não reduzi essa validação por causa de uma senha de desenvolvimento. Para o teste no navegador, a senha da conta local foi trocada (Admin API local) por um valor ≥ 8 caracteres. Em produção/remoto a conta deve usar senha forte e única, e o mínimo remoto de senha não foi alterado.

## Falhas confirmadas e corrigidas

Todas foram reproduzidas **antes** da correção contra o Postgres real (`docs/evidence/phase211/rls-baseline-before-fix.json`: 18/29) e verificadas **depois** (`rls-after-fix.json`: 49/49).

| # | Falha | Gravidade | Correção |
| --- | --- | --- | --- |
| 1 | Revalidação usava `slug` vindo do formulário (`formData`), podendo revalidar caminho arbitrário e deixar o real stale | Média | Slugs só de linhas persistidas (retorno das RPCs); `publicPathsForSlugs()` valida padrão, deduplica e revalida slug anterior + novo. Inputs `hidden slug` removidos |
| 2 | `anon` recebia `permission denied for table owner_accounts` ao ler posts/mídia/categorias em rascunho ou inativas (políticas chamavam `is_active_owner()`) — o Diário/artigo quebrava com qualquer rascunho existente | **Alta** | Políticas separadas por papel: `anon` sem função; `authenticated` com checagem de proprietário |
| 3 | `posts.author_user_id` e `media_assets.owner_id` legíveis por `anon` (vazamento real do UUID do proprietário via PostgREST) | Média | `revoke select` + `grant select (colunas públicas)` para `anon`; `select *` anônimo passa a falhar. Autenticado só lê as próprias linhas |
| 4 | `object_key` público e a listagem do bucket continham `<owner_uuid>/…` | Média | Chave `<uuid-aleatório>/<uuid-aleatório>.webp`; políticas de Storage usam `storage.objects.owner_id` |
| 5 | Post publicado podia ficar sem capa ou com capa privada → `toPublicPost` lançava e **derrubava todo o Diário** | **Alta** | RPC atômica `save_post_changes`, trigger `enforce_published_post_invariants`, trigger `protect_in_use_media`; projeção pública descarta registro incompleto em vez de lançar |
| 6 | `formatDate` esperava `YYYY-MM-DD`; timestamp do CMS gerava `RangeError: Invalid time value` e **HTTP 500 em `/` e no artigo após publicar** | **Alta** | `formatDate` aceita timestamp (fuso America/Sao_Paulo) e tolera valor inválido |
| 7 | `unpublish_post` convertia rascunho em `unpublished`; `soft_delete_post` não retornava slug | Baixa | Restrito a `status='published'`; ambos retornam a linha |
| 8 | Mutações confiavam só em `getClaims()` (JWT local, sem revogação) | Baixa | `requireEditor({ verify: true })` (`auth.getUser()`) em todas as mutações e no upload |
| 9 | Upload sem checagem de Origin nem `Content-Length` antes de parsear o corpo | Baixa | `isSameOrigin` (403) e limite de tamanho (413) |
| 10 | Auditoria `create`/`update`/`media_upload` nunca era gravada | Baixa | Gravada pelas ações/RPC (`audit_events` verificado: create, update×2, publish×2, unpublish, delete, media_upload) |
| 11 | Edição de post excluído e IDs sem validação de UUID | Baixa | `notFound` para `deleted`; `isUuid` em actions e rotas de mídia |

## Evidências

### Testes reais contra Postgres/Auth/Storage locais (`scripts/verify-phase211-local.mjs`, 49/49)
Autenticação real; upload real; rascunho invisível para anon (posts, mídia, URL assinada); publicação; projeção pública com embeds; negação de `owner_id`/`author_user_id`/`select *`; `owner_accounts`, `post_revisions`, `audit_events` negados; anon sem insert/upload/RPC; troca atômica de capa; recusa de publicado sem capa; despublicar revoga mídia; usuário autenticado não-proprietário e segundo proprietário não leem, editam, publicam, excluem nem apagam mídia alheia; categoria inativa não gera erro.

Executar: `SUPABASE_PUBLISHABLE_KEY=… SUPABASE_SECRET_KEY=… DEV_OWNER_PASSWORD=… node scripts/verify-phase211-local.mjs` (recusa URL que não seja `127.0.0.1`/`localhost`).

### Fluxo completo no navegador (Playwright, `next start` + Supabase local, **sem rebuild entre etapas**)
Login → novo rascunho → upload de PNG (convertido para WebP privado) → salvar → rascunho: `/diario/<slug>` 404, ausente de `/` e `/diario`, prévia sem sessão redireciona ao login, mídia 404 → publicar: artigo 200, aparece em `/` e `/diario`, imagem via URL assinada → editar título ao vivo: novo título em `/`, `/diario` e artigo → despublicar: 404 e remoção das listas, mídia 404 → republicar → excluir (`EXCLUIR`): 404 e `status=deleted`. Capturas 1440 e 390 em `docs/evidence/phase211/`.
Também: upload sem sessão 401, upload com `Origin` externo 403.

### Automatizado
- `npm test`: 43/43 (inclui `tests/cms-hardening.test.ts`: slug forjado, UUID, ausência de slug no formulário, `verify` em toda mutação, grants por coluna sem `owner_id`, anon sem `is_active_owner`, projeção incompleta, origem, data do CMS).
- `npm run typecheck`: sem erros. `npm run build`: sucesso. `npm audit --omit=dev`: 0 vulnerabilidades.

**Simulado vs. real:** os testes de `tests/` são estáticos/unitários (simulados); `verify-phase211-local.mjs` e o fluxo de navegador são reais, porém **locais**.

## Limitações e bloqueios restantes

1. **Nada foi validado no projeto remoto** (Auth, RLS, Storage, publicação reais). Não declarar PASS de produção.
2. Migration `20261011010000_phase211_hardening.sql` **não foi aplicada no remoto**; também não sei se a primeira foi.
3. Rate limiting de login depende dos limites do Supabase Auth; confirmar no remoto.
4. Listagem anônima de bucket expõe nomes de objetos publicados (agora aleatórios, sem UUID do proprietário); confirmar no remoto.
5. A edição direta via PostgREST por um proprietário ainda é possível; invariantes críticas estão em triggers, não só na aplicação.
6. Conector Supabase do Codex (item da rodada anterior) não foi investigado nesta retomada.
7. Cabeçalhos HTTP de segurança (CSP etc.), Lighthouse/DevTools e teclado/foco do admin não foram cobertos.

## Retomar testes autenticados no remoto
1. Dashboard: confirmar o projeto `microcosmos`, desligar *Enable signups*, mínimo de senha ≥ 12, criar o usuário da proprietária.
2. `npx supabase login` → `npx supabase link --project-ref <ref>` → `npx supabase db push` (revisar com `--dry-run`). Inserir o `user_id` em `owner_accounts` pelo SQL Editor.
3. `.env.local` com `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` remotos (nunca a secret key no app).
4. Repetir `scripts/verify-phase211-local.mjs` apontando para a URL remota após relaxar a trava de `127.0.0.1` **de forma deliberada** (usa dados de teste e limpa-os por exclusão lógica), mais o fluxo de navegador acima.
5. Confirmar: select anônimo de `owner_id` negado, listagem do bucket, URL assinada de rascunho negada, `Cache-Control` das rotas de mídia e revalidação em produção.
