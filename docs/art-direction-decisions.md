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

## 2026-10-12 — Fase 2.3.1: reconstrução da jornada cinematográfica

Skills `microcosmos-art-direction` e `redesign-existing-projects` consultadas. A reconstrução permanece isolada em `/explorar`; a homepage, seus seis blocos, tipografia e tokens globais não foram alterados.

- **Conceito:** passagem contínua da precisão mecânica de uma objetiva de microscópio para uma visualização biológica artística. A cena evita vocabulário espacial: partículas usam mistura normal, baixa opacidade, distribuição determinística em aglomerados e só aparecem após o diafragma.
- **Instrumento:** composição assimétrica em três quartos, barril de grafite escalonado, colar metálico, knurling instanciado, poço de retenção e dois elementos ópticos convexos. Menta aparece como estado/ação; lilás identifica dado e reflexão secundária.
- **Câmera:** percurso Catmull–Rom no mesmo eixo óptico, sem giro; FOV varia de 39° a 52° durante a passagem e retorna a 42° no campo microscópico.
- **Biologia abstrata:** membranas orgânicas translúcidas, volumes citoplasmáticos, vesículas, dobra em primeiro plano e filamento. Nenhuma forma é apresentada como micrografia, anatomia ou espécie validada.
- **Descoberta:** três destinos viraram caminhos editoriais assimétricos integrados ao campo, com links HTML completos. A grade de cards convencionais foi removida.
- **Movimento e energia:** o frame inicial e o hub final não mantêm loop contínuo; a renderização contínua ocorre apenas durante os 14,5 s de travessia. Pausa interrompe `requestAnimationFrame`; replay cria uma única retomada.
- **Fallback:** movimento reduzido e ausência de WebGL abrem diretamente um campo estático polido com os três destinos, sem exigir a animação.
- **Ativos:** nenhum ativo externo foi incorporado. Geometria, textura de partículas e grão são gerados localmente em código; não há atribuição ou licença adicional.

## 2026-10-12 — Fase 2.3.2: jornada guiada pela rolagem (substitui a linha do tempo de 14,5 s)

Skills `microcosmos-art-direction` e `redesign-existing-projects` consultadas. Identidade (paleta grafite/menta/lilás, Newsreader + Plus Jakarta Sans), ordem da homepage e a fronteira "cinematográfico só em Explore o Invisível" **preservadas**. A mudança é de modelo de interação e de composição da cena; não há novos tokens de marca.

- **Interação:** o visitante não assiste à animação, ele a controla rolando. A posição de rolagem é a única fonte de verdade; não há botões de reprodução, pausa, retomada ou repetição. Controles de etapa (anterior/próxima/ir à descoberta) apenas alteram a posição de rolagem.
- **Estrutura:** trilha de 520vh com palco `sticky` de 100dvh; depois da trilha o fluxo normal da página continua (rodapé). Sem `overflow: hidden` global, sem camada `position: fixed` sobre o site, sem `preventDefault` em wheel/touch.
- **Convite:** o botão "Iniciar travessia" e a duração "14,5 segundos" foram removidos. A chamada é "Role para explorar" (some com o início da rolagem e volta ao retroceder).
- **Descoberta integrada:** três marcadores 3D ancorados ao micromundo e linhas-guia pontilhadas ligam cada marcador ao seu destino HTML. A revelação é função do progresso (88,5%–96,5%) e desaparece ao retroceder. Abaixo de 980 px as linhas-guia são omitidas e a lista ocupa a base da tela.
- **Óptica (onde a rolagem exigiu):** como o visitante pode parar em qualquer ponto da travessia, todo ponto precisa parecer intencional. Adicionados: ambiente de estúdio procedural (reflexos reais nos metais e no vidro, sem HDRI externo), pilha de lentes interna com anteparos, assentos de lente em duas ligas, rosca helicoidal, trilhos e parafusos assimétricos (para não repetir o túnel radial rejeitado), e a abertura sem disco opaco (a câmera atravessa o diafragma sem um corte para o preto).
- **Micromundo:** membranas com granulação de superfície, rede de fibras, enxame de organelas instanciadas, células em primeiro plano (paralaxe real ao percorrer), fundo desfocado de bokeh biológico. Tudo permanece abstrato e rotulado como não diagnóstico.
- **Movimento vinculado ao progresso:** rotação, respiração e deriva de membranas, organelas e partículas são funções do progresso; ao parar, tudo para. Nenhuma animação ambiente contínua.
- **Movimento reduzido:** nenhum movimento de câmera; a versão estática editorial lista as quatro etapas em texto e os três destinos. Também há "Versão sem movimento" para quem não usa a preferência do sistema.

## Fase 2.3.6 — Entrada pela ocular (skill `microcosmos-art-direction` consultada)

- Decisão: o observador entra pela ocular superior (direita na vista frontal), nunca pela objetiva. Oculares reorientadas com o olho para cima; composição do microscópio preservada.
- Trajetória derivada da geometria medida; detalhes e evidência em `docs/phase236-eyepiece-entry-report.md`.

## Fase 2.3.8 — Transição óptica (skills `microcosmos-art-direction` e `frontend-design` consultadas)

Sem mudança de identidade: paleta (grafite, verde-menta `#80F9C7`, lilás), tipografia e composição da homepage e do hub de descoberta preservadas. Relatório e evidências: `docs/phase238-optical-transition-acceptance.md`.

- **Decisão central:** a continuidade percebida vale mais que a continuidade literal de coordenadas. A câmera deixou de atravessar a carcaça; ela para diante do vidro da ocular direita, o exterior escurece até o limitador de campo, a lente acende e a cena do instrumento cede lugar à cena da amostra **sob o campo totalmente luminoso**.
- **Campo microscópico:** iluminação em verde-menta (poça de Köhler) que se assenta no campo escuro aprovado, grão fino, bolhas/células fora de foco. Proibido: cinza chapado, véu claro, fade de materiais do instrumento. Menta é luz do instrumento (papel funcional), não lavagem decorativa.
- **Foco como narrativa:** o campo e cada organismo resolvem de desfoque para nitidez em função do progresso. Organismo nunca existe antes de o campo estar formado; marcador só aparece e só é acionável com o organismo suficientemente revelado.
- **Ritmo:** trilha de 520vh → 600vh (cinco estados). A proprietária deve aprovar o novo ritmo.
- **Movimento:** nenhuma animação autônoma; tudo é função pura do progresso, reversível (verificado por pixels). `prefers-reduced-motion` e falta de WebGL abrem a versão estática, como antes.
- **Pendência de arte:** o vidro da ocular (0,47–0,49) ainda é um disco liso; refinar material/reflexos sem alterar a silhueta do instrumento.

## Fase 2.3.9 — Movimento científico e fidelidade dos organismos (skills `microcosmos-art-direction` e `frontend-design` consultadas)

Sem mudança de identidade: paleta (grafite, verde-menta `#80F9C7`, lilás), tipografia e a transição óptica aprovada (2.3.8) preservadas. Relatório, matriz de referências e evidências: `docs/phase239-scientific-motion-report.md`.

- **Diagnóstico que orientou a rodada:** os organismos que o visitante via eram imagens editoriais geradas (`*-editorial-v2.png`) sobrepostas em DOM; os modelos 3D eram só âncoras minúsculas. Imagem estática não pode ter movimento coerente, então os mesmos ativos aprovados passaram a ser renderizados em WebGL como folhas de relevo deformadas na GPU (campos derivados do canal alfa). A aparência aprovada foi conservada; nada foi redesenhado nem substituído por geometria procedural "de brinquedo".
- **Cada organismo, uma linguagem de movimento:** *Giardia* — onda coordenada e defasada nos oito flagelos, corpo rígido com rotação lenta limitada (±11°) e deslocamento mínimo; *T. cruzi* — onda viajante da ponta para a base no flagelo livre, membrana ondulante acoplada e flexão do corpo pinada nas extremidades; ovo de *Trichuris* — nenhum movimento autônomo, apenas inspeção pelo visitante (sólido de revolução com a silhueta medida e a mesma textura).
- **Sem hélice nem giro contínuo:** nenhuma rotação acumula; toda amplitude é limitada e função do tempo local (testado).
- **Movimento é secundário e opcional:** relógio local próprio, separado do progresso narrativo; pausa visível ("Pausar movimento") sempre à mão quando há organismo móvel à vista; o painel de inspeção pausa o movimento ao abrir e restaura o estado anterior ao fechar (leitura calma). `prefers-reduced-motion` mantém a versão estática (sem canvas).
- **Marcador fora da anatomia:** o "+" fica sobre a margem do corpo (ou do contorno do ovo), não sobre núcleos, disco, membrana ou plugues. As anotações (Núcleos, Disco ventral, Flagelos / Núcleo, Membrana ondulante, Flagelo / Plugue polar, Casca espessa) só nomeiam estruturas citadas pela fonte (CDC DPDx) e seguem o ponto projetado durante o movimento.
- **Composição:** organismos inteiros dentro do quadro durante toda a janela (defeito de recorte à esquerda de *T. cruzi* corrigido: composição centrada, saída pela esquerda com deriva limitada, janelas do ovo e de *T. cruzi* menos sobrepostas). No hub, cada espécime fica ao lado da linha do próprio destino; anéis e pontos decorativos foram removidos.
- **Materiais:** *Giardia* e *T. cruzi* mantêm a textura aprovada com sombreamento de relevo suave e luz de contorno (menta / lilás); o ovo ganha casca espessa, escurecimento e aquecimento nas margens e brilho especular fino. Sem bloom, sem neon, sem translucidez extra. Profundidade de campo leve: pontas dos flagelos e foco de entrada suavizam por LOD.
- **Pendências de arte:** o lado dorsal não tem referência (sombreamento neutro nas vistas laterais); a posição do cinetoplasto na imagem de *T. cruzi* precisa de revisão especializada (ver relatório).
