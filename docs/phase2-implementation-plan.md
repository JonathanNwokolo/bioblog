# MICROCosmos — plano de implementação da Fase 2

**Objetivo:** transformar o Diário estático em publicação simples e segura, preservando a homepage aprovada e preparando integrações científicas opcionais.  
**Não faz parte desta preparação:** implementar o CMS completo, chamar provedores científicos, migrar produção, criar contas externas, commit, push ou deploy.

## 1. Decisão arquitetural recomendada

Usar **o próprio Next.js 16 como aplicação e camada servidor**, com **um projeto Supabase gerenciado** para Auth, PostgreSQL e Storage. Esta arquitetura foi **aprovada provisoriamente pela proprietária em 2026-10-10**, condicionada à validação de segurança, custos, migração e compatibilidade durante a Fase 2.1.

### Por que esta é a menor arquitetura sustentável

- mantém uma única aplicação e evita um backend separado;
- reúne identidade, banco e objetos em um provedor, reduzindo operação e segredos;
- PostgreSQL fornece transações, constraints, índices, JSONB e auditoria suficientes para publicação e provenance;
- Storage suporta buckets privados para rascunhos e públicos para ativos publicados;
- RLS adiciona defesa no banco, mas não substitui autorização nas Server Actions/Route Handlers;
- adapters científicos ficam server-only e podem evoluir sem expor chaves nem payloads brutos ao browser.

Next.js recomenda biblioteca/provedor de autenticação, autorização próxima de cada mutação e uma camada de acesso a dados; Server Actions devem ser tratadas como endpoints públicos. Supabase documenta sessões SSR em cookies, PostgreSQL com RLS e Storage integrado. Referências oficiais: [Next.js Authentication](https://nextjs.org/docs/app/guides/authentication), [Next.js Data Security](https://nextjs.org/docs/app/guides/data-security), [Supabase SSR Auth](https://supabase.com/docs/guides/auth/server-side), [Supabase Database](https://supabase.com/docs/guides/database/overview) e [Supabase Next.js quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs).

### Alternativas avaliadas

| Opção | Vantagem | Custo/risco | Decisão |
|---|---|---|---|
| Supabase integrado | menos fornecedores e painel único | dependência do provedor; `@supabase/ssr` é documentado como beta; backup de banco não inclui bytes do Storage | **Recomendada**, com adapters internos e export/backup testado |
| Auth dedicado + Neon + Vercel Blob | componentes especializados e boa integração Vercel | três fornecedores, faturamentos, consoles e políticas; mais glue code | reservar se requisitos futuros excederem Supabase |
| CMS SaaS headless | editor maduro rapidamente | modelo visual/editorial e integrações científicas ficam presos ao CMS; auth/engagement ainda separados | não é o mínimo para este produto |
| Banco/arquivos no filesystem do deploy | simples localmente | filesystem efêmero, sem escala horizontal, backup ou consistência | rejeitada para produção |
| Backend próprio/VPS | controle total | patching, backup, observabilidade e segurança operacionais desproporcionais | rejeitada sem gatilho mensurável |

Não há confirmação de Vercel neste checkout. A arquitetura funciona em Vercel ou em outro host Node compatível; detalhes de runtime devem ser validados quando o destino real for informado.

## 2. Experiência da proprietária

Fluxo principal, sem campos científicos obrigatórios:

1. Ynara entra em `/admin/login`.
2. Em `/admin/posts/new`, envia uma imagem.
3. Informa título.
4. Escolhe uma categoria existente.
5. Escreve o post em editor visual simples.
6. Alterna entre edição e preview privado.
7. Publica.

A publicação executa uma transação que valida o post, promove a mídia elegível, grava `published_at` na primeira publicação e muda o status para `published`. Depois, invalida `/`, `/diario` e `/diario/[slug]`. A consulta pública ordenada por `published_at DESC` atualiza automaticamente o destaque e o histórico; não existe um campo manual “featured”.

Editar não altera a posição original. Despublicar torna a rota indisponível e remove o item das projeções. Republicar preserva `first_published_at`, evitando que uma correção antiga tome o destaque. Excluir move primeiro para lixeira (`deleted_at`); purge físico de banco/mídia é uma ação posterior, explícita e auditável.

Enriquecimento científico aparece como ação opcional após o rascunho existir. `pending`, falha, ambiguidade ou bloqueio nunca desabilitam “Publicar post”. Somente uma projeção `verified` pode aparecer ao visitante.

## 3. Modelo de dados proposto

Todos os IDs internos são UUIDs; timestamps são UTC; slugs são únicos e imutáveis após a primeira publicação, salvo fluxo explícito com redirect.

| Tabela | Campos centrais | Regras principais |
|---|---|---|
| `owner_accounts` | `user_id`, `active`, `created_at` | somente IDs de Auth aprovados; sem cadastro público |
| `categories` | `id`, `slug`, `label`, `active`, `sort_order` | seleção simples; slug único |
| `posts` | `id`, `legacy_id`, `slug`, `title`, `excerpt`, `body_json`, `category_id`, `hero_media_id`, `status`, `first_published_at`, `updated_at`, `deleted_at`, `author_user_id`, `is_demo` | status: `draft`, `published`, `unpublished`, `deleted`; constraints por estado |
| `post_revisions` | `id`, `post_id`, `revision`, snapshot editorial, `created_by`, `created_at` | histórico para recuperação e auditoria |
| `media_assets` | `id`, `owner_id`, `storage_bucket`, `object_key`, `state`, `mime_type`, `bytes`, `width`, `height`, `alt_text`, `sha256`, `created_at`, `deleted_at` | `draft`, `published`, `quarantined`, `deleted`; chave aleatória; alt obrigatório ao publicar |
| `comments` | `id`, `post_id`, `display_name`, `body`, `status`, `created_at`, `moderated_at`, `moderated_by` | `pending`, `approved`, `rejected`, `spam`, `deleted`; público lê apenas `approved` |
| `post_likes` | `post_id`, `actor_hash`, `created_at` | chave única `(post_id, actor_hash)`; nenhuma contagem gravada separadamente |
| `scientific_enrichments` | `id`, `post_id`, `provider`, `query_identity`, `status`, `reason_codes`, `normalized_payload`, campos de provenance, `verified_at`, `revoked_at` | cliente nunca define `verified`; projeção pública filtra estado e validade |
| `external_image_rights` | campos de `ExternalImageRights`, `enrichment_id` | uma decisão por ativo; restrição específica prevalece |
| `gbif_occurrences` | `enrichment_id`, `gbif_id`, dataset/publisher, coordenadas, incerteza, flags, licença, estado/exclusion reason | licença e ownership permanecem por registro |
| `scientific_cache` | `cache_key`, `provider`, `adapter_version`, `status`, `normalized_payload`, provenance, `fresh_until`, `rights_recheck_at` | cache não promove confiança; invalidação por record ID, versão, direitos e revogação |
| `scientific_jobs` | `id`, `enrichment_id`, `state`, `attempts`, `run_after`, `locked_at`, `last_error_code` | retries limitados e backoff; sem conteúdo privado em logs |
| `audit_events` | ator, ação, entidade, IDs, metadados seguros, `created_at` | publish/unpublish/delete/moderação/transições científicas; sem segredos ou corpo de rascunho |

`body_json` é conteúdo estruturado validado por schema, não HTML arbitrário. A camada pública recebe DTOs mínimos. Sanitização continua obrigatória na renderização e em qualquer conversão futura.

## 4. Autenticação e autorização

- Supabase Auth com conta criada por convite; cadastro público desativado.
- Sessão SSR por cookie seguro; nunca armazenar chave privilegiada no cliente.
- Uma DAL server-only resolve a sessão e confirma `owner_accounts.active` em **cada** leitura/mutação administrativa.
- A proteção de navegação (`proxy.ts`, se adotada) é apenas filtro otimista; Server Actions e Route Handlers repetem auth + autorização.
- MFA é recomendada para a única conta proprietária antes do lançamento.
- Service role é restrita a jobs/migrations no servidor; ações normais usam a identidade da Ynara e RLS.
- Preview usa token opaco, curto e revogável ou sessão de owner; nunca transforma o rascunho em URL pública enumerável.

## 5. Upload e mídia

1. O servidor cria um registro `media_assets` em estado `draft` e autoriza upload limitado para bucket privado.
2. Validar tamanho, magic bytes/MIME permitido, dimensões e decodificação; rejeitar SVG/HTML e nomes de arquivo fornecidos como chave.
3. Normalizar orientação, remover EXIF sensível e produzir variantes seguras; guardar SHA-256 e metadados.
4. Preview usa URL assinada curta do bucket privado.
5. No publish, copiar/promover para bucket público com chave imutável e somente então referenciar no post publicado.
6. Se a operação parcial falhar, o post não publica; job idempotente remove órfãos.
7. Delete editorial é soft delete. Purge de objetos ocorre após janela de recuperação e confirma ausência de referências.

Backups de PostgreSQL não incluem os objetos do Supabase Storage; a operação precisa de export/replicação de mídia separada, conforme a [documentação oficial de backups](https://supabase.com/docs/guides/platform/backups).

## 6. Publicação e renderização

- Repositório de dados server-only expõe `listPublishedPosts`, `getPublishedPostBySlug` e comandos editoriais; componentes não importam SDK privilegiado.
- Homepage, índice e artigo passam a consumir DTOs do banco mantendo a forma visual atual.
- `generateStaticParams` pode pré-gerar slugs existentes, mas a rota também precisa aceitar posts criados depois do build.
- Após mutação bem-sucedida, usar revalidação explícita de paths/tags; falha de revalidação não reverte dado já persistido, mas deve ser registrada e ter retry.
- A seleção do destaque é derivada por consulta: publicado, não deletado, mais recente por `first_published_at`, com desempate por ID.
- Preview nunca usa a consulta pública.

## 7. Curtidas e comentários públicos

- Curtidas: cookie de visitante aleatório, transformado no servidor com segredo rotacionável; constraint única impede duplicação por identidade pseudônima. Isso reduz duplicatas, mas não prova uma pessoa única e deve ser descrito como limitação.
- Aplicar rate limit por post e sinais de abuso. Não coletar IP bruto persistentemente sem necessidade e política correspondente.
- Comentários entram como `pending`; somente `approved` é público. Validar tamanho e Unicode, renderizar como texto, adicionar honeypot/rate limit e permitir moderação no painel.
- Remoção pública “do próprio comentário” exige identidade verificável; o comportamento local atual não deve ser prometido após migração sem um token de gestão seguro.
- Contagens são agregações do banco/cache, nunca números decorativos.

## 8. Integração científica

Implementar exatamente a especificação integrada em `docs/phase2-scientific-content-architecture.md`:

- adapters server-only separados: `ncbi-taxonomy`, `cdc-dpdx`, `gbif-occurrence`;
- schemas de entrada e saída estritos, payload bruto não público e digest persistido;
- state machine compartilhada (`not_requested`, `pending`, `verified`, `ambiguous`, `insufficient`, `blocked`, `unavailable`);
- provenance obrigatório e reason codes estáveis;
- cache por provedor + identidade + versão do adapter, sem upgrade de confiança;
- DPDx com decisão de direitos por ativo e fallback sem bytes/URL externa quando não permitido;
- GBIF com exclusões determinísticas, incerteza preservada e threshold configurado;
- um controle acessível “Fonte e limitações” por bloco;
- worker assíncrono independente do comando base de publish.

Nenhum formulário manual amplo será criado. No máximo, a autora solicita enriquecimento e informa o termo/organismo quando não puder ser derivado com segurança; ambiguidades não são publicadas automaticamente.

## 9. Configuração necessária

### Runtime público

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

### Server-only

- `SUPABASE_SERVICE_ROLE_KEY` — somente jobs administrativos controlados;
- `ENGAGEMENT_HASH_SECRET` — pseudonimização/idempotência de likes;
- `CRON_SECRET` — se o host disparar o worker por endpoint protegido;
- `SCIENTIFIC_ENRICHMENT_ENABLED`;
- `NCBI_API_KEY` — opcional conforme uso/limites;
- `NCBI_TOOL_NAME` e `NCBI_CONTACT_EMAIL`;
- `MIN_RELIABLE_OCCURRENCES` — obrigatório quando GBIF estiver habilitado;
- `NCBI_CACHE_TTL_SECONDS`, `GBIF_CACHE_TTL_SECONDS`, `DPDX_CACHE_TTL_SECONDS`;
- `IMAGE_RIGHTS_RECHECK_SECONDS`;
- `SCIENTIFIC_MAX_ATTEMPTS` e timeouts por provedor.

### Build/migrations, fora do runtime do browser

- `SUPABASE_DB_URL` para migrations/CI, armazenada no cofre do provedor;
- IDs do projeto/ambiente para CLI, nunca commitidos.

Fornecer `.env.example` apenas com nomes e comentários. Validar configuração no boot/primeiro uso; nenhuma variável secreta recebe prefixo `NEXT_PUBLIC_`.

## 10. Migração dos posts demonstrativos

1. Congelar fixtures atuais por ID/slug e criar um export determinístico.
2. Criar migration de schema e seed idempotente para **local/staging** com `legacy_id` e `is_demo = true`.
3. Importar os três posts como `draft`, nunca como conteúdo real da Ynara.
4. Verificar paridade de ordem, rotas, mídia, labels de placeholder e 404.
5. Trocar as leituras públicas para o repositório do banco atrás de uma flag temporária; testar zero, um e muitos posts.
6. Em produção, não semear demos publicamente. Ynara cria ou aprova conteúdo real pelo painel.
7. Após aceite e backup, remover a dependência runtime de `src/content/posts.ts`; preservar fixtures mínimas nos testes.
8. Não migrar `localStorage`: ele pertence a navegadores individuais, não é enumerável no servidor e não fornece autoria confiável.

Rollback antes do corte final: reativar leitura estática. Depois que conteúdo real existir somente no banco, rollback é restauração de aplicação **sem** reverter schema destrutivamente; dados permanecem preservados.

## 11. Sequência de entrega

### Marco A — fundação

- migrations versionadas, clientes server/browser separados, validação de env;
- Auth invite-only, owner allowlist/RLS, DAL e testes de autorização;
- buckets draft/public e pipeline seguro de mídia.

### Marco B — CMS mínimo

- lista de posts, criar/editar, categoria, upload, preview;
- publish/unpublish/delete recuperável;
- consultas públicas substituem arrays, mantendo regressões da homepage/Diário.

### Marco C — engagement compartilhado

- likes idempotentes, comentários pendentes, moderação, rate limits e contagens reais.

### Marco D — base científica

- state machine, provenance, cache, jobs, observabilidade e projeção pública bloqueada por padrão.

### Marco E — adapters, um por vez

1. NCBI Taxonomy;
2. GBIF occurrence;
3. CDC DPDx, por ter o gate de direitos mais sensível.

Cada adapter só avança com fixtures determinísticas e critérios aplicáveis verdes. Smoke live é diagnóstico, não gate único.

## 12. Critérios de aceite de segurança e publicação

### CMS/publicação

- usuário não autenticado ou não allowlisted não lê rascunho nem executa qualquer mutação;
- cada Server Action/Route Handler administrativo verifica sessão, owner e input no servidor;
- upload inválido não se torna objeto público; preview de draft expira;
- publicar com apenas imagem, título, categoria e corpo funciona;
- nova publicação assume o destaque e empurra a anterior para o histórico sem duplicação;
- editar não reordena; unpublish remove de todas as superfícies; delete é recuperável dentro da janela definida;
- falha de mídia impede publish consistente, sem post quebrado ou objeto órfão permanente;
- logs/auditoria não contêm segredos, tokens, corpo privado ou payload científico bruto desnecessário;
- comentários não aprovados e posts não publicados nunca aparecem em DTO público;
- XSS, CSRF/origin, enumeração de preview, brute force e abuso de comentários/likes têm testes ou controles explícitos;
- backup e restauração de banco **e mídia** são ensaiados antes do go-live.

### Ciência

Os 25 IDs confirmados pela proprietária e presentes na especificação integrada são gates obrigatórios. Além deles:

- falha de todos os provedores não impede publicação base;
- só o servidor promove para `verified`;
- revogação de direitos remove apenas a projeção da imagem científica;
- attribution/provenance seguem associados ao bloco/registro em todos os breakpoints;
- nenhuma lacuna vira valor inferido, zero, ponto sintético ou imagem “parecida”.

Não devem ser criados critérios artificiais para recuperar a contagem anterior de 29, formalmente corrigida pela proprietária.

## 13. Gates antes de implementação e release

Antes de implementar: confirmar provedor/contas, destino de deploy, identidade da owner, política de comentário, retenção/lixeira, limites de upload e editor escolhido.

Antes de liberar CMS: testes de auth/RLS, upload, transações, preview, publicação, regressão e restore.

Antes de liberar ciência: todos os critérios aplicáveis da especificação, thresholds explícitos, adapters versionados, fixtures sanitizadas, auditoria acessível e prova de que enriquecimento não verificado nunca fica público.

**Estado desta fase preparatória:** **PASS — Fase 2.0 concluída**. Documentação integrada, contagem de 25 critérios confirmada e plano fundamentado; implementação não iniciada.

## 14. Próxima prioridade aprovada — Fase 2.1

**Escopo:** CMS privado e publicação real.

O resultado obrigatório é permitir que Ynara entre no painel, envie uma imagem, informe título e conteúdo, selecione uma categoria, visualize e publique sem editar código e sem configurar dados científicos. Ela também deve conseguir editar, despublicar e excluir publicações.

A implementação deve preservar integralmente a homepage, o Diary Feed, as rotas de artigo e as funcionalidades existentes. A publicação mais recente continua assumindo automaticamente o destaque do Diário, e as anteriores permanecem no histórico.

### Fora do escopo da Fase 2.1

- Atlas;
- Laboratório Interativo;
- Onde Vivem?;
- formulários manuais de dados científicos;
- implementação dos adapters NCBI, DPDx ou GBIF, salvo apenas os contratos mínimos necessários para não fechar a arquitetura futura;
- redesign da homepage ou do Diary Feed;
- commit, push ou deploy automático.

Antes da implementação, a aprovação provisória do Supabase exige uma validação objetiva de segurança, custos aplicáveis, estratégia de migração/rollback e compatibilidade com Next.js 16 e o destino real de deploy.
