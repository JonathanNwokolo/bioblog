# Decisões de direção de arte — Microcosmos

Registro vivo. Cada entrada diz de onde veio a decisão e se foi aprovada.

## 2026-10-10 — Teste controlado do plugin `frontend-design` (Fase 0)

**Como foi executado:** a skill `frontend-design` (SKILL.md do plugin, cache `claude-plugins-official/frontend-design`) foi lida integralmente e seu processo de duas passagens (plano de tokens → revisão contra o brief → build → crítica) foi aplicado ao brief da Fase 0, **somente na etapa de planejamento**. Nenhuma interface foi construída. Este plano é **proposta**, não identidade aprovada.

**Dados do brief tratados como fixos:** fundo claro, tipografia preta expressiva, `#80F9C7`, `#E5CBFF`, composições assimétricas, fotografia microscópica, motion intencional, hierarquia da homepage de 6 partes, Ynara como protagonista do hero.

### Passagem 1 — plano inicial

- **Cor:** papel claro, preto, menta `#80F9C7`, lilás `#E5CBFF`, um cinza neutro.
- **Tipo:** um grotesco de display condensado para títulos + serifa de texto.
- **Layout:** hero com título gigante à esquerda e foto da Ynara à direita, faixa de "stats" abaixo.
- **Motion:** fade-and-slide-up nas seções.

### Revisão contra o brief (autocrítica exigida pela skill)

| Trecho do plano | Problema | Mudança |
|---|---|---|
| Título à esquerda + foto à direita + faixa de stats | É o hero-padrão de qualquer perfil profissional; "stats" seriam inventados (viola regra de não fabricar dados) | Hero assimétrico em que a **fotografia microscópica e a presença da Ynara se sobrepõem em escala diferente** (campo microscópico enquadrado como "lente"); sem faixa de números |
| Fade-and-slide-up por seção | Citado pela skill como tell de IA e vetado pela regra de motion | Um único momento orquestrado no carregamento do hero (a lente "foca" o campo microscópico); depois, motion apenas em resposta a ação (abrir post, curtir, comentar) |
| Menta e lilás como lavagem de fundo | Gradiente sem função | Menta = estado/ação (foco, curtida, destaque funcional); lilás = marca de dado/anotação científica. Fundo permanece claro e limpo |
| Eyebrow caixa-alta sobre todo título; numeração em todas as seções | Rótulos decorativos listados como tell pela skill | Numeração só na timeline (é sequência real); sem eyebrows genéricos |
| "Serifa de texto" sem justificativa | Escolha reflexa | Pendente: decidir após ver a referência da proprietária |
| Cards iguais para posts do Diário | Violação das regras anti-slop | Diário como fluxo editorial com escalas diferentes por post (anotação de bancada), não grade de cards |

### Passagem 2 — plano revisado (proposta)

- **Princípio memorável (onde gastar a ousadia):** o hero como lente — escala microscópica vs. humana. O resto fica quieto.
- **Layout do hero:** assimétrico; Ynara como protagonista; campo microscópico real (a ser fornecido) como segundo plano de escala; texto alinhado à esquerda, comprimento de linha < 80 caracteres.
- **Motion:** um momento orquestrado + interações respondendo a ação; alternativa estática completa para `prefers-reduced-motion`.
- **Tipografia:** família(s) **não escolhida(s)**. Critério: personalidade em tamanho grande, preto expressivo, boa cobertura de português (acentos), licença web livre. Escolha depende da referência visual.

### Pendências que bloqueiam aprovação

1. ~~Captura de referência da homepage não está no repositório — solicitada.~~ **Resolvida em 2026-10-10:** `docs/reference/homepage-reference.png` está no repositório e foi inspecionada. Leitura estrutural (aprovado vs. ilustrativo) registrada em `docs/approved-homepage-composition.md`. A comparação visual (passo 2 da validação) deixa de estar bloqueada.
2. Fotografias microscópicas reais e foto da Ynara: não fornecidas. As da referência são placeholders ilustrativos.
3. Conteúdo profissional da timeline: não fornecido (não será inventado).

## 2026-10-10 — Referência visual inspecionada (início da Fase 1)

A imagem de referência foi lida e documentada em `docs/approved-homepage-composition.md` (seção "Observações da referência"), separando composição aprovada de conteúdo ilustrativo. A leitura **confirma** as direções da Fase 0: hero assimétrico como lente (escala micro × humana), fundo claro, tipografia preta expressiva, menta = ação/estado, lilás = eyebrow/marca de dado, "Explore o Invisível" como única seção cinematográfica em fundo escuro.

Três tensões entre a referência e as decisões da Fase 0 ficaram **em aberto para a proprietária** (detalhadas naquele doc):

1. Faixa de stats no hero (referência mostra; Fase 0 removeu; honestidade proíbe dado fabricado).
2. Diário de Bancada em 3 cards idênticos (referência) vs. fluxo editorial com escalas diferentes (Fase 0).
3. Eyebrows em quase toda seção (referência) vs. tell de IA a evitar.

Até decisão, a implementação segue a leitura conservadora (sem dados fabricados) e sinaliza as três na QA. Tipografia exata permanece não escolhida.

## 2026-10-10 — Fase 1: implementação da homepage (decisões tomadas)

Plugin `frontend-design` invocado pela ferramenta Skill no início da fase; skill `microcosmos-art-direction` lida. Tudo abaixo é **proposta de implementação**, a confirmar pela proprietária. Registro do que foi decidido e por quê.

### Tipografia
- **Plus Jakarta Sans** (variável, 200–800) para toda a interface. Motivo: é a mais próxima do grotesco geométrico-humanista lido na referência (a de dupla camada, g de camada única), tem boa cobertura de acentos do português e peso 800 com personalidade em tamanho grande. Descartadas: Space Grotesk (letras excêntricas demais para texto corrido científico) e Manrope (sem a mesma densidade em peso alto).
- **Caveat** somente para anotações de bancada (o gesto manuscrito presente na referência no hero e na seção escura). Papel único: anotação, nunca corpo de texto.
- Display: peso 800, tracking −0,036 a −0,045 em tamanho grande, entrelinha ≈ 0,97. Corpo: 400/600 com `--ink-soft`.
- Nome científico em itálico por convenção de nomenclatura, não por destaque decorativo.

### Cor (tokens em `src/app/globals.css`)
- Fixos da marca: `#F2F2F2`, `#FFFFFF`, `#211F20`, menta `#80F9C7`, lilás `#E5CBFF`.
- **Propostos** (decisão em aberto na Fase 0): `--ink-soft #5A5658` (texto secundário, 6,3:1 sobre `#F2F2F2`), `--plum #3E1F66` (texto sobre lilás e traço de lâmina), `--night #090912` (única seção escura), `--like #C8223B` (somente curtida ativa e erro).
- Papéis: menta = ação/estado (CTAs primários, pontos da timeline, lâmina do microscópio, selo "Em destaque"); lilás = marca de dado (tags, brilho dos campos microscópicos, botões contorno). Nenhuma lavagem decorativa de fundo, exceto o halo menta/lilás do hero, aprovado na referência.

### As três tensões da referência (resolvidas de forma conservadora, a validar)
1. **Faixa de stats**: omitida. Substituída por uma assinatura de autoria (nome + área), sem números.
2. **Diário em 3 cards iguais**: composto como periódico. Um destaque em placa branca (escala grande) + índice de entradas separadas por filetes. Não é grade de cards.
3. **Eyebrows**: mantido apenas no hero ("Parasitologia em foco"), onde codifica o campo da publicação, e nas tags de post (que codificam categoria). Removidos das demais seções.

### Imagem e honestidade
- Nenhuma imagem da referência foi reutilizada: a foto da pessoa não pode ser apresentada como Ynara e as microscopias da referência têm 941 px de largura total e origem não verificada.
- Retrato: silhueta genérica sem traços, rotulada "Retrato a ser enviado". Aceita recorte com fundo transparente via `PortraitSlot`.
- Microscopia: ilustrações **geradas em código** (SVG), sempre legendadas como ilustração e nunca como registro. Vantagem funcional: a lente amplia sem perder nitidez e revela uma camada de detalhe (estrias, grânulos) que a imagem base não mostra. O esquema da giárdia é simplificado e **não foi revisado por especialista**; revisão pela autora é pré-requisito de publicação.
- Contagens de curtidas partem de 0 (a referência mostra 142/89/76, que não são reais).

### Motion (Fase 1)
- Um momento orquestrado: no carregamento, os três campos microscópicos do hero "focam" (blur → nitidez, 900 ms, escalonado). Uma única vez.
- Respostas a ação: lente (ponteiro/toque/teclado), pulso do coração ao curtir.
- Sem animação ambiente, sem scroll-triggers, sem rotação do selo circular. `prefers-reduced-motion` remove o momento de carregamento e as transições.

### Ficou de fora de propósito
- Selo circular "ciência • curiosidade • impacto • saúde" permanece, estático. Anotação manuscrita do hero é ocultada abaixo de 560 px (colide com os campos).
- Ícones de atributo da seção do parasita: não usados. Os atributos viraram uma faixa tipográfica de ficha; ícones não codificariam informação adicional.

## 2026-10-10 — Diário de Bancada: feed editorial dinâmico

Skill `microcosmos-art-direction` consultada; composição preservada (destaque grande em placa branca à esquerda, entradas com filetes à direita). Sem mudança de tokens, tipografia ou cor.

- **Dados**: destaque e feed derivam da mesma coleção (`posts` em `src/content/posts.ts`, via `splitDiary`). Ordem: `publishedAt` decrescente; desempate por `id` (numérico) e `slug`. `publication: "draft"` exclui do feed, do arquivo `/diario` e de `/diario/[slug]`. Sem limite de itens. `<Diary posts={...}>` aceita a mesma forma de um CMS futuro.
- **Desktop (≥960px)**: coluna direita com cabeçalho "Publicações anteriores", posição "k de N" e botões acima/abaixo; altura limitada a `clamp(460px, 100vh − 160px, 760px)`, rolagem nativa com barra fina, sombras de borda indicam mais conteúdo. Sem `overscroll-behavior: contain` no eixo vertical: a roda passa para a página no fim do feed.
- **Tablet/mobile (<960px)**: faixa horizontal com scroll-snap (swipe), botões anterior/próxima, "k de N"; barra horizontal oculta. Gesto vertical continua rolando a página.
- **Teclado**: a região do feed é focável (setas rolam); cada link e controle é focável e traz a entrada à vista.
- **Removido**: botão "Ver todos os posts" da seção da home (continua removido). A rota `/diario` permanece como arquivo editorial completo.
- **Aceite final (2026-10-10)**: único ponto de entrada visível para `/diario` é um link discreto "Arquivo do diário" na navegação do rodapé (peso 500, `--ink-soft`, alvo de 44 px). Não é CTA e não há botão nem destaque na seção do Diário. Sem mudança de tokens, tipografia ou composição. Skill `microcosmos-art-direction` consultada: o link herda o estilo dos links do rodapé, apenas mais quieto.
- **Dados de exemplo**: as três datas demonstrativas deixaram de ser idênticas (10, 9 e 8 de out.) para que a ordem seja determinística sem depender de desempate; continuam rotuladas como exemplo.

## 2026-10-11 — Fase 2.1.3: endurecimento do CMS (acessibilidade e desempenho)

Skill `microcosmos-art-direction` consultada. Composição, ordem das seis seções, paleta (creme/cinza, preto, menta, lilás) e tipografia **preservadas**. Mudanças, todas sem alteração de identidade:

- **Imagens do hero**: versões WebP equivalentes (`scripts/optimize-hero-images.mjs`) no lugar dos PNG/JPEG de ~700–900 KB; originais mantidos em `public/images/hero`. Diferença visual média 0,32/255 (≤ 0,05 % dos canais com Δ > 24) em 1440/768/390 com movimento reduzido.
- **Movimento automático (WCAG 2.2.2)**: o código tinha rotação infinita do selo (32 s) e flutuação infinita das esferas, o que contradiz a decisão registrada na Fase 1 ("sem animação ambiente, sem rotação do selo") e exige mecanismo de pausa. Agora o selo gira **uma volta em 5 s** e as esferas fazem **uma oscilação suave (≤ 5 s)** ao carregar, depois ficam estáticos. `prefers-reduced-motion` segue removendo tudo. **Decisão para a proprietária**: manter assim (alinhado ao aprovado), restaurar o loop (exigiria controle de pausa visível) ou remover totalmente o movimento do selo.
- **Painel editorial**: bordas de campos em `#767274` (≈ 4,6:1 sobre branco; antes ≈ 2:1), alvos de 44 px, mensagens de erro por campo em vermelho `#a4152b` com prefixo "Erro:" (cor nunca é o único sinal), estados em português. Mesma família tipográfica e botões `.btn` existentes.
- **Semântica**: `role="group"` nos dois `div` rotulados do hero; entradas de `/diario` em `h2` (antes h4 logo após o h1).
- **Foco**: o anel do cartão do Diário continua desenhado em `::after` do link esticado (decisão da Fase 1); verificado visível em todas as paradas de Tab.

## 2026-10-11 — Fase 2.2: experiências científicas (Atlas, Laboratório, Onde vivem?)

Plugin `frontend-design` e skill `microcosmos-art-direction` consultados; sem mudança de identidade. Composição da homepage e ordem das seis seções **preservadas** (`tests/science-security.test.ts` falha se a ordem mudar ou se a homepage importar código científico). Mudanças visíveis na homepage: uma entrada "Ciência interativa" no menu (rota própria `/ciencia`; as demais continuam âncoras) e uma linha discreta de três atalhos sob o botão da seção "Parasita em destaque".

### Superfícies e tokens
- Fundo `--paper` (cinza claro) com painéis `--white`; o creme `#F7F5F1` já usado no painel editorial fica como variável local das páginas científicas. Nenhuma cor nova de marca.
- Menta = estado/ação verificada ("Dado do NCBI Taxonomy", botões primários, registro atual na hierarquia). Lilás = marca de dado (categoria taxonômica, pontos do mapa). Ameixa (`--plum`) = agrupamentos do mapa e barras. Vermelho `#A4152B` (já aprovado na Fase 2.1.3) = só erro.
- Controles com borda `#767274` (≈ 4,6:1) como no painel editorial; alvos mínimos de 44–48 px; foco `--ink` de 3 px herdado.
- Tipografia: a mesma família da interface. Nome científico em itálico por convenção, com `lang="la"`.

### Decisões de visualização
- **Atlas**: a hierarquia taxonômica é um "zoom de lente" (anéis concêntricos, do táxon mais amplo ao registro, disco menta no centro) ao lado da lista numerada equivalente. O SVG é `aria-hidden` e só responde a mouse/toque; teclado e leitor de tela usam a lista. Motivo: o gesto reforça a identidade microscópica e mostra "profundidade" de classificação sem perder a leitura.
- **Laboratório**: moldura de lente (anel duplo) é função, não enfeite: delimita a área de zoom. Estágio diagnóstico e espécie em rótulos separados; legenda literal do CDC em inglês e tradução marcada "a revisar".
- **Mapa**: mapa SVG próprio (Natural Earth 1:110m, domínio público), sem tiles, token ou terceiros; agrupamentos com contagem; lista de registros como equivalente em texto. O aviso de limitações é sempre visível (não só em controle expansível).
- **Estados**: carregando, vazio, erro, ambíguo e insuficiente são blocos explícitos (tracejado = lacuna/provisório, sólido vermelho = erro). Nenhum estado preenche a lacuna com conteúdo.

### Movimento
- Sem animação ambiente. Única transição: zoom da imagem do Laboratório (140 ms), removida em `prefers-reduced-motion`. Esqueleto de carregamento sem cintilação em movimento reduzido.

### Pendências para a proprietária
- Aprovar o rótulo "Ciência interativa" no menu e a linha de atalhos na seção do parasita.
- Confirmar se `Giardia lamblia` (nome da referência) deve ser exibido como "Giardia duodenalis (nome aceito no NCBI)" na seção em destaque. O Atlas já resolve o sinônimo.
