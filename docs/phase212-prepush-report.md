# Phase 2.1.2 — Relatório pré-push (validação de segurança local)

Data: 2026-10-11. **Nenhuma alteração foi feita no Supabase remoto, nenhum commit, push Git ou deploy.**
Nenhum segredo aparece neste documento (chaves locais foram passadas por variável de ambiente e nunca impressas).

**Veredito: PRONTO PARA APROVAÇÃO — 4 migrations pendentes, todas verificadas localmente. Remoto NÃO alterado.**
Decisão R1 da proprietária (opção c com correção obrigatória) **implementada e testada** em uma migration forward nova (`20261011040000`, §10). Falta apenas a sua autorização para `db push --linked`.

Rótulos: VERIFIED LOCAL · NOT EXECUTED · VERIFIED REMOTE (somente leitura).

## 1. Ambiente local

| Item | Resultado |
| --- | --- |
| Docker Desktop | Estava parado; iniciei o aplicativo. O stack `microcosmos-local` reiniciou sozinho (restart policy). VERIFIED LOCAL |
| Containers | `supabase_{db,auth,rest,storage,kong,pg_meta}_microcosmos-local` — todos `healthy`. |
| Outros projetos | Volumes `*_nwk-culture`, `myassist-*`, `alpf_*` existem e **não foram tocados** (não estão em execução; sem reset, sem `db reset`, sem `supabase stop`). |
| Histórico local antes | `20261010233000`, `20261011010000` aplicadas; `20261011020000` pendente. |
| Como apliquei | `supabase migration up --local` (aplica só as pendentes, na ordem). Sem reset, sem recriação de ambiente. |
| Histórico local depois | As 4 migrations aplicadas em ordem. |

## 2. Migrations pendentes no remoto (`db push --dry-run`, somente leitura)

| # | Arquivo | Situação |
| --- | --- | --- |
| 1 | `20261011010000_phase211_hardening.sql` | já existia; aplicada e testada localmente na 2.1.1 |
| 2 | `20261011020000_phase212_least_privilege.sql` | existia; **testada agora** |
| 3 | `20261011030000_phase212_authenticated_public_reads.sql` | criada na rodada anterior (corrige falha real, §4); aplicada e testada localmente |
| 4 | `20261011040000_phase212_minimal_read_contract.sql` | **NOVA (decisão R1, §10)**: contrato mínimo de leitura e RPCs sem `select *` |

(A tabela reflete o `--dry-run` da rodada anterior; esta rodada não consultou o remoto.)

Ordem preservada (timestamps crescentes). O baseline `20261010233000` já consta no histórico remoto; as quatro acima são as únicas a enviar.
**Estratégia (item 7):** forward migration, não edição. As migrations 1–3 já foram aplicadas no banco local e a 4 as supõe aplicadas; editar arquivos já aplicados faria o histórico local divergir do conteúdo dos arquivos e exigiria `db reset`. Como o remoto ainda não recebeu 1–4, enviá-las em ordem produz exatamente o estado testado localmente. A policy criada na 3 (`authenticated_reads_published_*`) é mantida de propósito: a 4 muda *privilégios de coluna* e RPCs, não o escopo de linhas. Num único `db push` as quatro rodam em sequência; o remoto não tem usuários nem posts (§6), então não há janela exposta.

## 3. Privilégios — consultas reais (`docs/evidence/phase212-prepush/`)

Antes (`privileges-before.txt`): 27 concessões indevidas de TRUNCATE/TRIGGER/REFERENCES a `anon`/`authenticated` em tabelas de `public`.

Depois da migration 2 (`privileges-after.txt`): **0** de TRUNCATE/TRIGGER/REFERENCES em `public` e `storage`.
A consulta também revelou outro excesso, não pedido explicitamente: `anon` mantinha INSERT/UPDATE/DELETE em `categories`, `posts`, `media_assets`; `authenticated` mantinha UPDATE/DELETE em `owner_accounts`, `audit_events`, `post_revisions`. A RLS já bloqueava (provado no probe), mas removi pela migration 3.

Estado final (`privileges-after-fix.txt`):

| Papel | Tabela | Privilégios |
| --- | --- | --- |
| anon | categories | SELECT |
| anon | posts / media_assets | SELECT somente nas colunas públicas (sem `author_user_id`, `owner_id`, `bytes`, `sha256`) |
| authenticated | owner_accounts | SELECT |
| authenticated | audit_events, post_revisions | SELECT, INSERT (append-only) |
| authenticated | posts, media_assets | SELECT, INSERT, UPDATE |
| authenticated | categories | SELECT, INSERT, UPDATE, DELETE |

Tentativas reais com `SET ROLE` (`role-probes.sql` / `role-probes-output.txt`) — todas negadas: TRUNCATE em `posts`, `media_assets`, `owner_accounts`, `storage.objects` (anon e authenticated); CREATE TRIGGER; FK; execução de `is_active_owner` por anon e `record_post_revision` por authenticated; UPDATE por anon; UPDATE em `owner_accounts` e DELETE em `audit_events` por authenticated.

## 4. Falha encontrada e corrigida — autenticado sem papel de proprietário

Probe: `scripts/verify-phase212-prepush.mjs` (cria dono e estranho descartáveis `@example.test`, executa Auth/RLS/Storage/RPC reais, remove tudo que criou).

**Antes da migration 3** (`probe-before-fix.json`): 40/45. **5 falhas reais**:
- não-proprietário autenticado não lia post publicado (nem a lista);
- não lia metadados de mídia publicada;
- não assinava URL de objeto publicado;
- um post recém-publicado continuava invisível para ele.

Causa: a migration 1 separou as policies antigas em `anon_*` (publicado) e `owner_*` (dono) e deixou o papel `authenticated` sem policy de leitura pública. Observação já registrada em `phase212-remote-verification.md` §9.

Impacto no app hoje: **baixo** — o site público usa `createClient` sem sessão (`src/lib/cms/repository.ts`, `src/app/api/media/[id]/route.ts`), portanto sempre `anon`. Era uma inconsistência latente (qualquer sessão logada sem papel de dono, ou uma futura página pública que use o cliente com cookies, veria o diário vazio).

**Depois da migration 3** (`probe-after-fix.json`): **45/45**. Para o autenticado não-proprietário:
- lê somente posts publicados (com categoria e hero); não lê rascunho, despublicado, nem excluído;
- lê metadados e assina URL somente de mídia publicada; mídia de rascunho, de post despublicado e órfã permanecem negadas (assinatura e download);
- `owner_accounts`, `post_revisions`, `audit_events`: 0 linhas; categorias inativas ocultas;
- não insere/atualiza/apaga posts, mídia ou categorias; não se promove a dono; não grava auditoria; não executa nenhuma RPC; não envia nem apaga objetos;
- `anon` e dono: comportamento da 2.1.1 preservado; despublicar volta a esconder do não-proprietário.

## 5. Regressão

| Verificação | Resultado |
| --- | --- |
| Suíte real 2.1.1 (`verify-phase211-local.mjs`), proprietário descartável | **50/50** (`suite-phase211-after-migrations.json`) |
| `npm test` | 43/43 |
| `npm run typecheck` | limpo |
| `npm run build` | sucesso |
| `npm audit --omit=dev` | 0 vulnerabilidades |
| `supabase db lint --local` | sem erros de schema |

A suíte 2.1.1 teve **3 asserções ajustadas** (não relaxadas): elas afirmavam que um autenticado não lê um post *publicado* alheio — premissa que a nova policy muda por desenho. Agora testam rascunho alheio (continua negado) e acrescentam "lê publicado".
Dados descartáveis foram removidos (posts, mídias, objetos via Storage API, usuários). Contagens locais voltaram ao baseline: posts=5, media=9, objects=9, users=1. A senha da conta local da dona não foi lida nem alterada.

## 6. Revisão das migrations pendentes — operações destrutivas

| Migration | Operações potencialmente destrutivas | Avaliação |
| --- | --- | --- |
| 1 hardening | `DROP POLICY IF EXISTS` (3 em tabelas, 4 em `storage.objects`), recriadas na mesma migration; `DROP TRIGGER IF EXISTS` (dois triggers próprios, recriados); `DROP FUNCTION soft_delete_post(uuid)` e recriação com novo tipo de retorno; `REVOKE SELECT` de `anon` com `GRANT` por colunas | Esperadas. Nenhum `DELETE`, `TRUNCATE`, `DROP TABLE/COLUMN`, `ALTER ... TYPE`. Sem dependentes da função. Janela entre drop e create é uma única migration. |
| 2 least_privilege | Somente `REVOKE` (TRUNCATE/TRIGGER/REFERENCES; EXECUTE em 3 funções-gatilho) | Não toca dados. Gatilhos não checam EXECUTE ao disparar (provado: criação/edição/publicação passam). |
| 3 authenticated_public_reads | 3 `CREATE POLICY` de leitura; `REVOKE` de INSERT/UPDATE/DELETE | Não toca dados. Nenhum REVOKE atinge privilégio usado pelo app (verificado: nenhum `.delete()` em `src/`; suíte completa passa). |

Remoto (somente leitura, antes): posts 0, media 0, auth users 0, objetos 0, 4 categorias seed. Nenhuma linha pode ser perdida.

## 7. Causa da negação do `db push` (item 8) — sem contorno

- O CLI **não** falhou: `db push --linked --dry-run` roda, autentica e lista as migrations (exit 0). Não há erro de rede, credencial, grant ou RLS no caminho.
- A recusa registrada em `phase212-remote-verification.md` veio do **classificador de permissão da sessão do Claude Code** (a camada que decide se uma ferramenta pode agir), não do Supabase. Uma gravação em banco remoto sem autorização explícita sua no chat é exatamente o que ele barra. Não há regra `deny` em `.claude/settings*.json` nem em `~/.claude/settings.json`.
- Observação (não é a causa comprovada): sua allowlist global tem `Bash(npx supabase *)`, mas o comando usado foi `npx supabase@2.120.0 …`, que não casa com esse padrão — portanto cairia em pedido de confirmação de qualquer forma. A mensagem exata do classificador não está disponível nesta sessão; esta é inferência a partir do comportamento e da configuração.
- Resolução correta: sua aprovação explícita (§9). Não tentei outra rota, outro cliente nem outra credencial.

O `--dry-run` abre uma conexão remota somente leitura e cria o *login role* temporário do CLI (o mesmo mecanismo da verificação anterior). Nenhum objeto do schema ou dado foi alterado.

## 8. Riscos remanescentes

| # | Risco | Severidade | Situação |
| --- | --- | --- | --- |
| ~~R1~~ | **RESOLVIDO em §10 (migration 4).** Texto original: com a policy nova, uma sessão autenticada (qualquer papel) lê, **de linhas publicadas**, `posts.author_user_id` e `media_assets.owner_id/bytes/sha256`: o papel `authenticated` tem SELECT de tabela inteira e as RPCs `security invoker` usam `select *`/`returning *`, então não dá para cortar colunas só para ele sem reescrever as RPCs. O `anon` (site público) continua sem essas colunas. | Baixa (UUID do usuário-autor, hash e tamanho de imagem já publicada; sem login aberto de terceiros se o signup remoto estiver desligado) | **Decisão sua.** Alternativas: (a) aceitar; (b) reverter a migration 3 §1 e manter a regra "o site público sempre usa `anon`" (zero exposição extra, mas autenticado não-dono vê diário vazio); (c) tarefa futura: reescrever RPCs com colunas explícitas e restringir colunas do `authenticated`. |
| R2 | Privilégios padrão do Supabase continuam concedendo ALL a `anon`/`authenticated` em tabelas **futuras** em `public`; a revogação vale só para as existentes. Toda nova tabela exige REVOKE/GRANT explícitos e RLS. | Média, processual | Não alterei default privileges (efeito fora do escopo e na plataforma). Recomendo `ALTER DEFAULT PRIVILEGES` numa fase própria. |
| R3 | Signup/confirm de e-mail do Auth **remoto** não foi verificado nesta rodada (o banco remoto tem 0 usuários). | Média | NOT EXECUTED — conferir no dashboard antes de provisionar a dona. |
| R4 | Plano Free não confirmado (CLI não expõe). | Informativo | Conferir em Settings → Billing. Nada pago foi ativado. |
| R5 | Remoto não testado de ponta a ponta (Auth/RLS/Storage/publicação) — depende do push e do provisionamento. | — | NOT EXECUTED; só após sua aprovação. |
| R6 | QA de navegador (Playwright/DevTools) do admin e do site contra o stack local **não foi refeito**. Nenhum código de interface mudou; as rotas públicas e de mídia foram cobertas por probes de API reais, e o build passa. | Baixa | NOT EXECUTED. |
| R7 | Resíduos locais da 2.1.1 (5 posts de teste na base local) permanecem; não toquei. | Informativo | — |

## 9. Aprovação solicitada

Para aplicar no remoto você precisa autorizar, **explicitamente**, algo como:

> Aprovo `db push --linked` no projeto `oetwoiuzoniwwtrdnohr` para as 4 migrations listadas em §2, na ordem.

R1 já foi decidido (opção c) e implementado em §10; a autorização cobre **4** migrations, não 3.
Depois do push, executarei: histórico de migrations, as mesmas consultas de privilégio e os probes do §4 contra o remoto (com usuário descartável apenas se você autorizar criar usuários no remoto), advisors e então o provisionamento da dona.

## 10. Decisão R1 — contrato mínimo de leitura (migration `20261011040000`)

Decisão da proprietária: `anon` **e** `authenticated` leem conteúdo publicado; nenhum papel de API obtém `author_user_id`, `owner_id`, `sha256` (nem `bytes`/`storage_bucket`); rascunhos, despublicados, revisões, auditoria e mídia privada continuam protegidos; a proprietária mantém o acesso administrativo.

Evidência em `docs/evidence/phase212-r1/`. Tudo **VERIFIED LOCAL**; remoto não tocado.

### 10.1 Auditoria das dependências reais de colunas internas

| Local | Dependência encontrada | Tratamento |
| --- | --- | --- |
| `publish_post`, `unpublish_post`, `soft_delete_post`, `save_post_changes` | `select * into`, `returning *`, retorno `public.posts`, `where author_user_id = auth.uid()`, `owner_id = auth.uid()` | Recriadas (ainda `SECURITY INVOKER`): colunas explícitas; propriedade garantida por `is_active_owner()` + policies de dono; retorno mínimo `public.post_lifecycle_result {id, slug, status, published_at, updated_at}` |
| `save_post_changes` (checagem de capa do dono) | `owner_id = auth.uid()` | `UPDATE` no-op filtrado pela policy `owner_updates_media`: só casa com mídia do chamador, sem ler `owner_id` |
| `GET /api/admin/media/[id]` | `.eq("owner_id", editor.id)` | Filtro removido; escopo pela RLS (`owner_reads_media`). Única mudança em `src/` |
| `createPostAction`, `POST /api/admin/media` | gravam `author_user_id`, `owner_id`, `bytes`, `sha256` | Só INSERT (privilégio mantido); `.select("id")` não os retorna |
| Triggers (`record_post_revision`, invariantes, `protect_in_use_media`) | `old.*`/`new.*` e colunas já públicas | Sem mudança |
| Policies de `storage.objects` | `media_assets.object_key/state/deleted_at` | Colunas permanecem no contrato |
| Leitura pública (`repository.ts`, `/api/media/[id]`) e telas do admin | já usavam colunas explícitas | Sem mudança |

`posts.author_user_id` e `media_assets.owner_id/bytes/sha256/storage_bucket` **não têm nenhum consumidor de leitura** no app; por isso puderam sair de todo papel de API sem perda funcional.

### 10.2 Por que não views nem `SECURITY DEFINER`

A proprietária e um usuário comum são o **mesmo papel de banco** (`authenticated`): privilégios de coluna não distinguem os dois. Alternativas avaliadas: views `security_definer` ou funções `SECURITY DEFINER` para a leitura pública (geram achados nos advisors do Supabase e criam um caminho que ignora RLS) ou um schema fora da API (exige alterar a configuração do projeto remoto). A solução adotada não introduz nenhum objeto `SECURITY DEFINER`; usa apenas privilégio por coluna + RLS. Verificação: `SECDEF_FN|0`, `SECDEF_VIEW|0` (`contract-audit-output.txt`).

### 10.3 Contrato final de leitura (idêntico para `anon` e `authenticated`)

| Tabela | Colunas legíveis | Nunca legíveis por papel de API |
| --- | --- | --- |
| `posts` | id, slug, title, excerpt, body_json, category_id, hero_media_id, status, first_published_at, published_at, created_at, updated_at, deleted_at | author_user_id |
| `media_assets` | id, object_key, state, mime_type, width, height, alt_text, credit, created_at, deleted_at | owner_id, storage_bucket, bytes, sha256 |

Linhas: publicadas para todos; o resto, só para a proprietária ativa (policies inalteradas). `select=*` nessas duas tabelas retorna `permission denied` para todos (inclusive a proprietária); o app já usa listas explícitas.

Observação: `object_key` permanece legível. É necessário às policies de `storage.objects` (avaliadas com os direitos do chamador) e para assinar a URL no servidor; já era público para `anon` desde a 2.1.1, só aparece para mídia publicada (a proprietária vê as próprias) e não embute o id do proprietário.

### 10.4 Caminhos alternativos revisados

- **Escrita:** `UPDATE` agora é por coluna. `authenticated` só atualiza `posts(title, excerpt, body_json, category_id, hero_media_id, status, first_published_at, published_at, updated_at, deleted_at)` e `media_assets(state, deleted_at, alt_text, credit)`. `slug`, `created_at`, `object_key`, `owner_id`, `author_user_id`, `sha256`, `bytes` não são regraváveis pela API, nem pela proprietária (testado: `permission denied`).
- **Oráculo por filtro/embed:** `eq(owner_id)`, `eq(author_user_id)`, embed `media:media_assets(owner_id)` e `select=*` negados (anon, autenticado comum e proprietária).
- **`is_active_owner(candidate)`:** executável por `authenticated`; pela RLS de `owner_accounts` só enxerga a própria linha, logo `is_active_owner(<id da dona>)` chamado por outro usuário retorna `false` (sem oráculo; testado). `anon`: sem EXECUTE.
- **RPCs:** `REVOKE ... FROM public, anon` + `GRANT` a `authenticated` repetidos nas funções recriadas (os default privileges do Supabase reconcedem EXECUTE a funções novas). Funções de gatilho: sem EXECUTE para API.
- **`SECURITY DEFINER`:** nenhuma função/visão em `public`.
- **Segundo proprietário ativo:** não executa publish/unpublish/delete/save sobre post de outro (`post_not_found`), não usa mídia alheia (publicada ou privada) como capa (`media_not_found`) e não baixa objeto privado alheio.
- **Storage:** `anon` e autenticado comum não enviam, apagam nem sobrescrevem objetos; só leem/assinam os publicados.
- **Autoverificação:** bloco `DO` no fim da migration falha e reverte tudo se alguma coluna interna ainda for `SELECT`-ável por `anon` ou `authenticated`.

### 10.5 Testes reais locais (Auth, RLS, Storage e RPC reais; usuários `@example.test` descartáveis)

| Suíte | Papéis | Resultado | Arquivo |
| --- | --- | --- | --- |
| `scripts/verify-phase212-r1.mjs` (nova) | anon, proprietário, autenticado não-proprietário, 2º proprietário | **150/150** | `probe-r1.json` |
| `scripts/verify-phase212-prepush.mjs` (regressão, sem alteração) | anon, proprietário, não-proprietário | **45/45** | `probe-prepush-regression.json` |
| `scripts/verify-phase211-local.mjs` (regressão 2.1.1, proprietário descartável) | anon, proprietário, não-proprietário | **50/50** | `suite-phase211-regression.json` |

A suíte nova verifica, por papel: colunas retornadas exatamente iguais ao contrato; cada coluna interna, `select=*`, embed e filtro negados com `permission denied`; lista só com publicados; rascunho, despublicado e mídia de rascunho/despublicado/órfã negados (linha, assinatura e download); tabelas administrativas vazias; INSERT/UPDATE/DELETE, promoção a dono, auditoria, RPCs, upload/remoção/sobrescrita de objeto negados; ciclo completo da proprietária (criar, editar, publicar, trocar capa, exigir capa, despublicar, excluir; formato do retorno das RPCs; mídia privada, revisões, auditoria).

Uma asserção da suíte 2.1.1 foi ajustada (não relaxada): "não-proprietário não lê `author_user_id` de rascunho" esperava resultado vazio; agora o motor responde `permission denied`, negação mais forte. A asserção aceita `permission denied` ou vazio.

### 10.6 Regressão e qualidade

| Verificação | Resultado |
| --- | --- |
| `npm test` | **48/48** (43 anteriores + 5 de contrato R1 em `tests/cms-hardening.test.ts`) |
| `npm run typecheck` | limpo |
| `npm run build` | sucesso |
| `npm audit --omit=dev` | 0 vulnerabilidades |
| `supabase db lint --local` | sem erros de schema |
| Auditoria de privilégios (`contract-audit.sql`) | `UNWANTED_COUNT 0`; `SECDEF_FN 0`; `SECDEF_VIEW 0`; RLS ativa nas 6 tabelas |

Estado local após os testes: posts=5, media=9, objects=9, users=1 (baseline). Oito objetos órfãos deixados pela minha execução intermediária da suíte 2.1.1 foram removidos pela Storage API; nada além do que esta rodada criou foi tocado. Sem reset, sem `supabase stop`; outros projetos Docker intactos.

### 10.7 Revisão destrutiva da migration 4

`DROP FUNCTION` das 4 RPCs (recriadas na mesma migration; tipo de retorno mudou; sem dependentes), `CREATE TYPE`, `REVOKE SELECT/UPDATE` de tabela inteira de `authenticated` com `GRANT` por coluna. Nenhum `DELETE`, `TRUNCATE`, `DROP TABLE/COLUMN`, `ALTER ... TYPE`; nenhuma linha lida ou alterada.

### 10.8 Mudança de contrato para o código do app

As RPCs retornam `{id, slug, status, published_at, updated_at}` em vez da linha inteira de `posts`. O app só usa `slug` e `status` (`rowSlug(data)`, `data.status`), então `actions.ts` não mudou. Código novo que precise de outros campos deve consultar as colunas do contrato.

### 10.9 Riscos remanescentes (após R1)

- **R2–R6:** inalterados (§8). R6: QA de navegador não foi refeito; a única mudança em `src/` é a remoção de um filtro em rota de API, coberta por probe de API e por build.
- **R8 (novo, informativo):** `storage.objects` mantém, por padrão do Supabase, privilégios DML para `anon`/`authenticated`; a proteção é só RLS (sem policy de INSERT/UPDATE/DELETE para `anon`; provado negado). O schema `storage` é gerenciado pela plataforma e não foi alterado.
- **R9 (novo, informativo):** nomes de colunas continuam visíveis no OpenAPI do PostgREST (metadados apenas; dados não vazam).
- **Nada foi aplicado no remoto.** Sem `db push`, sem commit, sem push Git, sem deploy, sem serviços pagos.

### 10.10 Diff exato das migrations pendentes

As quatro são arquivos novos em relação ao Git (diff contra vazio), preservados em:

- `docs/evidence/phase212-r1/diff-20261011010000_phase211_hardening.diff`
- `docs/evidence/phase212-r1/diff-20261011020000_phase212_least_privilege.diff`
- `docs/evidence/phase212-r1/diff-20261011030000_phase212_authenticated_public_reads.diff`
- `docs/evidence/phase212-r1/diff-20261011040000_phase212_minimal_read_contract.diff`
- `docs/evidence/phase212-r1/migrations.sha256`

Migrations 1–3 **não foram modificadas** nesta rodada. Conteúdo exato da migration nova (`20261011040000_phase212_minimal_read_contract.sql`, SHA-256 `5965a3b29a460da88657ad1371e11623f83aa312bdf3d87ca859b4458e93dcef`):

```sql
-- MICROCosmos Phase 2.1.2 (owner decision R1): minimal public read contract.
-- See docs/phase212-prepush-report.md.
--
-- Problem: migration 20261011030000 let `authenticated` read published rows, but the role kept
-- table-wide SELECT, so any logged-in user could read posts.author_user_id and
-- media_assets.owner_id / bytes / sha256. The owner is the same database role (`authenticated`)
-- as every other logged-in user, so the only way to hide those columns from ordinary users
-- without SECURITY DEFINER is to take them away from the role completely and make sure no
-- code path needs them.
--
-- Contract after this migration (identical for anon and authenticated):
--   posts         SELECT: id, slug, title, excerpt, body_json, category_id, hero_media_id,
--                         status, first_published_at, published_at, created_at, updated_at, deleted_at
--   media_assets  SELECT: id, object_key, state, mime_type, width, height, alt_text, credit,
--                         created_at, deleted_at
--   Never selectable by an API role: posts.author_user_id; media_assets.owner_id,
--   storage_bucket, bytes, sha256. They stay writable on INSERT (the server sets them) and are
--   still enforced by RLS policies, which are evaluated by the engine and do not require the
--   caller to hold SELECT on the column.
--   Row scope is unchanged: published rows for everybody, everything else only for the active owner.
--
-- Consequences handled here:
--   * `select *` / `returning *` / `where author_user_id = ...` in the lifecycle RPCs would now
--     fail with "permission denied". They are rewritten (still SECURITY INVOKER) to use explicit
--     columns, to rely on RLS for ownership, and to return a minimal composite type instead of
--     the whole `public.posts` row.
--   * UPDATE is restricted to the columns the CMS legitimately edits, so identity/integrity
--     columns (slug, object_key, sha256, owner_id, author_user_id, ...) cannot be rewritten
--     through the API.
--
-- No data is read, changed or deleted. No SECURITY DEFINER object is introduced.

-- ------------------------------------------------------------ 1. column privileges
revoke select on public.posts, public.media_assets from authenticated;

grant select (id, slug, title, excerpt, body_json, category_id, hero_media_id, status,
              first_published_at, published_at, created_at, updated_at, deleted_at)
  on public.posts to authenticated;
grant select (id, object_key, state, mime_type, width, height, alt_text, credit, created_at, deleted_at)
  on public.media_assets to authenticated;

revoke update on public.posts, public.media_assets from authenticated;
grant update (title, excerpt, body_json, category_id, hero_media_id, status,
              first_published_at, published_at, updated_at, deleted_at)
  on public.posts to authenticated;
grant update (state, deleted_at, alt_text, credit) on public.media_assets to authenticated;

-- ------------------------------------------------------------ 2. lifecycle RPCs
create type public.post_lifecycle_result as (
  id uuid,
  slug text,
  status public.post_status,
  published_at timestamptz,
  updated_at timestamptz
);

drop function if exists public.publish_post(uuid);
drop function if exists public.unpublish_post(uuid);
drop function if exists public.soft_delete_post(uuid);
drop function if exists public.save_post_changes(uuid, text, text, jsonb, uuid, uuid);

-- Ownership is enforced twice: is_active_owner() up front, and the owner-only UPDATE/SELECT
-- policies on posts/media_assets (author_user_id / owner_id = auth.uid()). A row that does not
-- belong to the caller is invisible and not updatable, so it surfaces as post_not_found.
create function public.publish_post(target_post_id uuid)
returns public.post_lifecycle_result
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_hero uuid;
  v_body jsonb;
  v_id uuid;
  v_slug text;
  v_status public.post_status;
  v_published timestamptz;
  v_updated timestamptz;
begin
  if not public.is_active_owner() then raise exception 'not_authorized' using errcode = '42501'; end if;

  select p.hero_media_id, p.body_json into v_hero, v_body
  from public.posts p
  where p.id = target_post_id and p.deleted_at is null
  for update;
  if not found then raise exception 'post_not_found' using errcode = 'P0002'; end if;
  if v_hero is null then raise exception 'hero_media_required' using errcode = '23514'; end if;
  if jsonb_array_length(v_body) = 0 then raise exception 'body_required' using errcode = '23514'; end if;

  update public.media_assets m set state = 'published', deleted_at = null
  where m.id = v_hero and m.deleted_at is null;
  if not found then raise exception 'media_not_found' using errcode = '23514'; end if;

  update public.posts p set
    status = 'published',
    first_published_at = coalesce(p.first_published_at, now()),
    published_at = coalesce(p.first_published_at, now()),
    deleted_at = null,
    updated_at = now()
  where p.id = target_post_id
  returning p.id, p.slug, p.status, p.published_at, p.updated_at
  into v_id, v_slug, v_status, v_published, v_updated;
  if v_id is null then raise exception 'post_not_found' using errcode = 'P0002'; end if;

  insert into public.audit_events(actor_user_id, action, entity_type, entity_id)
  values (auth.uid(), 'publish', 'post', target_post_id);
  return (v_id, v_slug, v_status, v_published, v_updated)::public.post_lifecycle_result;
end;
$$;

create function public.unpublish_post(target_post_id uuid)
returns public.post_lifecycle_result
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_hero uuid;
  v_id uuid;
  v_slug text;
  v_status public.post_status;
  v_published timestamptz;
  v_updated timestamptz;
begin
  if not public.is_active_owner() then raise exception 'not_authorized' using errcode = '42501'; end if;

  update public.posts p set status = 'unpublished', updated_at = now()
  where p.id = target_post_id and p.deleted_at is null and p.status = 'published'
  returning p.id, p.slug, p.status, p.published_at, p.updated_at, p.hero_media_id
  into v_id, v_slug, v_status, v_published, v_updated, v_hero;
  if v_id is null then raise exception 'post_not_found' using errcode = 'P0002'; end if;

  update public.media_assets m set state = 'draft'
  where m.id = v_hero
    and not exists (
      select 1 from public.posts p
      where p.hero_media_id = v_hero
        and p.status = 'published' and p.deleted_at is null and p.id <> target_post_id
    );
  insert into public.audit_events(actor_user_id, action, entity_type, entity_id)
  values (auth.uid(), 'unpublish', 'post', target_post_id);
  return (v_id, v_slug, v_status, v_published, v_updated)::public.post_lifecycle_result;
end;
$$;

create function public.soft_delete_post(target_post_id uuid)
returns public.post_lifecycle_result
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_hero uuid;
  v_id uuid;
  v_slug text;
  v_status public.post_status;
  v_published timestamptz;
  v_updated timestamptz;
begin
  if not public.is_active_owner() then raise exception 'not_authorized' using errcode = '42501'; end if;

  update public.posts p set status = 'deleted', deleted_at = now(), updated_at = now()
  where p.id = target_post_id and p.deleted_at is null
  returning p.id, p.slug, p.status, p.published_at, p.updated_at, p.hero_media_id
  into v_id, v_slug, v_status, v_published, v_updated, v_hero;
  if v_id is null then raise exception 'post_not_found' using errcode = 'P0002'; end if;

  update public.media_assets m set state = 'draft'
  where m.id = v_hero
    and not exists (
      select 1 from public.posts p
      where p.hero_media_id = v_hero and p.status = 'published' and p.deleted_at is null
    );
  insert into public.audit_events(actor_user_id, action, entity_type, entity_id)
  values (auth.uid(), 'delete', 'post', target_post_id);
  return (v_id, v_slug, v_status, v_published, v_updated)::public.post_lifecycle_result;
end;
$$;

create function public.save_post_changes(
  target_post_id uuid,
  new_title text,
  new_excerpt text,
  new_body jsonb,
  new_category uuid,
  new_hero uuid
)
returns public.post_lifecycle_result
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cur_status public.post_status;
  v_cur_hero uuid;
  v_id uuid;
  v_slug text;
  v_status public.post_status;
  v_published timestamptz;
  v_updated timestamptz;
begin
  if not public.is_active_owner() then raise exception 'not_authorized' using errcode = '42501'; end if;

  select p.status, p.hero_media_id into v_cur_status, v_cur_hero
  from public.posts p
  where p.id = target_post_id and p.deleted_at is null
  for update;
  if not found then raise exception 'post_not_found' using errcode = 'P0002'; end if;

  if not exists (select 1 from public.categories c where c.id = new_category and c.active) then
    raise exception 'category_not_found' using errcode = '23514';
  end if;

  -- Ownership of the hero is proven by the owner-only UPDATE policy: the no-op update only
  -- matches a media row that belongs to the caller. owner_id is never read.
  if new_hero is not null then
    update public.media_assets m set deleted_at = m.deleted_at
    where m.id = new_hero and m.deleted_at is null;
    if not found then raise exception 'media_not_found' using errcode = '23514'; end if;
  end if;

  if v_cur_status = 'published' then
    if new_hero is null then raise exception 'hero_media_required' using errcode = '23514'; end if;
    if jsonb_typeof(new_body) <> 'array' or jsonb_array_length(new_body) = 0 then
      raise exception 'body_required' using errcode = '23514';
    end if;
    update public.media_assets m set state = 'published' where m.id = new_hero and m.state <> 'published';
  end if;

  update public.posts p set
    title = new_title,
    excerpt = new_excerpt,
    body_json = new_body,
    category_id = new_category,
    hero_media_id = new_hero,
    updated_at = now()
  where p.id = target_post_id
  returning p.id, p.slug, p.status, p.published_at, p.updated_at
  into v_id, v_slug, v_status, v_published, v_updated;
  if v_id is null then raise exception 'post_not_found' using errcode = 'P0002'; end if;

  if v_cur_status = 'published'
     and v_cur_hero is not null
     and v_cur_hero is distinct from new_hero then
    update public.media_assets m set state = 'draft'
    where m.id = v_cur_hero
      and not exists (
        select 1 from public.posts p
        where p.hero_media_id = v_cur_hero
          and p.status = 'published' and p.deleted_at is null
      );
  end if;

  insert into public.audit_events(actor_user_id, action, entity_type, entity_id)
  values (auth.uid(), 'update', 'post', target_post_id);
  return (v_id, v_slug, v_status, v_published, v_updated)::public.post_lifecycle_result;
end;
$$;

-- Fresh functions inherit Supabase's default EXECUTE for anon/authenticated: close that again.
revoke all on function public.publish_post(uuid), public.unpublish_post(uuid), public.soft_delete_post(uuid),
  public.save_post_changes(uuid, text, text, jsonb, uuid, uuid) from public, anon;
grant execute on function public.publish_post(uuid), public.unpublish_post(uuid), public.soft_delete_post(uuid),
  public.save_post_changes(uuid, text, text, jsonb, uuid, uuid) to authenticated;

-- ------------------------------------------------------------ 3. self-check
-- Fails the migration (and rolls it back) if an internal column is still reachable.
do $$
declare
  r text;
  c record;
begin
  for r in select unnest(array['anon', 'authenticated']) loop
    for c in
      select * from (values
        ('public.posts', 'author_user_id'),
        ('public.media_assets', 'owner_id'),
        ('public.media_assets', 'storage_bucket'),
        ('public.media_assets', 'bytes'),
        ('public.media_assets', 'sha256')
      ) as t(rel, col)
    loop
      if has_column_privilege(r, c.rel, c.col, 'SELECT') then
        raise exception 'internal column % of % is selectable by %', c.col, c.rel, r;
      end if;
    end loop;
  end loop;
end;
$$;
```

Mudança em `src/`: `src/app/api/admin/media/[id]/route.ts` remove `.eq("owner_id", editor.id)` da consulta de `media_assets` (o escopo vem da RLS).

### 10.11 Autorização solicitada

Escopo, em ordem: `20261011010000`, `20261011020000`, `20261011030000`, `20261011040000`. Confirme explicitamente:

> Aprovo `db push --linked` no projeto `oetwoiuzoniwwtrdnohr` para as 4 migrations listadas em §2, na ordem.
