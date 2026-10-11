# Fase 1 — Relatório de QA da homepage

Data: 2026-10-10. Referência: `docs/reference/homepage-reference.png` (presente e inspecionada).
Evidências: `docs/evidence/phase1/`.

## Veredito: **PARTIAL**

A homepage está implementada, responsiva, funcional e verificada em navegador real. **Não é PASS** porque a seção principal, o Hero sobre a Ynara, não pode ser aprovada visualmente enquanto o retrato for um placeholder, porque toda a microscopia é ilustração gerada em código (não fotografia), e porque três decisões de direção ainda são da proprietária. O que bloqueia o PASS é conteúdo e decisão, não defeito de código conhecido. Detalhes em "Defeitos visuais remanescentes".

> A crítica abaixo é **autoavaliação**: foi feita pelo mesmo agente que implementou. Nenhum revisor independente nem Codex foi usado. Os números de 0 a 100 são apoio de revisão, não prova de qualidade.

## O que foi entregue

| Item | Estado |
|---|---|
| Homepage com as 6 seções na ordem fixa | implementada |
| Rota `/diario` (índice) e `/diario/[slug]` (3 posts) | implementada |
| Conteúdo tipado separado da apresentação (`src/content/*`) | implementado |
| Fronteira para a experiência cinematográfica (`src/cinematic/`) | contrato + ponto de montagem; **sem runtime** |
| `docs/phase1-visual-spec.md`, este relatório, decisões em `docs/art-direction-decisions.md` | escritos |

## O que é funcional, mockado e adiado

| Funcional (testado em navegador) | Mockado / provisório | Adiado de propósito |
|---|---|---|
| Navegação por âncoras e rotas, menu mobile | Retrato: silhueta genérica rotulada | Backend de curtidas e comentários (hoje `localStorage`, por navegador) |
| Lente: ponteiro, toque, teclado | Microscopias: ilustrações SVG geradas em código | Experiência WebGL de "Explore o Invisível" (só ponto de montagem) |
| Curtir/descurtir, contagem, persistência | Posts do diário: 3 exemplos rotulados | CMS, autenticação, banco de dados |
| Comentar, validar, listar, remover, persistência | Parasita: *Giardia lamblia*, provisório | Dados reais da trajetória |
| Links para LinkedIn (nova aba), 404 em português | E-mail de contato: `null` ("a ser informado") | Página "Recursos", "ver todos os destaques" |
| Contagem de comentários refletida na home | Marca gráfica: aglomerado celular provisório | Modo escuro, i18n, OG images, sitemap, analytics |

Likes e comentários **funcionam de verdade** para quem usa, mas **não são compartilhados** entre pessoas. A interface diz isso onde a ação acontece ("Protótipo: fica salvo apenas neste navegador").

## Resultados de build, tipos e testes

| Verificação | Resultado |
|---|---|
| `npm run typecheck` (`tsc --noEmit`) | passou, sem erros |
| `npm test` (`node --test`) | **14/14** passaram (`tests/engagement.test.ts`, `tests/content.test.ts`) |
| `next build` (Next.js 16.4.0, Turbopack) | compilou; 8 páginas estáticas (`/`, `/diario`, 3 posts, `/_not-found`, `/icon.svg`) |
| `npm audit` | 0 vulnerabilidades |
| JS+CSS enviados (todas as rotas) | 16 arquivos, 632,6 KB brutos, 195,3 KB gzip |
| Three.js / GSAP no bundle | nenhuma ocorrência (verificado em `.next/static`) |

Build bem-sucedido não é prova de qualidade visual; a verificação visual está abaixo.

## Medições reais (build de produção, `next start`, localhost)

Ferramenta: Chrome DevTools MCP. A categoria *Performance* do Lighthouse não é exposta por essa ferramenta, então **nenhuma nota de performance do Lighthouse é afirmada**. Medi por trace.

| Medição | Desktop 1440 (sem limitação) | Mobile 390×844 @3x, CPU 4×, Fast 4G |
|---|---|---|
| LCP | 399 ms (TTFB 18 ms, atraso de render 381 ms) | 1466 ms (TTFB 19 ms, atraso de render 1447 ms) |
| CLS | 0,00 | 0,00 |
| Lighthouse Acessibilidade / Boas práticas / SEO | 100 / 100 / 100 | 100 / 100 / 100 |
| Auditorias reprovadas | 0 | 0 |

- Rede (home): 16 requisições, todas 200, todas na mesma origem; fontes self-hosted (2 arquivos woff2). Nenhum recurso de terceiros.
- Console: sem mensagens (DevTools) e sem erros/avisos (Playwright, home, 3 larguras e página de post).
- Observação do trace: insight "LegacyJavaScript" aponta 14,4 kB de transpilação do próprio Next; não tratado.
- Ordem das medições: os **traces** foram feitos em um build anterior a duas edições cosméticas finais (escala do esquema da giárdia e figura do detalhe do post) e não foram repetidos. **Lighthouse e console** foram refeitos no build final (mesmos resultados: 100/100/100, 0 reprovadas, console vazio).
- Limites: localhost não mede latência real; não houve dispositivo físico.
- Traces brutos: `trace-desktop-prod.json.gz`, `trace-mobile-throttled-prod.json.gz`. Relatórios: `lighthouse-desktop/`, `lighthouse-mobile/`.

## Testes funcionais e de acessibilidade executados

| Teste | Resultado |
|---|---|
| Curtir na home: 0 → 1, `aria-pressed` verdadeiro, mantido após recarregar | passou |
| Abrir post pelo título, comentar com nome e texto de 2 linhas | passou |
| Comentário vazio: mensagem de erro em `role="alert"` | passou |
| Comentário persiste após recarregar; contagem aparece na home | passou |
| Remover comentário | passou |
| Curtida do post conserva o estado entre home e detalhe | passou |
| Rotas `/`, `/diario`, 2 posts: 200; slug inexistente: 404 com página própria | passou |
| Primeiro `Tab` vai para "Pular para o conteúdo" | passou |
| Lente por teclado: foco, setas movem, Esc recolhe, anel de foco 3 px | passou |
| Lente por toque (CDP, `hasTouch`): ativa, acompanha o dedo, recolhe ~1,1 s após soltar | passou |
| `prefers-reduced-motion: reduce`: animação de carregamento = `none`, rolagem suave desligada | passou |
| Fontes carregadas: Plus Jakarta Sans 200–800, Caveat 400–700 | passou |
| Sem rolagem horizontal em 1440, 768 e 390 (`scrollWidth == viewport`) | passou |

## Screenshots

**Efetivamente inspecionadas (abertas e analisadas):**
`hero-1440-v1`, `hero-1440-v2`, `hero-desktop-1440-v2`, `hero-lens-hover-1440`, `hero-mobile-390-v1`, `hero-mobile-390-v2`, `hero-tablet-768-v1`, `hero-stage-mobile-390-v3`, `trajetoria-desktop-1440-v1/v2`, `trajetoria-mobile-390-v1`, `trajetoria-tablet-768-v3`, `diario-desktop-1440-v1/v2`, `diario-mobile-390-v1`, `parasita-desktop-1440-v1/v2`, `explore-desktop-1440-v1`, `explore-mobile-390-v1`, `footer-desktop-1440-v1`, `home-fullpage-desktop-1440-v1`, `final-hero-1440`, `final-lens-keyboard-1440`, `final-post-detail-1440`, e fatias do full-page mobile (390) e tablet (768).

**Capturadas, mas não revisadas visualmente:** `hero-lens-keyboard-1440`, `hero-lens-touch-390` (a lente por toque foi validada por estado do DOM, não por imagem), `hero-tablet-768-v2`, `parasita-mobile-*`, `footer-mobile-390-v1`, `diario-mobile-390-v2`, `trajetoria-mobile-390-v2`, `final-hero-768`, `final-hero-390`, `final-home-*-full`, `final-post-detail-390`. Existem como evidência, sem afirmação sobre elas.

**Nunca capturado:** Safari, Firefox, dispositivo físico, leitor de tela, modo de alto contraste, impressão.

## Defeitos encontrados e corrigidos

| # | Problema | Severidade | Causa raiz | Correção | Verificação |
|---|---|---|---|---|---|
| 1 | Erro de hidratação no console | alta | `Math.cos/sin` com último dígito diferente entre servidor e cliente nas coordenadas SVG | arredondar para 2 casas | console limpo (`hero-1440-v2`) |
| 2 | Favicon 404 | baixa | ausente | `src/app/icon.svg` | rede sem 404 |
| 3 | Palco do hero: microscópio escondido atrás do campo, anotação sobre o microscópio, legenda do retrato cortada, selo ilegível (`hero-1440-v1`) | alta | posições em % sem checar sobreposição | recomposição do palco, selo maior | `hero-1440-v2`, `final-hero-1440` |
| 4 | Mobile: CTA do cabeçalho visível, botão de menu empurrado para fora, rolagem horizontal (443 px > 375 px) (`hero-mobile-390-v1`) | alta | `.btn` global vence `.cta` do módulo na cascata | seletor de maior especificidade | `scrollWidth == viewport` em 3 larguras |
| 5 | Trajetória: "Período a informar" em escala de manchete ×4 e blocos de imagem hachurados (`trajetoria-desktop-1440-v1`) | média | pendência tratada como destaque | hierarquia invertida: o marco é o título, período pendente discreto, espaço de imagem quieto | `trajetoria-desktop-1440-v2` |
| 6 | Blocos de imagem desalinhados quando o título quebra | média | colunas sem alinhamento à base | flex com `margin-top: auto` | `trajetoria-desktop-1440-v2` |
| 7 | Diário: título do destaque em 4 linhas, vazio sob o índice (`diario-desktop-1440-v1`) | média | escala do título e entradas pequenas | escala menor, miniaturas 4:5 | `diario-desktop-1440-v2` |
| 8 | Giárdia lida como inseto/máscara: flagelos como patas, núcleos como olhos de desenho animado, corpos medianos como "boca" | média | traço grosso, flagelos laterais, barras horizontais | flagelos posteriores e ondulados, núcleos tingidos, corpos medianos em vírgula | `parasita-desktop-1440-v2` |
| 9 | Parasita: vazio sob colunas esquerda e central (`parasita-desktop-1440-v1`) | média | ficha longa em uma coluna | fatos viram faixa de 5 colunas sob as três zonas | `parasita-desktop-1440-v2` |
| 10 | "Explore o / invisível" com "o" órfão | baixa | quebra automática | linhas explícitas | visto corrigido na fatia mobile do build de produção; desktop não reconferido em imagem |
| 11 | Lighthouse `label-content-name-mismatch` no link da marca | média | `aria-label` não contém o texto visível | nome acessível = texto visível | 0 auditorias reprovadas, desktop e mobile |
| 12 | Mobile: anotação manuscrita colide com os campos (`hero-stage-mobile-390-v3`) | baixa | palco estreito | oculta abaixo de 560 px | verificado em código; `final-hero-390` capturada, não revisada |
| 13 | Tablet: rótulo cortado nos espaços de imagem; largura desperdiçada | baixa | altura fixa curta; 1 coluna | `min-height`, 2 colunas entre 640 e 899 px | `trajetoria-tablet-768-v3` (rótulo cortado visto antes da correção; corrigido depois **sem nova captura revisada**) |
| 14 | Detalhe do post: esquema da giárdia ampliado e cortado em largura total | média | `slice` em proporção 16:8 | esquema 17% menor na placa, figura limitada a 60 rem, 16:9 | `final-post-detail-1440` (parte superior vista) |

Itens 10, 12, 13 e 14 têm verificação parcial, declarada na coluna.

## Crítica visual (autoavaliação)

| Critério | Nota | Justificativa |
|---|---|---|
| Identidade visual | 78 | Paleta, tipografia e lente coerentes e reconhecíveis. Sem retrato e sem fotografia real, a marca não tem rosto. |
| Fidelidade à referência | 62 | Composição, ordem, paleta e linguagem batem. Diverge de propósito: sem foto, sem faixa de números, sem grade de 3 cards, sem render 3D, sem ícones de atributo. |
| Qualidade de composição | 80 | Cada seção tem estrutura própria (capa, trilho, periódico, três zonas + ficha, campo de visão). |
| Tipografia | 82 | Uma família com intenção, escala clara, nome científico em itálico por convenção. Título do detalhe do post (≈83 px em 3 linhas) é pesado. |
| Imagens | 45 | Honestas e nítidas sob a lente, mas são ilustrações de código. Não substituem microscopia real. |
| Originalidade | 72 | Hero como lente, diário como periódico e faixa de ficha fogem do kit padrão. O microscópio em traço é a parte mais "ícone". |
| Layout responsivo | 80 | Sem overflow, composição própria no mobile. Parte do tablet e do mobile não foi revisada em imagem (ver Screenshots). |
| Qualidade de interação | 78 | Lente por três modos, curtir/comentar completos. Sem testes em dispositivo físico. |
| Acessibilidade | 88 | Lighthouse 100, teclado, foco, movimento reduzido verificados. Sem teste com leitor de tela. |
| Qualidade técnica | 85 | Tipos, testes, build, 0 vulnerabilidades, sem dependências de UI. Estado em `localStorage` é prototipagem assumida. |

## Anti-AI-slop: as 10 perguntas

1. **Poderia ser confundida com landing page genérica de IA?** Não no hero (microscópio, lente e campos em escalas diferentes não são kit). Risco residual: o microscópio em traço é uma imagem previsível para o tema.
2. **Cada seção tem propósito compositivo distinto?** Sim: capa assimétrica, trilho horizontal, destaque + índice, três zonas + faixa de ficha, campo de visão circular escuro.
3. **O hero é memorável?** Parcialmente. A composição é; sem o retrato real, falta o elemento humano que o brief pede.
4. **Imagens autênticas ou rotuladas?** Todas rotuladas (selo "Ilustração de exemplo", legenda de origem, alt descritivo). Nenhuma autêntica ainda.
5. **Tipografia demonstra direção de arte?** Sim: peso 800 com tracking apertado, hierarquia por escala, manuscrito só como anotação.
6. **Coerente sem repetição?** Sim; a repetição que existe (4 marcos pendentes) é do conteúdo.
7. **Mobile com composição própria?** Sim: título → palco → ações; trilho vertical; entradas com miniatura. Anotação do hero suprimida.
8. **Microinterações significativas?** Lente revela detalhe real da imagem; curtir confirma estado. Nada decorativo contínuo.
9. **Reforça credibilidade científica?** Em parte: texto cauteloso, legendas honestas, avisos. Imagens geradas e esquema não revisado limitam a credibilidade até a troca por material real.
10. **Distinta sem animações?** Sim; a identidade é de composição e tipografia.

## Defeitos visuais remanescentes

| # | Defeito / limite | Severidade | Dependência |
|---|---|---|---|
| R1 | Hero sem retrato real (silhueta) | alta | foto da Ynara |
| R2 | Microscopias são ilustrações de código; o esquema da giárdia é simplificado e não foi revisado por especialista; em escala grande lê-se como diagrama | alta | acervo real e revisão da autora |
| R3 | Trajetória 100 % pendente (LinkedIn respondeu HTTP 999) | alta | dados fornecidos pela autora |
| R4 | Faixa de stats, grade de 3 cards e eyebrows decididas de forma conservadora, sem aprovação | média | decisão da proprietária |
| R5 | Selo circular do hero com texto pequeno (≈ 11–12 px) | baixa | decisão de tamanho |
| R6 | Título do detalhe do post pesado | baixa | ajuste de escala |
| R7 | Capturas não revisadas (lista acima) | baixa | nova rodada de QA |

## Conteúdo ainda necessário

1. Retrato profissional da Ynara (recorte com fundo transparente é o ideal).
2. Fotografias reais de microscopia, com legenda de origem (laboratório, amostra, aumento).
3. Dados reais da trajetória: formação, atuação, datas, instituições, imagens.
4. Posts reais do Diário de Bancada.
5. Escolha do parasita em destaque e revisão científica do texto.
6. Contato (e-mail) e redes confirmadas.
7. Decisões: faixa de números, forma do Diário, eyebrows, nome da marca gráfica, textos da navegação.
8. Para a fase cinematográfica: elenco de organismos e roteiro.

## Reprodução

```bash
npm install
npm run dev          # http://localhost:3000
npm run typecheck
npm test
npm run build && npm start
```

---

# Diary Feed — aceite final (escopo do protótipo)

Data: 2026-10-10. Escopo: feed do Diário de Bancada (destaque + publicações anteriores), rota `/diario`, link no rodapé, curtidas e comentários locais. **Não é um veredito sobre o site inteiro.**
Build testado: `next build` de produção servido por `next start`, depois da última alteração (link do rodapé). Evidências: `docs/evidence/diary-feed/`.

## Veredito do Diary Feed: **PASS**

Todas as verificações pedidas passaram no escopo atual. O site como um todo **continua PARTIAL** (ver "Problemas fora do escopo do feed" e as dependências de conteúdo acima). Este PASS não declara o site pronto para produção.

## Alteração feita nesta rodada

| Arquivo | Mudança |
|---|---|
| `src/components/footer/SiteFooter.tsx` | novo item "Arquivo do diário" → `/diario` na navegação do rodapé |
| `src/components/footer/SiteFooter.module.css` | `.nav a.archive`: cor `--ink-soft`, peso 500 |

Nenhuma outra alteração de código, layout, ordenação ou conteúdo. A seção `#diario` da home não contém "Ver todos os posts"; o único link para `/diario` na home está no rodapé.

## Verificações

| # | Verificação | Resultado | Evidência |
|---|---|---|---|
| 1 | Layout, ordenação, feed vertical (desktop) e horizontal (mobile/tablet) preservados | passou | `diario-section-{1440,768,390}-final.png` |
| 2 | `/diario` disponível como arquivo completo | passou: 200, h1 "Diário de Bancada", 3 artigos, navegado pelo link do rodapé | navegação real |
| 3 | Link discreto no rodapé; CTA redundante não voltou | passou: 44 px de altura, contraste 7,22:1, foco de 3 px | `footer-{1440,768,390}-final.png`, `footer-link-focus-*.png` |
| 4 | Screenshot em 768 px depois do CSS final | feita | `diario-768-final.png`, `diario-section-768-final.png`, `footer-768-final.png` |
| 5 | 1440 e 390 contra o build mais recente | feitas; sem rolagem horizontal (`scrollWidth` = viewport; os valores 1425/375/753 do Playwright são a barra de rolagem de 15 px) | `diario-{1440,390}-final.png` |
| 6 | Foco visível por teclado | passou: ordem lógica Título → curtir → comentários → "Próxima" → região do feed → entradas; anel de 3 px em todos os pontos de parada nas 3 larguras. Imagens revisadas: 390 (título, "Próxima", região, entrada), 768 ("Próxima", entrada), 1440 (entrada), rodapé nas 3 larguras. Os demais quadros têm só o estilo computado conferido | `focus-{1440,768,390}-NN.png` |
| 7 | `prefers-reduced-motion: reduce` | passou: com `no-preference` o botão "Próxima" anima (scrollLeft 27 px aos 40 ms, 324 px ao fim); com `reduce` salta direto para 324 px. `matchMedia` confirmado nos dois casos; "anterior" volta a 0 nos dois | script Playwright (sem imagem) |
| 8 | Estilos renderizados e console (Chrome DevTools) | passou: console vazio; 21 requisições, todas 200, mesma origem. Feed em 390: `overflow-x:auto`, `overflow-y:hidden`, `scroll-snap-type:x mandatory`, `overscroll-behavior-x:contain`, `overscroll-behavior-y:auto`, `tabindex=0`, `role=region` nomeada. Em 1440: `overflow-y:auto`, `overscroll-behavior-y:auto` | DevTools `evaluate_script`, `list_console_messages`, `take_snapshot` |
| 9 | Contraste e alvos de toque | passou: 18 combinações texto/fundo na seção e no rodapé, mínimo 6,45:1 (exigido 4,5:1). Controles do feed e de engajamento com 44×44 px ou mais. Ver ressalvas F1 e F3 | DevTools em 390 com `hasTouch` |
| 10 | `npm run typecheck` | passou, sem erros | |
| 10 | `npm test` | **23/23** passaram | |
| 10 | `npm run build` | compilou; 8 páginas estáticas | |

### Regras do feed

| Verificação | Resultado |
|---|---|
| Publicação mais recente sempre em destaque | passou. `tests/diary.test.ts`: ordenação independente da ordem de entrada, desempate por hora, id numérico e slug; nova publicação assume o destaque e a anterior vai ao topo do feed. No navegador o destaque é o post de 10 de out. |
| Anteriores sem duplicação e sem limite | passou (teste com 12 posts: destaque + 11, sem repetição; ids repetidos colapsam). No navegador o feed tem 2 entradas e nenhuma repete o destaque |
| Rascunhos excluídos | passou (teste unitário; o mesmo filtro vale para `/diario` e `/diario/[slug]`). Não há rascunho em `posts.ts` |
| Gestos móveis não prendem a rolagem vertical | passou, com toque via CDP em 390 px: deslize vertical sobre o feed rolou a página (3361 → 3510) sem mover o feed; horizontal moveu o feed (0 → 324) sem mover a página; diagonal predominantemente vertical rolou a página. Desktop: roda dentro do feed rola o feed (0 → 300); no fim do feed a roda passa para a página (1943 → 2143 → 2343); no início, a roda para cima rola a página (1943 → 1643) |
| Curtidas e comentários com a limitação local | passou: curtir persiste após recarregar, descurtir volta a 0, curtida de entrada do feed funciona, comentário criado no post aparece e a contagem aparece na home. Armazenamento: `localStorage` (`microcosmos.engagement.v1`), por navegador; a seção diz isso |
| Nenhum fixture de QA em conteúdo de produção | passou: `src/content/posts.ts` tem só 3 entradas `post-demo-*` rotuladas; busca por "fixture/qa/draft" em `src` e `public` só encontra o filtro `isPublished` e o tipo. `localStorage` do navegador de teste foi limpo. O teste de overflow desktop injetou itens só no DOM do navegador, sem persistir |

### Limites do teste (declarados)

- O overflow do feed desktop e a roda do mouse foram testados com entradas clonadas no DOM (16 itens), porque o conteúdo real tem 2 entradas anteriores e não transborda em 1440. Efeito colateral do clone: o contador "k de N" usa o `count` do servidor e mostrou "de 2". Não é defeito.
- Com 2 entradas em 1440 o feed não rola; o cabeçalho mostra "1 de 2" e os botões ficam escondidos por não haver overflow. Comportamento esperado.
- Um clique feito imediatamente após `reload`, antes da hidratação, é reexecutado pelo React depois dela; com a página hidratada o estado muda no mesmo quadro.
- Sem Safari, Firefox, dispositivo físico (toque emulado por CDP), leitor de tela real nem modo de alto contraste. Sem trace de performance nesta rodada (a única mudança de renderização é um link).
- `diario-1440-feed-scrolled-qa-clone.png` mostra o feed com entradas clonadas e serve só como evidência dos botões e sombras de borda em desktop. Não representa conteúdo publicado.

## Ressalvas do feed (não bloqueiam o PASS)

| # | Item | Severidade | Tipo |
|---|---|---|---|
| F1 | Borda dos botões anterior/próximo (`rgba(33,31,32,.32)` sobre `#F2F2F2`) tem cerca de 2:1. O botão é identificado pela seta (14,6:1) e o desabilitado é isento, então atende; borda a 3:1 seria mais robusta | baixa | decisão de design |
| F2 | Em 768 px, "Ler o artigo" das entradas cai abaixo da linha de curtir/comentar. Legível e alinhado à coluna de texto | baixa | cosmético |
| F3 | Link da marca no cabeçalho com 40 px de altura e "Início" no rodapé com 32 px de largura: acima do mínimo de 24 px (WCAG 2.5.8 AA), abaixo de 44 px. Fora do feed | baixa | preexistente |

Nenhum defeito funcional aberto no feed.

## Problemas fora do escopo do feed (o site continua PARTIAL)

**Conteúdo placeholder ou dependente da autora (já documentado):**
- Posts do Diário são exemplos rotulados; imagens são ilustrações geradas em código; retrato real, microscopias reais, trajetória, parasita em destaque, e-mail e posts reais continuam pendentes.
- Curtidas e comentários são locais por navegador até existir backend, banco e autenticação (não implementados nesta tarefa, como pedido).

**Defeito de conteúdo encontrado nesta rodada (fora do feed, não corrigido por estar fora do escopo):**
- **Hero com métricas sem rótulo de exemplo**: `src/components/hero/Hero.tsx:55-73` exibe "+100 pessoas inspiradas", "+50 conteúdos publicados" e "1 mesmo propósito" como "Métricas do projeto". São números da imagem de referência, não dados confirmados pela autora. Isso contradiz a decisão registrada ("sem faixa de números") e a regra de não fabricar dados. Exige decisão da proprietária: remover, rotular como exemplo ou substituir por dado verificado. Bloqueia qualquer PASS do Hero e da homepage.
- O relatório da Fase 1 (acima) descreve um Hero anterior; o Hero atual foi reconstruído depois (`docs/screenshots/rebuilt-hero-*`) e **não foi reauditado** nesta rodada.

**Não verificado nesta rodada:** Hero, Trajetória, Parasita em Destaque, Explore o Invisível e Footer (exceto o novo link).
