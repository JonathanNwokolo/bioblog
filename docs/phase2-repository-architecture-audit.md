# MICROCosmos — auditoria de arquitetura do repositório para a Fase 2

**Data da inspeção:** 2026-10-10  
**Escopo:** leitura do repositório; nenhuma implementação de CMS, banco ou integração científica  
**Resultado:** **PASS — Fase 2.0 concluída**; arquitetura atual confirmada e preparação documental fundamentada no repositório

## 1. Identidade e estado do workspace

- Raiz Git confirmada: `C:/Users/Home/Desktop/WORKS/bioblog`.
- Repositório remoto: `https://github.com/JonathanNwokolo/bioblog.git`.
- Produto declarado por `package.json`: `microcosmos`, versão `0.1.0`.
- Branch inspecionada: `main`, alinhada com `origin/main` no commit `d3753f2`.
- `git status --short --branch` estava limpo antes desta documentação. Nenhuma alteração preexistente foi removida, sobrescrita ou incluída em commit.
- Foram lidos `AGENTS.md`, `CLAUDE.md`, a documentação de composição/conteúdo/QA da Fase 1 e os módulos relevantes em `src/` e `tests/`.
- Não existe `README.md`. A documentação arquitetural anterior está distribuída sobretudo em `CLAUDE.md`, `docs/approved-homepage-composition.md`, `docs/content-placeholders.md` e `docs/phase1-qa-report.md`.

## 2. Especificação científica localizada

A única cópia local encontrada estava fora do repositório:

`C:/Users/Home/Documents/Codex/2026-10-10/microcosmos-scientific-api-trust-safety-requirements/outputs/phase-2-scientific-content-architecture.md`

Ela foi copiada integralmente para `docs/phase2-scientific-content-architecture.md`. SHA-256 da origem no momento da integração:

`C85E65DDB6A89BAC99DCE810E799D2C62AF4762A4DD561B98D043AFEF64E78D4`

### Contagem confirmada pela proprietária

Em decisão formal de 2026-10-10, a proprietária confirmou que a especificação científica atual contém **25 critérios de aceite** e que a referência anterior a 29 era uma contagem incorreta:

- publicação: 4;
- NCBI: 4;
- DPDx: 5;
- GBIF: 6;
- cache: 2;
- acessibilidade: 1;
- regressão: 3.

Total confirmado: 25. Nenhum critério adicional deve ser criado para alcançar a contagem anterior. A cópia integrada é fiel ao arquivo-fonte acessível e sua contagem está reconciliada com a decisão da proprietária.

## 3. Aplicação existente

### Stack observada

- Next.js `16.4.0`, App Router;
- React `19.3.0` e TypeScript `7.0.2`;
- CSS Modules e CSS global;
- nenhuma biblioteca de UI, autenticação, banco, ORM, upload, storage ou fila;
- scripts: `dev`, `build`, `start`, `typecheck` e testes com `node:test`.

As orientações locais do Next.js 16 em `node_modules/next/dist/docs/` foram consultadas para autenticação, segurança de dados, Server Actions, revalidação e variáveis de ambiente. A recomendação abaixo assume APIs dessa versão, não convenções antigas do framework.

## 4. Matriz de capacidade real

| Capacidade | Evidência no repositório | Estado real |
|---|---|---|
| Homepage | `src/app/page.tsx` monta Hero, Trajetória, Diário, Destaque e Explore; footer vem do layout | **Implementada, estática** |
| Diário na homepage | `Diary` deriva destaque e histórico de uma coleção única com `splitDiary` | **Implementado sobre dados locais** |
| Índice `/diario` | Renderiza todos os itens de `src/content/posts.ts` | **Implementado, estático** |
| Artigo `/diario/[slug]` | `getPost`, `generateStaticParams`, metadados e 404 | **Implementado, estático** |
| Ordenação editorial | `sortPublished` ordena por `publishedAt`; o mais recente vira destaque | **Implementada e testada** |
| Rascunho | `publication: "draft"` exclui item do feed/rota gerada | **Contrato mínimo em memória; não é workflow de CMS** |
| Modelos de conteúdo | Interfaces em `src/content/types.ts`; conteúdo em arrays TypeScript | **Implementados para protótipo** |
| Conteúdo real | Três posts, trajetória e organismo estão marcados como `placeholder` | **Demonstrativo** |
| Curtidas | `use-engagement.ts` persiste por slug em `localStorage` | **Protótipo por navegador; não compartilhado** |
| Comentários | formulário, validação, remoção e persistência em `localStorage` | **Protótipo por navegador; sem identidade/moderação** |
| Banco persistente | nenhuma dependência, migration, schema ou configuração | **Ausente** |
| Autenticação/admin | nenhuma rota, middleware/proxy, sessão ou provedor | **Ausente** |
| Upload/media | imagens versionadas em `public/`; nenhum endpoint ou storage | **Ausente** |
| CMS | comentários no código apenas antecipam substituição futura dos arrays | **Ausente** |
| APIs científicas | nenhuma chamada, adapter, cache, gate ou provenance | **Ausente** |
| Observabilidade | nenhuma integração de logs/métricas | **Ausente** |
| Deploy | compatível em princípio com Next.js; nenhum `vercel.json`, link `.vercel`, Dockerfile, workflow ou variável local | **Não configurado/provado neste checkout** |

## 5. Contratos que devem ser preservados

1. `splitDiary` é o contrato visual atual: o primeiro post publicado por data é o destaque e todos os demais formam o histórico sem limite nem duplicação.
2. Rascunhos não aparecem na homepage, no índice ou na rota pública.
3. A ordem fixa da homepage não muda; blocos científicos são aditivos dentro do artigo e não reordenam cards ou feed.
4. Conteúdo da autora e dados importados precisam de modelos e apresentação separados.
5. Ausência de dado não pode virar zero, texto plausível ou certeza implícita.
6. O estado local atual de curtidas/comentários não é dado migrável de usuários: não existe identidade confiável nem coleção central para extrair.

## 6. Lacunas críticas antes de produção

- Não existe boundary de autorização; ocultar uma página de admin não protegeria Server Actions ou Route Handlers.
- Não existe persistência transacional para publicar um post e atualizar suas projeções.
- Não há política de arquivo, tipo, tamanho, metadados, privacidade de rascunho ou ciclo de exclusão de mídia.
- Comentários podem conter conteúdo hostil e hoje não passam por moderação compartilhada.
- Likes não têm identidade/idempotência global nem proteção de abuso.
- Rotas públicas leem módulos compilados; um post novo exige alteração de código e novo build.
- Nenhum mecanismo atual suporta jobs assíncronos, cache científico, provenance, revogação de direitos ou auditoria de estado.
- O destino de produção e seus recursos não estão demonstrados pelo repositório; “deploy compatível” não equivale a “deploy configurado”.

## 7. Classificação final

### Implementado

- apresentação da homepage e do Diário;
- páginas de artigo;
- ordenação determinística e exclusão de rascunhos;
- modelos locais tipados;
- interações locais de like/comentário;
- testes unitários do conteúdo, feed e engagement local.

### Protótipo/parcial

- publicação por edição manual de `src/content/posts.ts`;
- status editorial reduzido a `draft` versus publicado;
- `baseLikes` sem origem de servidor;
- mídia empacotada com o código;
- conteúdo demonstrativo e placeholders.

### Planejado

- painel privado, auth, banco, storage, fluxo draft/preview/publish;
- comentários/likes compartilhados;
- migrations e observabilidade;
- adapters e gates científicos opcionais.

### Dependências externas para as próximas fases

- escolha/criação das contas de infraestrutura e segredos;
- identidade definitiva da conta proprietária;
- domínio e plataforma de produção;
- valor de `MIN_RELIABLE_OCCURRENCES`, janelas de cache e expiração de revisão de direitos;
- conteúdo real, imagens e decisões editoriais da proprietária.

Essas dependências não bloqueiam o `PASS` documental da Fase 2.0; são gates de implementação, segurança ou lançamento das fases seguintes.

## 8. Veredito da Fase 2.0

**PASS.** As condições desta fase preparatória estão atendidas com as seguintes evidências:

- workspace, Git e estrutura real foram inspecionados;
- `AGENTS.md`, `CLAUDE.md`, documentação arquitetural existente, código e testes relevantes foram lidos;
- a especificação científica acessível foi integrada integralmente em `docs/` e sua origem foi registrada por hash;
- a contagem oficial de 25 critérios foi confirmada pela proprietária;
- homepage, Diary Feed, artigos, conteúdo, engagement, persistência, autenticação, storage e deploy foram classificados por evidência;
- experiência da proprietária, arquitetura mínima, modelo de dados, ambiente, migração, segurança e critérios de publicação foram documentados;
- capacidades implementadas, protótipos, planos e dependências externas permanecem explicitamente separados;
- a suíte existente passou com 23 testes, o typecheck passou e o build de produção concluiu com sucesso após as alterações documentais;
- nenhum CMS ou módulo científico foi implementado, e nenhum commit, push ou deploy foi realizado.
