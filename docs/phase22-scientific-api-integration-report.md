# Microcosmos — Fase 2.2: integração de dados científicos e experiências interativas

**Data:** 2026-10-11 · **Repositório:** `bioblog` · **Sem commits, push, deploy, migração remota ou exclusão remota.**
**Orçamento:** zero. Nenhuma API paga, nenhum plano novo, nenhum projeto Supabase novo; `nwk-culture-production` não foi tocado.

## 1. Veredito

| Provedor / experiência | Veredito | Resumo honesto |
|---|---|---|
| **NCBI Taxonomy** — Atlas do Invisível (`/atlas`) | **PASS** | Busca por nome, sinônimos, homônimos tratados como incerteza, hierarquia clicável, espécies abaixo de um grupo, procedência. Validado com respostas reais de 16 consultas e com 20 testes sobre fixtures reais. Revisão científica pela autora ainda pendente (§12). |
| **CDC DPDx** — Laboratório Interativo (`/laboratorio`) | **PARTIAL** | O DPDx não tem API pública estruturada, então a integração é um registro **curado e revisado à mão**: 4 organismos, 8 micrografias exibidas, 3 retidas por crédito de terceiros. A base de uso é revisão documental de engenharia, **não parecer jurídico**. A fonte tem só 300 × 300 px. Traduções e anotações aguardam a autora. |
| **GBIF** — Onde vivem? (`/onde-vivem`) | **PASS** | Identidade resolvida de forma independente do NCBI, validação de coordenadas, mapa interativo, portão de suficiência, concentração e viés explicitados. Duas decisões de produto pendentes (licença BY-NC e limiar mínimo, §13) e os links do gbif.org não puderam ser abertos por automação (§11). |
| **Fase 2.2 como um todo** | **PARTIAL** | Engenharia completa e verificada; "PARTIAL" porque o DPDx depende de decisão/aprovação da proprietária e a revisão científica por especialista não ocorreu. As pendências de fechamento da Fase 2.1 (limpeza remota, sonda não-proprietário, smoke test) **continuam abertas e não foram escondidas** (§13). |

Sucesso de engenharia e revisão científica são coisas diferentes e aparecem separadas no §12.

## 2. Auditoria inicial

- Lidos: `AGENTS.md` (Next.js 16.4, ler `node_modules/next/dist/docs/` antes de codar), `CLAUDE.md`, `docs/phase2-scientific-content-architecture.md` (contrato de procedência, portões, códigos de razão, critérios AC-*), composição aprovada da homepage, skill `microcosmos-art-direction`, relatórios 2.1.2/2.1.3, `src/lib/cms`, migrações (5, nenhuma nova).
- Linha de base antes de escrever código: `typecheck`, `lint` e 73 testes verdes.
- Árvore de trabalho já tinha alterações não commitadas de fases anteriores; foram preservadas. Nada do CMS foi redesenhado.
- Arquitetura reutilizada: App Router com `searchParams` + componentes de servidor, CSS Modules, tokens de `globals.css`, `zod` já instalado, `node --test` com TypeScript nativo.

## 3. Endpoints reais (confirmados nesta data)

### NCBI Taxonomy (E-utilities, base `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/`)
| Uso | Chamada | Observações medidas |
|---|---|---|
| Nome → TaxIDs | `esearch.fcgi?db=taxonomy&retmode=json&term="<nome>"[All Names]&retmax=10` | Frase exata em *All Names* inclui sinônimos. `[Next Level]` não existe nas E-utilities (retorna "phrase not found"). Prefixo sem aspas `giardia lam*[All Names]` funciona. |
| Resumo | `esummary.fcgi?db=taxonomy&retmode=json&id=a,b,c` | TaxID inexistente devolve `{"error":"cannot get document summary"}` com HTTP 200. |
| Registro completo | `efetch.fcgi?db=taxonomy&retmode=xml&id=<id>` | **Único formato** com linhagem (`LineageEx`), `OtherNames`/sinônimos e autoridade. Vem com `DOCTYPE` e DTD externo: o leitor XML do site o descarta e rejeita `<!ENTITY`. TaxID inexistente devolve `TaxaSet` vazio. |
| Descendentes | `esearch` com `txid<id>[Subtree] AND species[Rank]` | Devolve contagem e uma amostra de até 40 espécies (+1 `esummary`). |

- **Limite:** `X-RateLimit-Limit: 3` sem chave; 5ª requisição de uma rajada de 5 recebeu **429**. O site usa espaçamento de 400 ms (≈ 2,5 req/s), fila limitada e repetição com recuo.
- **Chave/e-mail:** nenhum configurado. `tool=microcosmos-site` é enviado. `NCBI_API_KEY` e `NCBI_CONTACT_EMAIL` são opcionais e só de servidor. **Não foi usado e-mail inacessível**; se a proprietária quiser identificar a aplicação, precisa fornecer um e-mail verificado (§13).
- **Política de uso:** o NCBI não impõe restrições ao uso dos dados, e o Taxonomy "não é uma fonte taxonômica/filogenética primária" (citado em `phase2-scientific-content-architecture.md` §12); ambos aparecem no "Fonte e limitações".

### GBIF (API pública v1, `https://api.gbif.org/v1/`, sem autenticação)
| Uso | Chamada | Observações medidas |
|---|---|---|
| Identidade | `GET species/match?name=` | `matchType` EXACT/FUZZY/HIGHERRANK/NONE, `status` ACCEPTED/SYNONYM/DOUBTFUL. *Plasmodium vivax* e *Morganella* → NONE; *Trichomonas vaginalis* → HIGHERRANK/DOUBTFUL (só o gênero). |
| Ocorrências | `GET occurrence/search?taxonKey&hasCoordinate=true&hasGeospatialIssue=false&occurrenceStatus=PRESENT&limit&offset&country&facet=` | `limit` máximo 300 (acima é cortado em silêncio). **Paginação profunda é inviável: offsets 20.000, 49.950, 90.000 e 99.900 levaram 111 s, 112 s, 142 s e 109 s** para *Aedes aegypti* (121.379 registros); offset 0 levou 1,9 s. |
| Conjunto de dados | `GET dataset/{uuid}` | Título, `citation.text`, DOI e licença. |

- Sem limite numérico publicado: uso moderado (≤ 3 simultâneas, espaçamento de 120 ms, fila 24).
- **Licenças** observadas por registro: CC0, CC BY 4.0, CC BY-NC 4.0 (91% dos registros georreferenciados de *T. cruzi*).

### CDC DPDx
- **Não há API pública estruturada** (HTML estático em `https://www.cdc.gov/dpdx/`). Clientes HTTP comuns recebem 403 da proteção do cdc.gov; **não houve tentativa de contornar** essa proteção. As páginas foram lidas em sessão normal de navegador.
- Reuso — `https://www.cdc.gov/dpdx/about.html`: "a maior parte do material é livre de direitos autorais", pede citação da fonte e nomeia como protegidos apenas as imagens do ciclo de vida de *Blastocystis* e *Pneumocystis* e micrografias eletrônicas de *Gnathostoma*. `https://www.cdc.gov/other/agencymaterials.html` (revisada em 1/5/2023): conteúdo do CDC é em geral domínio público, com crédito ao CDC, aviso de não endosso e conteúdo inalterado; ressalva materiais de contratados, terceiros e governos estaduais/locais.
- Uma afirmação genérica da página **não** vence um crédito de terceiros na legenda (regra do §5.1 da especificação). Uma frase de morfologia obtida por um resumidor automático **não pôde ser reproduzida no texto real da página** e foi descartada: todas as anotações do site citam trecho literal de legenda (verificado em teste).

## 4. Arquitetura (`src/lib/science`)

```text
visitante ─ GET /atlas | /laboratorio | /onde-vivem (componentes de servidor, sem fetch no navegador)
                │
        validação de entrada (query.ts) ─ orçamento por visitante (limiter.ts, server.ts)
                │
   ncbi/service.ts · gbif/service.ts · dpdx/registry.ts   ← contratos normalizados + procedência
                │            │
   ncbi/client.ts   gbif/client.ts   (zod no esquema; hosts fixos)
                └────┬────┘
                  http.ts  → host allowlist · sem redirecionamento · timeout · teto de bytes ·
                              tentativas limitadas · limitador por provedor · cache (cache.ts)
```

| Requisito | Implementação |
|---|---|
| Clientes tipados + validação em tempo de execução | `zod` em `esearch`, `esummary`, `species/match`, `occurrence/search`, `dataset`; XML por extração explícita. Registro malformado vira exclusão contada, nunca dado. |
| Timeouts e tentativas | 8 s (NCBI) / 10 s (GBIF); 2 repetições com recuo exponencial e `Retry-After` (limitado a 2 s); 4xx não é repetido. |
| Limites de taxa | `ProviderLimiter` (espaçamento + concorrência + fila máxima) por provedor; `CallerBudget` de 20 consultas/min por visitante (cabeçalho de IP da plataforma, que sozinho não é confiável: o limitador e o cache seguram o upstream mesmo com cabeçalho forjado). |
| Cache/revalidação | `SciCache` em memória: TTL, LRU, deduplicação de chamadas simultâneas, *stale-if-error* de 1 h. NCBI 24 h (registro) / 6 h (busca); GBIF 24 h (identidade), 6 h (ocorrências), 7 d (conjunto). **`unavailable` nunca é cacheado; ambíguo/insuficiente continua ambíguo/insuficiente** (AC-CACHE-01, testado). |
| Estados | `verified`, `ambiguous`, `insufficient`, `not_found`, `invalid_query`, `unavailable` explícitos; `loading.tsx`, `Suspense` e `error.tsx` por rota. |
| Procedência | Todo resultado leva `provider`, `sourceUrl`, `sourceRecordIds`, `fetchedAt`, `adapterVersion`, `attribution`, `licenceOrRights`, `reasonCodes` (`types.ts`), exibidos em "Fonte e limitações". |
| Sem credenciais para provedores | Módulos científicos não importam Supabase nem cookies (teste estático). Cabeçalhos enviados: só `accept` e `user-agent`. |
| Sem URL arbitrária | O visitante só influencia **valores de parâmetros** (codificados). Host, protocolo e caminho são constantes; chave de táxon é inteiro, conjunto é UUID, país é ISO de 2 letras. |
| Publicação independente | Nenhum arquivo do CMS, do diário ou da homepage importa código científico (teste estático); **a homepage continua estática (`○ /`, revalidação 5 min)** no build. |

**Mapa:** escolhido um renderizador SVG próprio sobre Natural Earth 1:110m (domínio público, via `world-atlas`, só em desenvolvimento). Avaliados e descartados: Leaflet + tiles OSM (política de uso proíbe uso pesado, sem SLA, envia o IP do visitante a terceiro e exigiria afrouxar a CSP), MapLibre GL (≈ centenas de kB e precisa de fonte de tiles com termos próprios). O custo é ≈ 21 kB gzip na rota do mapa e nenhuma chamada externa do navegador.

## 5. Mapeamento de táxons entre fontes (`crosswalk.ts`)

Identificadores **não** são comparáveis (*Plasmodium falciparum*: TaxID NCBI 5833, chave GBIF 10540993). Cada fonte resolve o nome por conta própria; a ligação só é afirmada quando a identidade nominal confere.

| Acordo | Condição | Ligado? |
|---|---|---|
| `name_match` | mesmo nome aceito e mesmo nível | sim |
| `synonym_match` | nomes aceitos diferem mas o NCBI lista o nome da GBIF como sinônimo, mesmo nível | sim, com evidência |
| `rank_mismatch` | mesmo nome, níveis diferentes | não |
| `name_conflict` | nomes incompatíveis, sem sinonímia | não |
| `single_source` | uma fonte não resolveu | não |

Teste dedicado prova que números iguais nas duas fontes não ligam nada. Resultado real: 11 das 16 consultas deram `name_match`; as 5 restantes são `single_source` por motivos reais (§10).

## 6. Direitos das imagens (CDC DPDx)

- **Regra:** cada imagem é uma decisão. Exibida só se: sem crédito de terceiros na legenda, assunto fora das exceções do About, evidência com URL de página CDC, data de verificação, atribuição e **URL local** no padrão `/images/dpdx/<id>.jpg`. Falha fechado (`gateImage`).
- **Cópias locais sem alteração** de 8 JPEGs (4 a 67 kB cada), com `MANIFEST.json` (SHA-256, origem, data). Motivo: o Lighthouse mostrou que hot-link para o cdc.gov faz o navegador do visitante receber o cookie de terceiros `akamai_visit_id` (Best Practices 77). Cópias locais levaram a 100 e **removeram `cdc.gov` do `img-src` da CSP**. A política do CDC pede conteúdo inalterado e crédito: ambos mantidos; zoom é feito no navegador sobre a imagem original.
- **Exibidas (8):** *Giardia duodenalis* (cisto, iodo; trofozoíto, tricrômico), *Plasmodium falciparum* (formas em anel; gametócito), *Trypanosoma cruzi* (tripomastigota, Giemsa; amastigotas em tecido cardíaco, H&E), *Entamoeba histolytica* (cisto E. histolytica/E. dispar; trofozoíto com eritrócitos ingeridos).
- **Retidas (3, sem arquivo local):** `Giardia_troph_VT` (Vermont Department of Health Laboratory), `Pf_rings_thinF_AZPHL` (Arizona State Public Health Laboratory), `Ehistdisp_cyst_tric5_KS` (Kansas Department of Health and Environment). O site mostra o crédito literal e o link para a página original (AC-DPDX-03/04).
- **Ressalvas:** (a) revisão documental, não parecer jurídico; (b) a proprietária deve confirmar o uso; (c) revogar uma imagem é mudar `rights.status` no registro e apagar o arquivo; (d) a imagem do complexo *E. histolytica/E. dispar* é rotulada como complexo, como na legenda.

## 7. Experiências

### Atlas do Invisível — `/atlas`, `/atlas/[taxId]`
Busca GET (funciona sem JS) → nome exato/sinônimo/homônimo/sugestões por prefixo/não encontrado/inválido/indisponível. Registro: nome aceito com banner de sinônimo, categoria, TaxID, **hierarquia em anéis concêntricos + lista numerada clicável**, sinônimos, nomes comuns, autor e ano "como no NCBI" (pode ser de um sinônimo, e é dito), divisão GenBank, amostra de espécies abaixo de um grupo, ligação para GBIF/DPDx, fonte. Campos vazios aparecem como "não informado".

### Laboratório Interativo — `/laboratorio?organismo=`
Seleção de organismo; estágio diagnóstico, espécie e preparação em rótulos separados; legenda literal (inglês) e tradução marcada "a revisar"; zoom 1–4× por botões, teclado (`+ − 0` e setas), arrastar, pinça, duplo clique e Ctrl+roda; resolução nativa informada; fallback se a imagem falhar; lista de imagens retidas com motivo; texto de metodologia; aviso de uso educativo.

### Onde vivem? — `/onde-vivem?q=`
Resolve a identidade na GBIF; estados NONE/FUZZY/HIGHERRANK/família; amostra de até 75 registros por país entre os 4 países com mais registros (**não é amostra aleatória, e o texto diz**); valida cada registro; portão de suficiência (mínimo 10); mapa com agrupamentos, detalhe, incerteza desenhada e lista equivalente; barras de países com **contagem total**; **aviso de concentração** quando um conjunto de dados responde por ≥ 50% (real: 76% dos registros de *P. falciparum* vêm de um estudo hospitalar em Cotonou); citações dos conjuntos; painel de identidade nas duas fontes.

### Integração editorial
Menu: entrada **"Ciência interativa"** (`/ciencia`, com visão geral e princípios) e estado `aria-current` correto por rota; seção "Parasita em destaque" ganhou três atalhos discretos. Nenhum artigo do diário foi alterado e nenhuma chamada externa ocorre ao ler o diário.

## 8. Segurança e desempenho

| Item | Resultado |
|---|---|
| SSRF | Host/protocolo/caminho fixos; porta, credenciais e redirecionamento recusados; testes com 8 URLs hostis. |
| Entrada | 2–80 caracteres; letras, números, espaço, `- . ' ( )`; aspas, colchetes, curingas e operadores rejeitados; termo sempre vira frase `"…"[All Names]`. Teste com injeção `Giardia"[Subtree]`. |
| XML | DTD descartado, `<!ENTITY` rejeitado, profundidade 32, 40 mil nós. |
| Saída | Texto sempre escapado pelo React; nenhum HTML bruto; `references` do GBIF nunca vira `<a>`; links externos com `noopener noreferrer`. |
| Erros | Mensagem fixa em português; corpo/URL do provedor nunca exposto (teste). |
| Recursos | Corpo ≤ 1 MB (NCBI) / 5 MB (GBIF); ≤ 4 chamadas de amostra GBIF; nenhuma paginação profunda. |
| Falha injetável | `SCIENCE_FAULT` (só fora de produção, testado) simula timeout/429/erro/malformado/lento. |
| CSP | `connect-src` não inclui provedores; `img-src` voltou a `self` + Supabase. |
| Dependências | `npm audit --omit=dev`: **0 vulnerabilidades**. `npm audit`: 5 "high" na cadeia de desenvolvimento do ESLint (`@next/eslint-plugin-next → fast-glob → micromatch → braces`), **anterior a esta fase**, sem impacto em produção. |
| Lighthouse (build de produção) | `/atlas/5741` desktop: Acessibilidade 100, Boas práticas 100, SEO 60 (a página é `noindex` de propósito: consulta externa); `/onde-vivem` mobile: 100/100/100/100; `/laboratorio` mobile: 100/100/100/100. |
| Trace (mapa, build de produção, cache quente) | LCP 221 ms, CLS 0,00. |
| JS por rota (gzip, sem o cache do navegador) | `/` 181,5 kB · `/atlas/[id]` 184,1 kB (+2,6) · `/laboratorio` 187,3 kB (+5,8) · `/onde-vivem` 202,7 kB (+21,2). |
| Latência a frio medida (build de produção, cache vazio) | Atlas `/atlas/6252`: 0,63 s (registro + espécies, 3 chamadas NCBI espaçadas); mapa `/onde-vivem?q=…`: 3,5–3,9 s (identidade + cabeçalho + 4 países + citações). No script ao vivo, NCBI+GBIF por organismo: 2,5–7,3 s; *Aedes aegypti* 5,3 s depois de trocar a paginação profunda pela amostra por país (antes: erro por tempo esgotado). |

## 9. Testes

`npm test`: **172 testes, 172 passam** (73 da linha de base + 99 novos). `typecheck` e `lint` limpos; `next build` conclui; rotas dinâmicas `ƒ /atlas /atlas/[taxId] /laboratorio /onde-vivem`, `○ /ciencia`, `○ /` preservada.

| Arquivo | O que prova |
|---|---|
| `science-core.test.ts` (27) | validação de consulta, SSRF, 429/timeout/tamanho/tipo/JSON, cabeçalhos, limitadores, cache (single-flight, stale-if-error, LRU, não promove confiança), XML defensivo, injeção de falha desligada em produção |
| `science-ncbi.test.ts` (20) | registro real (5741) com linhagem e sinônimos; sinônimo aceito; homônimos (*Morganella*); nome idêntico vence sinônimo de outro táxon; não encontrado; consulta inválida sem rede; cache; falha 5xx não cacheada; esquema malformado; 429 |
| `science-gbif.test.ts` (23) | identidade (sinônimo, NONE, HIGHERRANK, FUZZY, família), chaves independentes, validação AC-GBIF-01..03, incerteza nula ≠ 0, licenças, propriedade de coordenadas (2.000 casos), registros reais, amostra por país sem paginação profunda, insuficiência, indisponibilidade |
| `science-dpdx.test.ts` (15) | decisões por imagem, falha fechado, URL fora do padrão, cópias locais com SHA-256 batendo com o manifesto, retidas sem arquivo, anotações dentro da legenda, mapeamento entre fontes |
| `science-security.test.ts` (14) | sem Supabase/sessão/HTML bruto/`fetch` no navegador, `rel` seguro, único ponto de rede, CSP, diário e CMS sem import científico, ordem das seis seções, sem migrações novas |

Fixtures: respostas **reais** gravadas por `scripts/capture-science-fixtures.mjs` em `tests/fixtures/science` (NCBI e GBIF). Os testes determinísticos não tocam a rede.

## 10. Evidência com respostas reais

`node scripts/verify-phase22-live.mjs` executou os **mesmos módulos do site** contra os provedores em 2026-10-11 (`docs/evidence/phase22/live-validation.json`):

| Consulta | NCBI | GBIF | Ocorrências GBIF | Mapeamento | DPDx |
|---|---|---|---|---|---|
| *Giardia lamblia* | sinônimo aceito → *Giardia duodenalis* (5741) | sinônimo → *G. duodenalis* (8562913) | 205 de 489 | name_match | 2 exibidas, 1 retida |
| *Giardia duodenalis* | exato (5741) | exato (8562913) | 205 de 489 | name_match | idem |
| *Plasmodium falciparum* | exato (5833) | exato (10540993) | 300 de 7.245 | name_match | 2 / 1 |
| *Plasmodium vivax* | exato (5855) | **não encontrado** | — | single_source | — |
| *Trypanosoma cruzi* | exato (5693) | exato (8205154) | 241 de 2.088 | name_match | 2 / 0 |
| *Entamoeba histolytica* | exato (5759) | exato (3210505) | 118 de 5.292 | name_match | 2 / 1 |
| *Leishmania infantum* | exato (5671) | exato (9442158) | 140 de 477 | name_match | — |
| *Toxoplasma gondii* | exato (5811) | exato (8014281) | 242 de 242 | name_match | — |
| *Schistosoma mansoni* | exato (6183) | exato (5967489) | 300 de 5.583 | name_match | — |
| *Ascaris lumbricoides* | exato (6252) | exato (4558786) | 266 de 496 | name_match | — |
| *Aedes aegypti* | exato (7159) | exato (1651891) | 300 de 121.379 | name_match | — |
| *Naegleria fowleri* | exato (5763) | exato (3210448) | **insuficiente: 8 de 10** | name_match | — |
| *Trichomonas vaginalis* | exato (5722) | **incerto: só o gênero (HIGHERRANK)** | — | single_source | — |
| *Morganella* | **ambíguo: 3 homônimos** (insetos, fungos, bactérias) | não encontrado | — | single_source | — |
| *Giardia* | exato, gênero (5740); "também aparece como sinônimo de *Anceyoconcha*" | não encontrado | — | single_source | — |
| *Xyzzyfoo bar* | não encontrado | não encontrado | — | single_source | — |

Leituras que importam:
- **Nome aceito mudou:** o NCBI hoje chama TaxID 5741 de *Giardia duodenalis*; *G. lamblia* e *G. intestinalis* são sinônimos. A seção "Parasita em destaque" usa *Giardia lamblia*.
- **Os provedores discordam:** *P. vivax* existe no NCBI e não casa na GBIF; a classificação superior de *P. falciparum* difere (Chromista/Myzozoa na GBIF). O site mostra a divergência em vez de forçar uma ligação.
- **Exclusões reais = 0** nas amostras: os filtros do lado do servidor (`hasCoordinate`, `hasGeospatialIssue`, `PRESENT`) já removem os registros inválidos. O validador é provado por testes com registros reais corrompidos de propósito (coordenadas fora de faixa, flags, táxon, licença). `TAXON_MATCH_HIGHERRANK` aparece em 283 de 300 registros de *T. cruzi* mesmo com `taxonRank=SPECIES`: é tratado como **informativo e preservado**, não como erro.
- **Concentração:** 76% dos registros de *P. falciparum* vêm de um único conjunto de dados (estudo hospitalar em Cotonou, Benin), e 99% dos de *E. histolytica* têm Benin como país (5.247 de 5.292); o mapa avisa quando um conjunto passa de 50% e a lista de países mostra a contagem total.

## 11. QA no navegador

| Verificação | Resultado |
|---|---|
| 1440 / 768 / 390 / 320 px | Sem rolagem horizontal em 9 rotas × 4 larguras (medido). Dois defeitos achados e corrigidos: botão com `nowrap` estourando a coluna em 320 px e vista inicial do mapa em 390 px cortando os pontos. |
| Teclado | Ordem de Tab lógica (pular conteúdo → menu → sub-navegação → busca → hierarquia); anéis fora da ordem de Tab; foco visível de 3 px em todos os alvos medidos, inclusive no mapa e no visualizador. Mapa: setas, `+ − 0`. Visualizador: `+ − 0`, setas. |
| Movimento reduzido | Transição da imagem 140 ms → 0,001 ms; sem animação ambiente; rolagem `auto`. |
| Estados | Vazio, inválido (`<script>`, aspas, TaxID no mapa), válido, não encontrado, ambíguo, FUZZY, HIGHERRANK, família, insuficiente, carregando (esqueleto), **provedor fora do ar** (`timeout`, NCBI **e** GBIF, um não derruba o outro), **lento** (esqueleto visível durante 4 s), **imagem falha** (fallback com link da fonte). Nenhum HTML refletido. |
| Controles | Mapa: `+`, `−`, ajustar, mundo todo, clique em agrupamento (1,0× → 9,4×), mostrar na lista → detalhe, paginação. Visualizador: 1× → 4×, pan por arrastar, miniaturas, "Fonte e limitações". |
| Diário e homepage com provedor fora do ar | Carregam normalmente (`/` e `/diario`). |
| Links externos | NCBI `wwwtax.cgi?id=5741` → HTTP 200. **gbif.org e doi.org→gbif.org responderam com desafio anti-robô ("Um momento…", 403) e não foram verificados; não houve tentativa de contornar.** Os padrões de URL seguem a documentação pública, mas a verificação visual fica com a proprietária. |
| Console | Sem erros nas páginas (os únicos erros vieram das requisições abortadas de propósito no teste de falha de imagem). |

Capturas em `docs/evidence/phase22/` (nenhuma contém dados privados; só dados públicos dos provedores): `atlas-5741-1440`, `atlas-768/390/320`, `atlas-homonym-1440`, `atlas-loading`, `lab-1440/768/390/320`, `lab-image-failure`, `map-pfalciparum-1440`, `map-768`, `map-390`, `map-frame`, `map-focus`, `map-insufficient-320`, `ciencia-1440`, `home-featured-1440`, relatórios Lighthouse e `trace-mapa.json.gz`.

## 12. Status de revisão científica (separado do sucesso de engenharia)

| Item | Status |
|---|---|
| Identidades, sinônimos, linhagens e contagens | Reproduzem o que as fontes devolvem; **não revisados por especialista** em taxonomia. |
| Legendas do CDC | Literais; conferidas contra a página no navegador em 2026-10-11. |
| Traduções para o português | Tradução livre de engenharia, **marcadas "a revisar"**; pendentes de revisão da autora. |
| Rótulos de estágio/preparação | Termos padrão derivados das legendas; pendentes de revisão da autora. |
| Textos explicativos do Atlas/mapa | Descrevem limitações dos dados, sem afirmações clínicas; pendentes de revisão da autora. |
| Seleção das 8 imagens | Critério: sem crédito de terceiros e cobertura de espécie/estágio; **a escolha final é da autora**. |
| Parecer jurídico de reuso | **Não realizado.** |

## 13. Limitações conhecidas e decisões pendentes

1. **DPDx:** fonte com 300 × 300 px (ampliar não acrescenta detalhe); só 4 organismos; revisão manual; sem parecer jurídico. Manter o registro atualizado é trabalho humano (páginas do CDC têm datas de revisão de 2019 a 2024).
2. **Licença GBIF (decisão da proprietária):** CC BY-NC é aceito porque o site é divulgação científica sem fins comerciais. Se houver uso comercial, remover `CC_BY_NC_4_0` de `GBIF_ACCEPTED_LICENCES` (`src/lib/science/config.ts`); *T. cruzi* perderia ≈ 91% dos registros.
3. **Limiar do mapa (decisão da proprietária):** `minReliableOccurrences = 10` é padrão de engenharia, não valor de produto.
4. **Amostra do mapa:** os 4 países com mais registros, sem sorteio; viés é dito na tela. Sem paginação profunda por custo medido (§3).
5. **Cache em processo:** em ambientes serverless cada instância tem o seu; o teto por provedor vale por instância. O Next Data Cache poderia compartilhar entre instâncias (trabalho futuro).
6. **Orçamento por visitante** usa `x-forwarded-for`; o limitador do provedor e o cache protegem o upstream mesmo se o cabeçalho for forjado. Rastreadores podem gerar muitas consultas; as páginas dinâmicas são `noindex`, mas isso não impede o rastreamento. Não há `robots.txt` no projeto.
7. **NCBI Taxonomy:** "descendentes" é uma amostra (até 40 de N espécies); não há navegação para "filhos diretos" porque `[Next Level]` não existe nas E-utilities.
8. **E-mail de contato NCBI:** não configurado, aguardando e-mail verificado da proprietária (recomendado, não obrigatório).
9. **Nome em destaque:** a homepage usa *Giardia lamblia*; o nome aceito hoje é *Giardia duodenalis*. O Atlas explica a relação; a troca do texto da homepage é decisão da proprietária.
10. **`yarn.lock`** não foi atualizado para os dois pacotes de desenvolvimento novos (só `package-lock.json`); o repositório mantém os dois arquivos.
11. **Encerramento da Fase 2.1 (inalterado, em aberto):** limpeza remota de dados de teste, sonda remota com não-proprietário e smoke test. O CMS **não** é tratado como aprovado para produção; nada disso bloqueou o desenvolvimento de leitura desta fase.

## 14. Dependências novas e conformidade com custo zero

| Dependência | Tipo | Licença | Uso |
|---|---|---|---|
| `world-atlas@2.0.2` | devDependency | ISC (dados Natural Earth, domínio público) | só em `scripts/build-world-map.mjs`; gera `src/content/world-map.ts` |
| `topojson-client@3.1.0` | devDependency | ISC | idem |

Nenhuma dependência de execução nova. `tsconfig.json`: `allowImportingTsExtensions` (importações `.ts` compartilhadas entre Next e `node --test`). Sem serviços pagos, sem chave obrigatória, sem token de mapa, sem tiles, sem novo projeto Supabase, sem migração. Variáveis novas (`NCBI_API_KEY`, `NCBI_CONTACT_EMAIL`, `SCIENCE_FAULT`) são opcionais e documentadas em `.env.example`.

## 15. Estado da árvore Git (nada commitado)

- **Novos:** `src/lib/science/**`, `src/components/science/**`, `src/app/{atlas,ciencia,laboratorio,onde-vivem}/**`, `src/components/header/NavLinks.tsx`, `src/content/world-map.ts`, `public/images/dpdx/**` (8 JPEGs + manifesto), `tests/science-*.test.ts`, `tests/fixtures/science/**`, `tests/helpers/science.ts`, `scripts/{build-world-map,capture-science-fixtures,import-dpdx-images,verify-phase22-live}.mjs`, `docs/evidence/phase22/**`, este relatório.
- **Alterados nesta fase:** `src/content/site.ts` (1 entrada de menu), `src/components/header/{SiteHeader,MobileNav}.tsx` (estado de página atual), `src/components/featured/FeaturedParasite.{tsx,module.css}` (3 atalhos), `next.config.ts` **sem mudança líquida** (o `img-src` ganhou e perdeu `cdc.gov` no mesmo dia; a CSP final é a da linha de base), `tests/content.test.ts` (menu), `tsconfig.json`, `package.json`/`package-lock.json`, `.env.example`, `CLAUDE.md` (ponteiro), `docs/art-direction-decisions.md`.
- As demais modificações listadas por `git status` (CMS, hero, diário, etc.) são das fases anteriores e foram preservadas.
