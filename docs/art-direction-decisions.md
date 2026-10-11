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
