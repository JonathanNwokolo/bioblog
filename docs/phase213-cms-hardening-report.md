# Fase 2.1.3 — Endurecimento do CMS para produção

Data: 2026-10-11 · Projeto Supabase: `microcosmos` (`oetwoiuzoniwwtrdnohr`, org NWK Culture, plano Free) · `nwk-culture-production` **não foi tocado**.
Nenhum segredo, token ou senha aparece neste documento. Nada foi commitado, enviado ao Git ou implantado.

Rótulos: **MEDIDO** (executado e observado nesta fase) · **LOCAL** (executado contra build de produção + Supabase local em Docker, mesmo código) · **REMOTO** (executado contra o projeto remoto) · **NÃO EXECUTADO** · **SUPOSIÇÃO** (conhecimento da plataforma, não verificado aqui).

## 0. Veredito

| Fase | Veredito | Motivo resumido |
| --- | --- | --- |
| **2.1.2** | **PARTIAL** | Limpeza remota e sonda real de não-proprietário **no remoto** dependem de ação do proprietário (seções 3 e 4). Todo o resto foi concluído. |
| **2.1.3** | **PASS (escopo de código), com itens abertos do proprietário** | Nenhuma vulnerabilidade crítica/alta conhecida; fluxos principais validados em navegador real; desempenho medido. Não é "pronto para produção" até os passos da seção 12. |

## 1. Linha de base (antes de editar)

| Verificação | Resultado |
| --- | --- |
| `npm run typecheck` | limpo |
| `npm test` | 48/48 |
| `npm audit` | 0 vulnerabilidades |
| ESLint | **inexistente no projeto** (adicionado nesta fase, seção 6.5) |
| Supabase | projeto vinculado = `microcosmos`; `migration list --linked`: 5 locais = 5 remotas |
| Processo local | `next start -p 3000` (PID 17896) obsoleto → encerrado (B4) |
| Árvore de trabalho | alterações anteriores preservadas; só foram adicionados arquivos/edições desta fase |

## 2. Capacidades verificadas vs. simuladas

| Capacidade | Antes desta fase | Agora |
| --- | --- | --- |
| RLS/grants/RPC (papéis) | 37 simulações SQL (remoto, revertidas) | + suíte local de 37 verificações **LOCAL** re-executada: 37/37 |
| Sessão real de proprietário (remoto) | UI da proprietária (fase 2.1.2/13) | inalterado (não repetido: evita novos dados remotos) |
| Sessão real de **não-proprietário** | **não executada** | **LOCAL**: 61/61 com Auth+PostgREST+Storage+HTTP reais · **REMOTO: pendente** (script pronto) |
| Navegação em 1440/768/390/320 + teclado + movimento reduzido | parcial | **LOCAL**: 169/169 verificações |
| Leitura anônima remota | HTTP real (13.4) | re-executada: 28/28 (**REMOTO**, somente leitura) |

## 3. B1 — Limpeza dos dados de teste remotos (item ABERTO)

Re-inventário somente leitura (2026-10-11): 2 `posts` (`status=deleted`), 3 `post_revisions`, 2 `media_assets`, 2 objetos em `post-media`, 14 `audit_events`, 1 usuário, 1 proprietário, 4 categorias. Proveniência: criados pela conta proprietária entre 17:40 e 17:52 UTC de 2026-10-11, títulos "QA …"; o banco tinha 0 desses registros antes. As contagens permaneceram idênticas após todas as sondas desta fase.

Manifesto exato: `docs/evidence/phase213/cleanup-manifest.json`.

| Classe | O que | Ação |
| --- | --- | --- |
| Conteúdo temporário | posts `98a207ba-…d146`, `e12a49b8-…9fe` | remover |
| Dependentes | revisões 4, 5, 6 | caem por `ON DELETE CASCADE` |
| Mídia | `8180ee80-…a0a`, `291e010c-…1d1` (`state=draft`) | remover **após** os posts |
| Objetos Storage | 2 arquivos `.webp` listados no manifesto | remover **pela API de Storage** (nunca `DELETE` em `storage.objects`) |
| Auditoria | `audit_events` 16–29 (14) | **manter**: sem política de retenção que autorize remoção; não há FK para posts/mídia, então manter não quebra integridade |
| Não é teste | 1 usuário, 1 proprietário, 4 categorias | manter |

**Por que não executei:** exclusão permanente de dados é uma ação que não realizo, mesmo com autorização verbal; a sessão anterior também teve a tentativa negada. Item permanece **ABERTO**.

**Operação mínima do proprietário** (na raiz do repositório, projeto já vinculado):

```bash
npx supabase@2.120.0 storage rm --linked --experimental "ss:///post-media/64735f74-5c82-41fa-a001-406813663c6b/c786d6c9-b51b-46f4-87cd-99c4a02625f3.webp" "ss:///post-media/f65424d0-c1b5-469a-b578-b6183d919d96/934f9a6e-dff2-4013-bcc7-b255f36610ce.webp"
npx supabase@2.120.0 db query --linked -f scripts/ops/cleanup-phase212-test-data.sql
npx supabase@2.120.0 db query --linked -f scripts/ops/verify-phase212-cleanup.sql
```

(alternativa: Dashboard → Storage → `post-media` → excluir os 2 objetos; SQL Editor → colar o `.sql`.)
Sucesso = `posts_deleted=2, media_deleted=2` e, na verificação, `posts 0, media 0, revisions 0, storage_objects 0, audit_events 14, users 1, owners 1, categories 4`.

O SQL é uma única instrução protegida: se as linhas não forem exatamente as do manifesto (status, slug, título "QA …", mídia de capa), **nada é apagado**. Foi testado **LOCAL** com fixtures de mesmos ids: recusa título divergente, apaga 2 posts + 2 mídias + cascata, é idempotente (`scripts/ops/test-cleanup-local.mjs`, 4/4).

## 4. B2 — Teste real com não-proprietário

**LOCAL (executado, 61/61)** — `scripts/verify-phase213-auth.mjs`, conta autenticada real fora de `owner_accounts`, rascunho/publicado/despublicado reais:

- login real; `is_active_owner()=false`; `owner_accounts` vazio; só posts publicados visíveis; rascunho/despublicado inacessíveis por id e slug; mídia correspondente inacessível;
- colunas `author_user_id`, `owner_id`, `sha256`, `bytes`, `storage_bucket` → `42501`; `post_revisions`/`audit_events` sem leitura;
- `INSERT/UPDATE/DELETE` em `posts`, `INSERT` em `media_assets`/`audit_events`/`owner_accounts` rejeitados; RPCs `publish/unpublish/soft_delete/save` → `42501`;
- Storage: assinatura/download de objeto de rascunho e de despublicado negados, upload negado, remoção sem efeito (objeto continua), listagem sem pastas privadas, objeto publicado assinável;
- cadastro público fechado (422);
- HTTP com o cookie SSR real: `/admin`, `/admin/posts/new`, `/edit`, `/preview` → 307 para login; `POST /api/admin/media` → 401; com `Origin` externo → 403; com `Sec-Fetch-Site: cross-site` → 403; mídia de rascunho → 404; página do rascunho → 404;
- **replay de Server Actions** (ids extraídos do HTML do proprietário) com cookie de não-proprietário: nenhum efeito; **controle positivo**: o mesmo pedido com cookie do proprietário surte efeito (status → `deleted`), provando que o formato do pedido é válido.

**REMOTO — NÃO EXECUTADO** (criar conta é ação reservada ao proprietário; cadastros públicos seguem desligados). Evidência remota disponível: sondas anônimas 28/28 (seção 7) e simulação SQL 37/37 (fase 2.1.2).

Passos mínimos do proprietário:
1. Dashboard → Authentication → Users → *Add user* → e-mail descartável, senha forte gerada, *Auto Confirm User*. **Não** registrá-lo em `owner_accounts`.
2. No terminal, sem colar a senha no chat:
   ```bash
   TARGET=remote ALLOW_REMOTE=oetwoiuzoniwwtrdnohr NONOWNER_EMAIL=<email> NONOWNER_PASSWORD=<senha> APP_URL=http://localhost:3000 node scripts/verify-phase213-auth.mjs
   ```
   (com `npm run build && npm start` apontando para o `.env.local` remoto; sem `APP_URL` acessível, apenas as sondas REST/Storage rodam.) O script **não cria dados** remotos e se recusa a rodar no projeto `nwk-culture-production`.
3. Excluir o usuário de teste no dashboard. Conferir `auth.users = 1`.

## 5. B3 — QA de navegador

Executado em Chrome real (Playwright-core, headless) contra build de produção local: `scripts/e2e-phase213-browser.mjs` → **169/169** verificações. Evidências: `docs/evidence/phase213/browser/` (29 capturas + `results.json`).

| Verificação | Resultado |
| --- | --- |
| Viewports 1440 / 768 / 390 e 320 (reflow) | sem rolagem horizontal em home, Diário, artigo, login, painel, editor |
| Alvos interativos | 0 controles < 24 px (exceto links inline) em todas as páginas e viewports |
| axe-core 4.10 (WCAG 2.0/2.1/2.2 A/AA + boas práticas) | 0 violações sérias/críticas; 0 menores após correções (seção 8) |
| Contraste | axe deixou 79 nós "incompletos" (gradientes/sobreposição); resolvidos por amostragem de pixels reais: **0 falhas confirmadas** (`scripts/contrast-audit-phase213.mjs`, `docs/evidence/phase213/contrast-audit.json`); painel/editor 0 |
| Teclado | Tab percorre home (34 paradas), artigo, login, editor mobile, sem armadilha; indicador de foco em todas as paradas |
| `prefers-reduced-motion` | sem animações infinitas, `scroll-behavior:auto`, 0 elementos com transição > 50 ms |
| Console | sem erros de JS em público/admin (erros de recurso são os negativos intencionais) |

**Controle < 24 px do relatório 13.6:** o campo de confirmação de exclusão (`name="confirmation"`) ficava fora do seletor `.admin-form` e usava a altura padrão do navegador (~21 px). Corrigido para 44 px (`.admin-danger input`). *Ressalva honesta:* a identificação é por inspeção do CSS anterior; a build antiga não foi re-medida. A correção foi verificada: 0 controles < 24 px agora.

Limite: o QA em navegador foi feito contra o **Supabase local** (mesmo código). Não foram criados novos dados no remoto para respeitar a restrição de limpeza.

## 6. Parte C — Segurança

### 6.1 Achados e correções

| # | Sev. | Achado | Evidência | Correção | Teste de regressão |
| --- | --- | --- | --- | --- | --- |
| S1 | **Média** | Após o logout, um cookie capturado antes continuava abrindo `/admin` e `/admin/posts/new` (páginas de leitura só validavam o JWT localmente; válido até expirar). Mutações já eram protegidas. | `verify-phase213-logout.mjs`: `/admin → 200` após logout | `getCurrentEditor` confirma a sessão no Auth (`getUser`) por padrão | script (4/4) + 2 testes em `cms-phase213.test.ts` |
| S2 | Baixa | `POST /api/admin/media` só checava o `Content-Length` declarado e depois `request.formData()` — corpo em stream sem o cabeçalho era lido sem limite. | revisão de código | `readBodyWithLimit` (aborta ao exceder, cancela o stream) | 3 testes (declarado, stream, dentro do limite) |
| S3 | Baixa | CSRF aceitava requisição sem `Origin` mesmo com `Sec-Fetch-Site: cross-site`. | revisão de código | `isTrustedMutationRequest` (Origin≡host/`x-forwarded-host`; sem Origin exige `same-origin`/`none`/ausente) | 3 testes + sondas HTTP (403) |
| S4 | Baixa | Sem cabeçalhos de segurança. | `curl -I` | CSP, HSTS, nosniff, Referrer-Policy, Permissions-Policy, XFO, COOP; `X-Robots-Tag`+`no-store` em `/admin` e `/api/admin`; `poweredByHeader:false` | 3 testes |
| S5 | Baixa (risco de desenho) | Rota pública de mídia usava `revalidate=300` e `revalidateTag(…,"max")` (stale-while-revalidate): uma despublicação podia continuar servindo cache por até minutos. *Não foi reproduzido na build anterior.* | — | `updateTag("posts")` nas Server Actions (expiração imediata) + consulta de URL assinada cacheada sob a tag; URL assinada de 1 h; resposta com `max-age=60` | `verify-phase213-publish-cache.mjs` 11/11 |
| S6 | Baixa (confiabilidade) | Falha de rede no upload deixava a UI presa em "Processando…" (promessa sem `catch`). | revisão | `try/catch/finally`, mensagem de recuperação | E2E: rede offline → mensagem → retry OK |
| S7 | Info | IDs de Server Action não são segredo. | — | Autorização é sempre feita no servidor | replay 61/61 (com controle positivo) |
| S8 | Info | Advisor remoto: *leaked password protection* desativado (recurso de plano pago); 2× `multiple_permissive_policies` (desempenho) e 4× `unused_index` (banco vazio). | `docs/evidence/phase213/remote-advisors.json` | Aceito/documentado (seção 11); sem migração nesta fase | — |

**Sem vulnerabilidade crítica ou alta encontrada.** Parte da revisão (S5, "validação perdendo texto" em 7.2) é de risco de desenho, não de exploração reproduzida.

### 6.2 Verificado sem alteração (C1–C4)

- **Autenticação**: sessão validada no servidor; refresh pelo `proxy.ts` (somente `/admin` e `/api/admin`); logout `global`; autenticação ≠ autorização (`owner_accounts` ativo é exigido em toda ação/rota/RPC/RLS); cadastros públicos, logins anônimos e provedores sociais desligados (remoto, `/auth/v1/settings`).
- **Server Actions/rotas**: toda mutação chama `requireEditor`/`getCurrentEditor({verify:true})`; Zod com allowlist de campos (nenhum slug/status/autor vem do formulário); `revalidatePath` só com slugs lidos de linhas persistidas e validados; erros de RPC mapeados para mensagens fixas.
- **RLS/privilégios**: migrações 1–5 revisadas: RPCs `SECURITY INVOKER` com `search_path=''` e checagem `is_active_owner()`; sem `SECURITY DEFINER` na aplicação; `GRANT` por coluna; storage `owner_*` por `owner_id = auth.uid()`; objeto publicado assinável, rascunho/despublicado não (testado). Grants padrão do schema `storage.*` são da plataforma e **não foram alterados** (decisão do proprietário, 11.2).
- **Conteúdo/upload**: título, resumo, corpo, alt e crédito renderizados como texto React (sem `dangerouslySetInnerHTML` em todo `src/`, coberto por teste); assinatura JPEG/PNG/WebP + `sharp` com `limitInputPixels` 40 MP, `rotate()` remove EXIF, saída WebP ≤ 2000 px e ≤ 4 MB; chave de objeto `uuid/uuid.webp`; imagens corrompidas/falsas/enormes recusadas com mensagem sem detalhes internos (E2E).
- **Dependências**: `npm audit` 0 vulnerabilidades (produção e dev, após adicionar ESLint).

### 6.3 CSP — decisão

`script-src 'self' 'unsafe-inline'`: o Next.js injeta scripts de bootstrap em linha; uma CSP por *nonce* exigiria renderização dinâmica de **todas** as páginas públicas, perdendo o cache ISR de 5 min. Compensações: `default-src 'self'`, `object-src 'none'`, `base-uri`/`form-action 'self'`, `frame-ancestors 'none'`, `img-src`/`connect-src` apenas `'self'` + a origem do projeto Supabase, nenhum HTML bruto no código, sem `unsafe-eval` em produção. Risco residual: XSS que consiga injetar script em linha não seria bloqueado pela CSP (mitigado por não haver sink de HTML).

### 6.4 Higiene de segredos e logs

Nenhuma referência a `service_role`/chaves secretas em `src/` (teste). `.env.*` ignorado pelo Git (exceto `.env.example`); `.env.e2e.local` (credenciais **locais** de teste geradas nesta fase) também. A aplicação só registra erros genéricos; `error.message` do Supabase nunca é devolvido ao navegador.

### 6.5 ESLint

`eslint-config-next` não roda com TypeScript 7 (typescript-eslint não o suporta). `eslint.config.mjs` usa `@babel/eslint-parser` e os mesmos conjuntos de regras (Next core-web-vitals, react-hooks, jsx-a11y, ESLint recommended). Resultado: **0 erros** (7 achados corrigidos/justificados: `setState` em efeito no `PostForm`; 4 `jsx-a11y` intencionais no feed rolável e na lente — documentados no código; 2 regex em testes). `npm run lint`. Tipos continuam a cargo de `npm run typecheck`.

## 7. Parte F — UX editorial e resiliência

### 7.1 Fluxos verificados em navegador (LOCAL)

criar rascunho (duplo clique → 1 rascunho) · validar (erro por campo) · salvar · recarregar · prévia privada · upload válido/inválido/enorme/corrompido/sem alt · rede interrompida + retry · sessão expirada (texto preservado) · publicar · editar publicado (visível na hora) · despublicar (404 na hora) · republicar · excluir (confirmação errada recusada; exclusão lógica) · sair (login volta a ser exigido).

### 7.2 Mudanças editoriais

- Mensagens de sucesso/erro após publicar, retirar do ar, excluir e limpar mídia (antes os parâmetros `?published=1` etc. não eram exibidos). Texto só por allowlist (nada da query é refletido).
- Erros de validação em português, por campo, com `aria-invalid`/`aria-describedby`, resumo com foco e **texto digitado preservado** (os valores voltam do servidor; evita o reset de formulário do React 19).
- Aviso de alterações não salvas (`beforeunload`) e contador de parágrafos/caracteres.
- Sessão expirada em salvar/criar: mensagem clara e conteúdo mantido (antes: redirecionamento ao login e perda do texto).
- Alt/crédito da capa editáveis depois do upload (antes, só no momento do envio).
- Estados rotulados em português (Rascunho, Publicado, Retirado do ar); datas de atualização/publicação; link "Ver no site".
- **Limpeza de imagens sem uso** (nova): botão no painel remove imagens privadas sem post (> 1 h), nunca publicadas; sem migração (usa grants existentes); testado por revisão + testes de código — não executado contra o remoto.
- Sem editor rico (requisito não demonstrado).

### 7.3 Resiliência (F4)

| Falha | Comportamento |
| --- | --- |
| Rede interrompida no upload | mensagem + botão reabilitado + retry (E2E) |
| Sessão expirada | salvar mantém texto e orienta a entrar em outra aba (E2E); upload/ações redirecionam ou respondem 401 com mensagem |
| Duplo envio | botão desabilitado + `onSubmit` bloqueia; 1 único rascunho (E2E) |
| Dados inválidos | erros por campo (E2E) |
| Imagem ausente | prévia mostra aviso em vez de ficar quebrada |
| URL de prévia vencida | a prévia usa rota autenticada que assina a cada acesso (sem URL assinada embutida) |
| Cache obsoleto | `updateTag` expira imediatamente (script 11/11) |

## 8. Parte D — Acessibilidade (WCAG 2.2 AA, críticos)

| # | Componente | Severidade | Problema | Correção |
| --- | --- | --- | --- | --- |
| A1 | Editor · confirmação de exclusão | Alta (2.5.8) | campo ~21 px | 44 px |
| A2 | Admin · campos | Média (1.4.11) | borda `--line-strong` ≈ 1,98:1 sobre branco | `--admin-border #767274` (≈ 4,6:1) |
| A3 | `/diario` | Baixa (1.3.1) | h1 → h4 (axe `heading-order`) | entradas em h2 (`headingLevel`) |
| A4 | Hero | Baixa (4.1.2) | `aria-label` em `div` sem papel (`aria-prohibited-attr`) | `role="group"` (sem mudança visual) |
| A5 | Editor/painel | Média (3.3.1/4.1.3) | resultado das ações não era anunciado | mensagens `role=status`/`alert` |
| A6 | Formulários | Média (3.3.1/3.3.3) | erro sem associação ao campo | `aria-invalid`, `aria-describedby`, foco no resumo |
| A7 | Login | Baixa (3.3.7-adjacente) | e-mail apagado após erro | valor preservado |

Mantido sem alteração (identidade): paleta creme/preto/menta/lilás, tipografia, composição da homepage. Contraste, foco (anel ao redor do link esticado dos cards é desenhado em `::after`, por desenho), movimento reduzido: verificados. **Limite:** ferramentas automáticas não estabelecem conformidade total; não houve teste com leitor de tela real nem zoom de texto de 200% em navegador desktop (substituído por reflow a 320 px).

## 9. Parte E — Desempenho

Condições: Lighthouse 12.8.2, Chrome headless, build de produção em `localhost` (backend local, **sem latência de rede real**). "simulate" = modelo Lantern (móvel: Slow 4G, CPU 4×); "applied" = estrangulamento aplicado. **Dados de laboratório; não há dados de campo/INP real.**

| Página | Antes (perf · LCP · transf.) | Depois (perf · LCP · transf.) |
| --- | --- | --- |
| Home — móvel (simulate) | 75 · **17,35 s** · 3,3 MB | 88 · 3,83 s · 0,51 MB |
| Home — móvel (applied) | — | **93** · 2,45 s · TBT 230 ms · 0,49 MB |
| Home — desktop | 99 · 1,0 s | 99 · 0,84 s |
| Diário — móvel | 96 · 2,77 s | 98 · 2,47 s |
| Diário — desktop | 100 · 0,81 s | 100 · 0,58 s |
| Artigo — móvel | 97 · 2,68 s | 97 · 2,38 s |
| Artigo — desktop | 100 · 0,56 s | 100 · 0,56 s |

CLS = 0 em todas; TBT ≤ 106 ms (simulate). Acessibilidade/Boas práticas/SEO = 100 em todas.

**Causa e correções medidas:** o LCP da home era o retrato PNG de 878 KB (+ 3 JPEGs de ~700 KB). Gerados WebP equivalentes (`scripts/optimize-hero-images.mjs`; originais mantidos): 3,3 MB → ~0,5 MB; `srcset` 480/640/896 w, `fetchpriority=high` no retrato, `width/height` intrínsecos, imagem 1 do Diário e capa do artigo com prioridade, `preload:false` na fonte decorativa (Caveat), CSS inline (`experimental.inlineCss`, ~12 KB). Equivalência visual: diferença média 0,32/255 (≤ 0,05 % dos canais com Δ > 24) em 1440/768/390 com movimento reduzido (`scripts/hero-snapshot-phase213.mjs`).

**Meta LCP ≤ 2,5 s (p75, campo):** não mensurável sem dados reais. Em laboratório: móvel home 2,45 s (applied) e 3,83 s (simulate) — **o modelo simulado ainda fica acima de 2,5 s**; causa remanescente medida: ~150 KB de JS (React/Next) + 2 fontes + 4 imagens do hero disputando um canal de 1,6 Mbps. Próximos passos práticos: fontes com subconjunto/peso menor, carregar sob demanda a camada de detalhe da lente, reduzir JS da homepage.

**CMS (E3):** resposta do servidor (mediana, 7 amostras, local): `/admin` 63 ms · novo 72 ms · editor 61 ms · prévia 60 ms (inclui `getUser`+consulta do proprietário); HTML 57–77 KB; sem consultas redundantes (2 por página + verificação). Bundle do editor é o do app (sem editor rico). Upload: feedback imediato, "Enviando e otimizando…", limite 6 MB, retry.

## 10. Regressão (contagens)

| Suíte | Resultado |
| --- | --- |
| `npm test` | **73/73** (era 48; +25 testes de regressão da fase) |
| `npm run typecheck` | limpo |
| `npm run lint` | 0 erros |
| `npm audit` | 0 vulnerabilidades |
| `npm run build` | sucesso (rodada final na seção 13) |
| Navegador E2E (local) | 169/169 |
| Sonda real não-proprietário (local) | 61/61 |
| Publicação/cache sem rebuild (local) | 11/11 |
| Logout/replay de cookie (local) | 4/4 |
| Suíte RLS/Storage/ciclo de vida (local) | 37/37 |
| Sonda anônima (REMOTO, leitura) | 28/28 |
| Limpeza SQL (local) | 4/4 |
| Histórico de migrações | 5 locais = 5 remotas; **nenhuma migração nova** |

## 11. Riscos residuais

| Risco | Gravidade | Responsável |
| --- | --- | --- |
| Limpeza remota pendente (seção 3) | Baixa (dados de teste, privados) | Proprietária |
| Não-proprietário **real no remoto** não testado (seção 4) | Média até executar | Proprietária |
| Código novo ainda não exercitado contra o projeto remoto (E2E foi local) | Média | Proprietária (smoke test, seção 12) |
| CSP com `'unsafe-inline'` em scripts (seção 6.3) | Baixa | Engenharia (nonce exige renderização dinâmica) |
| *Leaked password protection* indisponível no plano Free | Baixa (1 conta, cadastro fechado) | Proprietária (usar senha longa única + MFA) |
| MFA/TOTP não configurado; redirect URLs de Auth não revisadas | Média | Proprietária |
| Grants padrão de `storage.*` (plataforma) não alterados | Info | Proprietária |
| `multiple_permissive_policies` (2) e `unused_index` (4) | Info | Engenharia (opcional) |
| LCP simulado da home móvel > 2,5 s | Baixa | Engenharia |
| Sem limitação de taxa própria no login (dependemos do rate-limit do Supabase Auth) | Baixa | Engenharia |

## 12. Passos restantes do proprietário

1. Executar a limpeza (seção 3) e conferir a verificação.
2. Criar o usuário não-proprietário temporário, rodar `verify-phase213-auth.mjs` em modo remoto e excluí-lo (seção 4).
3. Smoke test remoto com o código novo: `npm run build && npm start` (usa `.env.local` remoto) → entrar, criar rascunho **de teste**, enviar imagem, publicar, despublicar, excluir; depois limpar com o mesmo SQL adaptado.
4. Ativar MFA para a conta da proprietária (se disponível no Free) e revisar *Redirect URLs* no Auth.
5. Confirmar o plano Free e o teto de gastos (já confirmados em 12.1 da fase 2.1.2).

## 13. Plano Free e implantação

(**SUPOSIÇÃO**: comportamentos de plataforma conhecidos, a confirmar no painel/provedor.)
- Supabase Free: projeto pausa após inatividade prolongada; sem PITR (add-on desligado); 1 GB de Storage e egress limitado — imagens WebP ≤ 4 MB e capa ~50–100 KB mantêm o consumo baixo; use "Imagens sem uso" para liberar espaço.
- Hospedagem serverless típica limita o corpo de requisição (ex.: ~4,5 MB em funções da Vercel Hobby): o limite de 6 MB do upload pode ser derrubado pela plataforma antes da aplicação. Mitigação futura: reduzir a imagem no cliente antes do envio.
- `sharp` precisa do binário da plataforma no ambiente de execução.
- `NEXT_PUBLIC_SUPABASE_URL` entra no build (CSP e cliente): definir antes do `build` de cada ambiente.
- HSTS só vale em HTTPS; em domínio próprio avaliar `includeSubDomains`/preload.

## 14. Estado da árvore Git

Nada commitado. Alterações preexistentes preservadas. Novos/alterados nesta fase: ver `git status` (código em `src/`, `next.config.ts`, `eslint.config.mjs`, `package.json`/lockfile — `eslint`, `eslint-config-next`, `@babel/*`, `@eslint/js` como devDependencies —, `public/images/hero/*.webp`, `scripts/*phase213*`, `scripts/ops/*`, `tests/cms-phase213.test.ts`, `docs/`). Arquivo local não versionado: `.env.e2e.local` (credenciais de teste do Supabase **local**).

## 15. Verificação independente

Revisor: agente separado, instruído a **refutar** as afirmações, somente leitura no repositório e sem escrita no remoto. Reiniciado após a queda da sessão, contra o servidor reconstruído. Resultado: **nenhuma vulnerabilidade crítica ou alta**; as três suítes roteirizadas não foram refutadas; ataques próprios do revisor passaram (CSRF com Origin forjado/`null`/sufixo/userinfo; tipos de conteúdo; SVG/RIFF+HTML/GIF/vazio; bomba de PNG 30000×30000 → 415; PNG 41 Mpx → 415; corpo em *chunks* sem Content-Length de 200 MB → 413; EXIF removido; nome de arquivo hostil; traversal em `/api/media` e `/diario`; métodos HTTP → 405; segredos em `.next/static`: 0; vazamento de e-mail/ids/chaves no HTML público: 0; migrações sem defeito explorável).

| # | Sev. | Achado do revisor | Resolução |
| --- | --- | --- | --- |
| F1 | Baixa | Server Actions dependiam só da checagem de Origin do Next (ignorada sem `Origin`); POST sem Origin com `Sec-Fetch-Site: cross-site` despublicou um post. Inalcançável por navegador real (Origin sempre enviado em POST cross-site; cookie `SameSite=Lax`), mas contrariava a afirmação. | **Corrigido**: `src/proxy.ts` aplica `isTrustedMutationRequest` a todo método não seguro em `/admin` e `/api/admin`. Verificado: 403 no pedido forjado, 400 (rejeição de formulário) no mesmo-origem; 3 testes novos. |
| F2 | Baixa | O proxy faz *buffer* do corpo antes da rota; `Content-Length` enorme com corpo parcial mantém a conexão aberta (estilo slowloris), sem 413 antecipado. | **Mitigado**: `experimental.proxyClientMaxBodySize: "7mb"` limita o buffer. **Residual**: timeout de conexão é da hospedagem (Node: 300 s). |
| F3 | Baixa/Info | URLs assinadas já emitidas continuam válidas até expirar (1 h) após despublicar; anônimo pode assinar chaves de objetos publicados. | **Aceito** (inerente a URLs assinadas; conteúdo era público). Para revogação mais rápida: reduzir TTL (custo: mais assinaturas). |
| F4 | Baixa/Info | `s-maxage=300, stale-while-revalidate` em `/`: um CDN à frente poderia servir artigo despublicado por mais tempo; só validado em auto-hospedagem. | **Aberto, depende da hospedagem**: validar no provedor escolhido (purga por tag/caminho). |
| F5 | Baixa | Limite de 6 MB inalcançável em hosts com corpo máx. ~4,5 MB; a UI prometeria 6 MB. | **Documentado** (seção 13). Futuro: reduzir no cliente. |
| F6 | Baixa | Sem rate limit nas rotas públicas por id/slug (cada id aleatório cria entrada de cache + consulta). | **Aberto**: mitigação na borda da hospedagem; risco de consumo da cota Free. |
| F7 | Info | Plugins de lint só transitivos; dois lockfiles (`yarn.lock` e `package-lock.json`); `src/lib/supabase/browser.ts` sem uso. | **Corrigido** plugins declarados em `devDependencies`. Lockfiles/`browser.ts`: pendências de higiene (não removidos para não alterar o que já existia). |
| F8 | Info | Parte dos testes é regex sobre fonte; faltava teste de CSRF de Server Action e de origem do Supabase na CSP. | **Corrigido**: testes comportamentais de CSP com origem do Supabase e de decisão CSRF; wiring do proxy por regex (o proxy não carrega em Node puro). |
| — | Info | `npm audit` (com dev): 5 *high* em `braces` via `eslint-config-next`→`fast-glob`→`micromatch`. | **Aceito e documentado**: só ferramenta de build/lint, padrões vêm do nosso código; `npm audit --omit=dev` = 0; `--force` rebaixaria para v14. |

Não verificado pelo revisor (e tampouco por mim): projeto **remoto** com sessão real de não-proprietário; flags `Set-Cookie` (os cookies de `@supabase/ssr` não são `HttpOnly` por padrão — o navegador do Supabase precisa lê-los; mitigado por CSP/sem sink de HTML); comportamento sob CDN real.

## 16. Resultado final desta execução (rodada após correções do revisor)

| Verificação | Resultado |
| --- | --- |
| `npm test` | **73/73** |
| `npm run typecheck` | limpo |
| `npm run lint` | 0 erros |
| `npm audit --omit=dev` | 0 (dev: 5 *high* aceitos, ver acima) |
| `npm run build` (config padrão `.env.local`) | sucesso |
| Navegador E2E local (1440/768/390/320) | **170/170** (inclui animação automática ≤ 5 s) |
| Sonda real de não-proprietário (local) | 61/61 |
| Publicação/despublicação/cache sem rebuild (local) | 11/11 |
| Cookie antigo após logout (local) | 4/4 |
| Suíte RLS/Storage/ciclo de vida (local) | 37/37 |
| Sonda anônima remota (somente leitura) | 28/28 |
| Teste local do SQL de limpeza | 4/4 |
| Migrações | 5 = 5, nenhuma nova |

### Vereditos

**Fase 2.1.2: PARTIAL.** Pendentes e dependentes do proprietário: limpeza remota (exclusão permanente) e teste real de não-proprietário **no remoto**. Todo o restante (B3, B4, cadastro fechado, verificações de leitura) está concluído. Sem reclassificação formal aceita pela proprietária.

**Fase 2.1.3: PASS no escopo de código e de testes locais**, com os riscos residuais da seção 11 e F3–F6. Critérios: nenhuma vulnerabilidade crítica/alta conhecida; autenticação e operações restritas ao proprietário verificadas com sessões reais (local) e com sondas anônimas + simulação SQL (remoto); Storage privado verificado; fluxos editoriais validados em navegador real; violações WCAG 2.2 AA críticas confirmadas corrigidas; desempenho medido; build e regressões passam.

**Não declaro "produção pronta".** Faltam testes remotos obrigatórios: sonda de não-proprietário real no remoto, smoke test do código novo contra o projeto remoto e a limpeza. MFA (TOTP) **não existe** no CMS (exige desenvolvimento, ver runbook §4). **Lançamento controlado:** não recomendado antes dos passos 1, 3 e 5 de `docs/phase213-owner-runbook.md`; depois deles, adequado para uma proprietária única com cadastro fechado.

### O que posso fazer sem nova autorização × o que depende de você

Ver tabela no fim de `docs/phase213-owner-runbook.md` (procedimento único e ordenado: limpeza → conta não-owner → verificação remota → MFA → smoke test; inclui `scripts/ops/cleanup-smoke-test.sql` para remover os dados do smoke test). Resumo: testes/E2E locais e sondas remotas de leitura eu faço; exclusão permanente, criação/remoção de conta no Auth, digitação de senha e decisões de MFA/URLs/plano dependem de você.
