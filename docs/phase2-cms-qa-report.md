# Fase 2.1 — relatório de QA

## Veredito

**PARTIAL / NOT APPROVED FOR PRODUCTION.** Implementação e banco existem; o gate final exige owner real, env local e fluxo browser autenticado.

## Baseline antes da mudança

- HEAD: `d3753f2ecfe3fec27e73669ceab3e6ec7a002dcb`;
- 23/23 testes passaram;
- typecheck passou;
- build Next.js 16.4 passou com 8 páginas estáticas.

## Verificação após implementação

- 27/27 testes Node passaram, incluindo slug, corpo, validação e magic bytes;
- typecheck passou com config isolada de tipos gerados por build;
- build Next.js 16.4 passou;
- rotas produzidas: homepage/diário com cache de 5 min; artigo, admin e APIs dinâmicos;
- npm audit: 0 vulnerabilidades na instalação das dependências.

## Banco real

- migration executada com sucesso no projeto `microcosmos`;
- query de verificação confirmou schema/RLS/bucket;
- security advisor: 0/0/0;
- performance advisor: 0 errors, 0 warnings; apenas unused-index informativo em banco vazio.

## Browser QA

Foi executado o smoke test das superfícies disponíveis sem sessão, em build de produção local, com evidências em `docs/evidence/phase2-cms/`:

- `/`, `/diario` e `/admin/login` responderam HTTP 200 em 1440×950, 768×1024 e 390×844;
- as nove combinações não apresentaram overflow horizontal;
- nenhum `console.error` ou `pageerror` foi capturado;
- `browser-results.json` registra status, overflow, erros e arquivo de cada captura;
- a inspeção visual confirmou que o estado explícito de Supabase não configurado é legível e não simula conteúdo remoto.

Isso não permite marcar Browser QA como PASS. Sem conta owner e sem env local, não foram executados:

- login real e expiração de sessão;
- criar/editar rascunho;
- upload de imagem real;
- preview privado;
- publish/update/unpublish/delete;
- comprovação homepage/archive/article com persistência;
- testes 1440/768/390 dos fluxos autenticados;
- teclado, foco, console e rede em sessão autenticada.

As screenshots existentes cobrem somente superfícies públicas/sem sessão. Novas capturas devem ser produzidas depois que o owner for provisionado; as atuais não podem ser usadas como evidência dos fluxos privados.

## Cobertura ainda necessária

- testes RLS reais para anon, non-owner e owner;
- mídia draft retorna 404 para anon; published retorna imagem; unpublish revoga;
- concorrência de slug no Postgres;
- falha de Storage não reporta sucesso;
- revalidação observada no browser;
- regressão visual da homepage e Diary Feed nos três viewports.


## Atualização — Fase 2.1.1 (2026-10-11)

Parte da cobertura listada acima foi executada **localmente** (Supabase CLI/Docker): RLS real para anon, não-proprietário e proprietário, mídia em rascunho 404/publicada/revogada, revalidação observada no navegador e ciclo completo de publicação. Detalhes, falhas corrigidas e bloqueios em [`phase211-local-verification.md`](phase211-local-verification.md). Validação remota continua pendente; veredito segue PARTIAL.


## Phase 2.1.2 remote update (2026-10-11)

See `docs/phase212-remote-verification.md` §12. Free Plan, spend cap on and all add-ons disabled were confirmed in the dashboard; no billing change. `.env.local` configured with public URL and publishable key only. Remote Auth/RLS-session/Storage/E2E/browser QA remain NOT EXECUTED pending owner user creation (verdict PARTIAL). Public sign-ups are currently enabled; disable after the owner user exists.
