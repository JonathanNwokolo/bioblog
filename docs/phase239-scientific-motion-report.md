# Fase 2.3.9 — Movimento científico, fidelidade dos organismos e acabamento cinematográfico

Rota `/explorar`. Sem commit, push, deploy, alteração de Supabase, billing ou serviços pagos.
Skills `microcosmos-art-direction` e `frontend-design` consultadas; decisões em `docs/art-direction-decisions.md`.
Evidências em `docs/evidence/phase23/round-9-scientific-motion/` (capturas das subpastas em WebP; folhas de contato na raiz em PNG; `final-run.log` e `final-run-2.log` registram as execuções).

## Veredito

| Eixo | Resultado |
|---|---|
| **Engenharia** | **PASS** — progresso narrativo preservado e reversível; movimento isolado do progresso; laço contínuo só com organismo móvel revelado; pausa, redução de movimento, aba oculta, descarte e perda de contexto param o laço; testes, typecheck, lint, build de produção e auditoria passam. |
| **Visual** | **PARTIAL** — *Giardia* e *T. cruzi* estão claramente vivos e reconhecíveis, com ondas flagelares coerentes e enquadramento correto; o ovo de *Trichuris* é detalhado e não nada. Limites declarados: o modelo é **2,5D por imagem** (não há volume nem esqueleto 3D; o lado dorsal não tem referência), as vistas laterais são aproximações, e a cadência real em GPU física não foi medida. Não houve revisor independente. |
| **Científico** | **PENDENTE** — aprovação é da Ynara ou de especialista. Todas as frequências, amplitudes e defasagens são interpretação artística; a propagação da onda de *T. cruzi* foi documentada para epimastigotas e estendida ao tripomastigota. Há uma dúvida anatômica aberta na imagem de *T. cruzi* (cinetoplasto; seção 6). |
| **Geral** | **PARTIAL** |

---

## 1. Baseline (Checkpoint 1)

`evidence/baseline/` (desktop 1440 e mobile 390; `baseline.json`).

| Achado | Detalhe |
|---|---|
| O que o visitante via | Três imagens editoriais geradas (`*-editorial-v2.png`) sobrepostas em **DOM** (`<Image>`), reveladas por `--reveal`. Os modelos Three.js eram âncoras minúsculas e invisíveis nas janelas. |
| Movimento | Nenhum. Pose congelada em função do progresso. Imagem não admite onda coerente. |
| Enquadramento | *T. cruzi* encostava e era cortado na borda esquerda (`t-cruzi-exit-*-1440.png`); com o ovo entrando, os dois organismos se sobrepunham ao centro; no hub a âncora 3D do ovo aparecia cortada no topo. |
| Marcador | "+" cobria o centro do corpo (disco ventral) da *Giardia*. |

Decisão derivada: como a causa da falta de movimento era o ativo ser uma imagem DOM, os **mesmos ativos aprovados** foram levados ao WebGL e deformados na GPU. Reconstruir geometria procedural "de brinquedo" (rejeitada na 2.3.5) ou trocar a aparência aprovada foi descartado.

## 2. Fontes e matriz referência → implementação

Fontes consultadas (nenhuma mídia foi baixada, copiada ou redistribuída):

| Fonte | Uso |
|---|---|
| CDC DPDx — [Giardiasis](https://www.cdc.gov/dpdx/giardiasis/) | trofozoíto piriforme, 10–20 µm, dois núcleos, disco ventral, 8 flagelos, corpos medianos. **Não descreve motilidade.** |
| CDC DPDx — [American trypanosomiasis](https://www.cdc.gov/dpdx/trypanosomiasisAmerican/) | tripomastigota 12–30 µm, forma de C em esfregaço fixado, núcleo central, cinetoplasto grande subterminal/terminal, membrana ondulante com flagelo que sai na extremidade anterior; "tripomastigotas móveis em sangue fresco". Sem cinemática. |
| CDC DPDx — [Trichuriasis](https://www.cdc.gov/dpdx/trichuriasis/) | ovo 50–55 × 20–25 µm, em barril, casca espessa, plugues polares, não embrionado nas fezes. |
| House et al., *PLoS Pathogens* 2011 ([PMC3150270](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3150270/)) | quatro pares de flagelos (anterior, caudal, posterolateral, ventral); batimento ventral semi-sigmoidal; nem todos os pares têm forma de onda característica; o batimento flagelar **não é necessário** para manter a aderência. |
| *J. Exp. Biol.* 60:207 (1974) (via resumo de busca; **conferir no texto**) | célula livre: movimento saltatório/errático, corpo girando lentamente em torno do eixo longitudinal. |
| "Flagellar Motility of *Trypanosoma cruzi* Epimastigotes" (2012) | avanço por batimentos simétricos ponta→base (epimastigota). |
| "The Intracellular Amastigote of *T. cruzi* Maintains an Actively Beating Flagellum" ([PMC10128032](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10128032/), 2023) | ~0,7 Hz para amastigotas intracelulares (não tripomastigota). |

Buscas não encontraram: frequência ou comprimento de onda do batimento da *Giardia* em vida livre; cinemática do tripomastigota sanguíneo. **Nenhum desses números foi inventado.**

Matriz (a mesma tabela existe em código: `MOTION_EVIDENCE`, testada):

| Organismo | Elemento | Natureza | Observação |
|---|---|---|---|
| *Giardia* | 8 flagelos em 4 pares | morfologia documentada | |
| | flagelos ondulam de forma coordenada | movimento documentado (qualitativo) | sem frequência publicada |
| | frequência exibida 1,35 Hz | **interpolação artística** | câmera lenta legível; não é a frequência biológica |
| | rotação lenta do corpo (±11,5°) | interpolação artística | descrição qualitativa na literatura |
| | defasagem entre flagelos por setor angular | interpolação artística | evita hélices sincronizadas |
| | cúpula dorsal (relevo) | interpolação artística | lado dorsal sem referência |
| *T. cruzi* | onda no flagelo livre, ponta→base | **premissa a revisar** | documentada para epimastigotas, estendida ao tripomastigota |
| | membrana ondulante acoplada | interpolação artística | a membrana existe (DPDx); amplitude e nº de ondas são artísticos |
| | flexão sutil do corpo (1,3 % da largura) | interpolação artística | curvatura é documentada; a dinâmica exibida não |
| | frequência exibida 1,05 Hz | interpolação artística | |
| *Trichuris* | ausência de motilidade | morfologia documentada | |
| | rotação pelo visitante | operação de visualização | não é movimento biológico |

## 3. Implementação

### 3.1 Contrato narrativa × movimento local

| | Progresso narrativo | Movimento local |
|---|---|---|
| Fonte | posição real de rolagem (inalterada) | `motionTime`, relógio próprio |
| Controla | câmera, transição óptica, revelação, composição, marcadores | ondas flagelares, flexão, rotação lenta, rotação do visitante |
| Quadros | um por mudança de rolagem | rAF contínuo (~30 Hz) só com organismo móvel revelado |
| Reversível | sim (função pura) | `f(progresso, motionTime)`; com a fase congelada, mesmos pixels |

Pixel-equivalência é testada **com o movimento congelado** (`motion.freezeAt(t)`): dois instantes diferentes têm poses diferentes de propósito, e afirmar pixels idênticos sem congelar seria falso.

### 3.2 Arquivos

| Arquivo | Papel |
|---|---|
| `src/cinematic/organismMotion.ts` (novo, puro) | parâmetros rotulados, `bodyPoseAt`, `shouldRunMotion`, composição por viewport, matriz de evidência |
| `src/cinematic/organisms.ts` (novo) | `OrganismSystem`: folhas de relevo deformadas na GPU, ovo como sólido de revolução, âncoras projetadas, inspeção |
| `src/cinematic/organismManifest.ts` (gerado) | dimensões, âncoras derivadas do alfa, perfil do ovo |
| `scripts/prepare-organism-assets.mjs` (novo) | gera texturas WebP e campos de deformação a partir do alfa das imagens aprovadas |
| `public/images/explore/organisms/v3/*` (novo) | `giardia.webp`, `t-cruzi.webp`, `trichuris-egg.webp`, campos `*-field-{a,b}.png` (≈ 1,2 MB no total; originais intactos) |
| `src/cinematic/engine.ts` | agendador do laço local, inspeção, alvos do hub, diagnósticos; remove `getParasiteScreenPoints` |
| `src/cinematic/sceneBuilder.ts` | remove os três volumes procedurais antigos e o ruído associado; âncora de destino invisível |
| `src/cinematic/opticalTransition.ts` | só as janelas dos organismos (ver 3.6) |
| `src/cinematic/types.ts` | anotações (`ORGANISM_ANNOTATIONS`) e notas de movimento (`ORGANISM_MOTION_NOTES`) |
| `src/app/explorar/CinematicExperience.tsx`, `explorar.module.css` | marcadores sobre a margem do corpo, pausa, painel de inspeção, anotações, alça de arraste, medição do hub |
| `tests/cinematic-organisms.test.ts` (18 testes), `tests/visual-qa-phase239*.mjs`, `tests/qa239-lib.mjs`, `tests/run-phase239-final.sh` | testes e QA |

### 3.3 Como cada organismo se move

**Giardia (trofozoíto).** O corpo é rígido (nada se deforma na silhueta piriforme). Os campos de deformação derivam do alfa: corpo = abertura morfológica da máscara; flagelos = resto; envelope `w` vale 0 na inserção e cresce com a distância ao corpo (o flagelo **permanece preso**); a fase usa a distância ao corpo; o deslocamento é perpendicular ao eixo radial. Onda viajante da base para a ponta com 2º harmônico (batimento assimétrico) e defasagem por setor angular (pares não batem em sincronia nem como hélices). O corpo faz só rotação lenta limitada (±11,5°), rolagem de ±1,7° e deslocamento ≤ 1,2 % da largura. O relevo (cúpula pela distância à borda) torna a rotação visível como profundidade.

**T. cruzi (tripomastigota).** Flagelo livre = maior componente fino da máscara; `s` = comprimento de arco a partir da raiz (Dijkstra sobre o componente), normal orientada de forma contínua. Onda viajante da **ponta para a base**, amplitude crescente da raiz à ponta. Membrana ondulante: banda da margem inferior do corpo com onda acoplada. Flexão do corpo: parábola `4u(1−u)` pinada nas extremidades (a raiz do flagelo não se move), 1,3 % da largura. Sem rotação contínua, sem alongamento.

**Trichuris (ovo).** Sem movimento autônomo. Sólido de revolução com a silhueta medida na própria imagem (perfil de 73 pontos, razão 2,18:1 coerente com 50–55 × 20–25 µm) e a textura da reconstrução projetada no plano; casca espessa (escurecimento e aquecimento nas margens), brilho especular fino. Inspeção: arrastar, botões, setas ←→ do teclado, restaurar, anotações.

### 3.4 Hotspots e inspeção

- Marcador "+" na margem do corpo/contorno (fora de núcleos, disco, membrana, plugues); só interativo com `reveal ≥ 0,9`; foco visível; alvo de 38–44 px.
- Painel (existente) ganhou **Observar organismo**: pausar/retomar movimento, girar ←↑↓→, aproximar (1–1,45×), restaurar orientação, ocultar/mostrar anotações, dica de arraste e nota honesta sobre o movimento. Abre pausado (leitura calma) e restaura o estado anterior ao fechar.
- Anotações (Núcleos / Disco ventral / Flagelos; Núcleo / Membrana ondulante / Flagelo; Plugue polar / Casca espessa) só nomeiam estruturas citadas pelo CDC DPDx. **Não** rotulei o cinetoplasto de *T. cruzi* (seção 6).
- Atlas/Laboratório e fonte (CDC DPDx) permanecem no painel.
- O progresso fica parado com o painel aberto e é restaurado no fechamento (já existente; reverificado).
- **Layout da inspeção:** ao abrir, o espécime desliza (suavização exponencial, renderiza só até assentar) para a área livre ao lado do painel — desktop/tablet — ou, em ≤ 700 px, o painel vira **folha inferior** (46 % da altura) e o espécime ocupa a faixa acima dela. Antes, em telas estreitas, o painel cobria o organismo por completo e a inspeção era inútil. A aproximação (1–1,45×) nunca ultrapassa a área livre; os rótulos nunca saem do palco (invertem de lado ou deslocam só o texto).
- **Arraste:** alça sobre o espécime só existe com o painel aberto (`touch-action: none`; a rolagem da jornada está parada). Fora do painel não há captura: a roda continua rolando a jornada.

### 3.5 Acessibilidade

Pausa/retomada visível quando há organismo móvel à vista (`aria-pressed`, rótulo, foco visível, `visibility: hidden` quando não aplicável); região `aria-live` anuncia a alternância feita pelo visitante; setas ←→ giram com o painel aberto; Esc fecha e devolve o foco ao marcador; rotação também por botões (alvo ≥ 40 px). `prefers-reduced-motion`: versão estática, sem canvas, sem controles de movimento. Nenhuma informação essencial depende do movimento.

### 3.6 Janelas e composição

| Organismo | Antes | Agora |
|---|---|---|
| *T. cruzi* saída | 0,835–0,86 | **0,834–0,858** |
| *Trichuris* entrada | 0,815–0,855 | **0,834–0,864** |
| *Trichuris* saída | 0,88–0,90 | **0,884–0,90** |

Composição: centro a 40 % (T. cruzi 38 %) da largura, organismo inteiro dentro do quadro durante toda a janela em 1440/1280/768/390/320 (teste unitário e varredura no navegador); *T. cruzi* sai pela esquerda com deriva limitada; o ovo chega da direita. Hub: cada espécime ao lado da linha do próprio destino (desktop) ou em faixa acima do texto (mobile; some se a faixa for curta demais, como em 320 × 568).

## 4. Evidências de navegador

Chromium headless com ANGLE/SwiftShader (**GL por software**). Não representa GPU de desktop nem de celular. Toque não foi testado em aparelho físico.

### 4.1 Contrato do movimento (`contract/contract-1440.json`, `contract-mobile/`, produção)

| Verificação | Resultado |
|---|---|
| A. repouso: rAF em 1,5 s fora das janelas (0,2 / 0,5 / 0,63 / 0,9 / 0,97) | **0** em todos |
| B. movimento ativo: câmera, progresso, rolagem e renderizações de cena durante a observação | **inalterados** (Δ progresso 0, pose idêntica, Δ rolagem 0, 0 renders de cena) |
| B. pausado | `running:false`, `motionTime` não avança, **0 rAF** |
| B. retomado | volta a correr, `motionTime` avança |
| B. aba oculta (evento `visibilitychange`) | **0 rAF**; volta ao correr quando visível |
| C. determinismo (movimento congelado): *Giardia* 0,74→0,3→0,74, *T. cruzi* 0,81→0,95→0,81, ovo 0,86→0,1→0,86, hub 0,97→0,5→0,97 | **pixels idênticos** nas 4 rotas |
| D. alinhamento anatomia ↔ ponto projetado (centroide do nucléolo renderizado vs âncora, 6 instantes, janela proporcional ao espécime) | desktop: *Giardia* 1,3–1,7 px, *T. cruzi* 4,6–6,2 px; mobile 390: *Giardia* 0,3–1,3 px, *T. cruzi* 5,9–6,8 px. O desvio de *T. cruzi* é um viés **constante** do centroide (região escura maior que o ponto âncora), sem deriva no tempo. |
| E. 6 s de movimento | geometrias 144, texturas 17, chamadas 52, heap estável; nenhuma criação por quadro |
| F. reduced motion (1440 e 390) | 0 canvas, versão estática, 3 destinos, 0 controles de movimento visíveis |
| F. WebGL indisponível | versão estática com os 3 destinos, 0 erros |

### 4.2 Regressão da transição óptica (`optical-regression/regression.json`)

105 passos (0,40 → 0,92, a cada 0,5 %) em 1440 e 390: **0 violações** (instrumento/amostra nunca juntos, organismos só depois do campo formado, nenhum organismo "fantasma" fora da janela, marcador ativo só com `reveal ≥ 0,9`, `tabIndex` coerente). Reversibilidade com movimento congelado, 7 rotas × 2 viewports: **pixels idênticos em todas**.

### 4.3 Hotspots e painel (`hotspots/inspect-{1440,390}.json`)

Para cada organismo, em **1440, 768 e 390**: marcador visível, foco por teclado visível, clique real abre o painel, foco vai ao fechar, **setas ← → e botões giram**, restaurar, retomar movimento dentro do painel, **Esc fecha**, **foco volta ao marcador**, progresso restaurado com Δ = 0; 0 erros de console.

Arraste do ovo (`hotspots/drag.json`, 1440 e 390): mouse **+0,78/+0,81 rad**, restaurar → 0,001, toque emulado (CDP) **−0,75 rad**; sem alça fora do painel; roda do mouse rola a jornada. Capturas: `hotspots/*-{1440,768,390}-{1-marker,2-focus,3-panel,4-rotated,5-tilted,6-resumed}.webp`, `inspect-mobile-sheet.png`.

### 4.4 Viewports (`viewports/viewports.json`)

| Viewport | Overflow horizontal | Recorte em toda a janela (≥ 50 % revelado) | Erros de console |
|---|---|---|---|
| 1440 | não | 0 amostras cortadas (3 organismos × 10) | 0 |
| 1280 | não | 0 | 0 |
| 768 | não | 0 | 0 |
| 390 | não | 0 | 0 |
| 320 | não | 0 (margem mínima 14,8 px em *T. cruzi*) | 0 |

Movimento ativo → pausado → retomado verificado em cada largura (`motionTime` avança, congela, volta). Capturas: `viewports/{id}-{vp}-{full,motion-active,motion-paused}.png`, `hub-{vp}.png`, vistas frontal/oblíqua/lateral em 1440 e 390.

### 4.5 Movimento (folhas de contato e vídeo)

- `motion/sheet-{giardia,t-cruzi}-{1440,390}.png`: 8 fases congeladas (Δ 0,3 s). Revisadas quadro a quadro: flagelos permanecem presos, ondas propagam sem rotação de "hélice", nenhuma geometria se rasga ou atravessa o corpo; *T. cruzi* mantém a silhueta e o flagelo conectado.
- `video/organism-motion-960x600.webm` (≈ 45 s, ≈ 5 MB): roda real, parada com câmera fixa (só o organismo se move), pausa/retomada, rolagem, painel e rotação. Gravado em GL por software: a cadência do vídeo é a do SwiftShader, **não** a de uma GPU. A revisão foi feita extraindo quadros do vídeo (não assisti em tempo real).

### 4.6 Ciclo de vida (`lifecycle/lifecycle.json`)

4 ciclos de "Versão sem movimento" ⇄ "Ativar travessia": 1 canvas na jornada e 0 no estático; texturas 13 e geometrias 139 **constantes**; heap estável; listeners do motor (`scroll`, `resize`, `visibilitychange`) voltam a 0 no estático; **0 rAF** no modo estático; 0 erros.

### 4.7 Desempenho (`perf/perf.json`) — SwiftShader

| Medida | Valor observado |
|---|---|
| Custo de CPU por quadro de movimento (submissão; sem GPU) | ≈ 1,5–2,0 ms (p95 ≤ 3 ms) |
| Triângulos dos organismos visíveis | *Giardia* 14,7 k; *T. cruzi* 9,7 k; ovo 10,7 k; hub (3) 35 k (cena inteira: 29–54 k) |
| Chamadas de desenho (cena inteira) | 28–52 |
| Geometrias adicionais / texturas adicionais | 3 / 7 (carregadas uma vez); `renderer.info` total estável: 139–144 geometrias, 13–17 texturas |
| Alocação de geometria/material por quadro | 0 |
| Repouso (nada observável) | 0 rAF; CPU ociosa |
| Heap JS | ~17–24 MB, estável |
| Intervalo entre quadros de movimento | 77–213 ms em SwiftShader; **não é FPS de dispositivo** |

Não há afirmação de FPS: o limite de ~30 Hz é teto do agendador, não medida.

## 5. Testes e regressões

| Verificação | Resultado |
|---|---|
| `npm test` | **218/218** (200 anteriores + 18 de `cinematic-organisms.test.ts`) |
| `npm run typecheck` | limpo |
| `npm run lint` | limpo |
| `npm audit --omit=dev` | 0 vulnerabilidades |
| `next build --webpack` (cópia isolada do repositório; 19 rotas) | OK. O build padrão (Turbopack) **não** foi executado no repositório: `next build` apaga `.next/dev`, usado pelo servidor de desenvolvimento em uso; mesma ressalva da 2.3.8. |
| Servidor de produção da cópia | HTTP: `/`, `/atlas`, `/laboratorio`, `/onde-vivem`, `/diario`, `/ciencia`, `/explorar` = 200; `/admin` → 307 `/admin/login`. Autenticação do admin segue coberta pelos testes de CMS (verdes). |

Execução final contra `next start` da cópia isolada: `tests/run-phase239-final.sh` (suíte completa) e, após o último ajuste de interface (layout da inspeção e rótulos), reexecução de contrato, inspeção 1440/768/390, arraste, regressão óptica e ciclo de vida (`final-run-2.log`): todos sem falhas.

Testes unitários novos cobrem: pose pura e limitada (sem deriva, sem giro contínuo), ovo sem motilidade, amplitude nula = repouso, flexão pinada, amplitude somente dentro da janela, agendador (repouso, pausa, aba oculta, movimento reduzido, descarte, perda de contexto, inspeção), enquadramento em 5 larguras, ausência de recorte na saída de *T. cruzi*, continuidade janela→hub, ausência de organismos "fantasma", matriz de evidência.

## 6. Questões científicas em aberto (Ynara / especialista)

1. **Cinetoplasto de *T. cruzi*.** Na imagem aprovada, a estrutura azul-escura rotulável como cinetoplasto fica junto à saída do flagelo livre, na extremidade afilada oposta ao nucléolo. No tripomastigota sanguíneo o cinetoplasto é posterior ao núcleo e o flagelo livre emerge na extremidade **anterior**; a disposição da imagem lembra mais um epimastigota. Foi **preservada** (não se redesenha o ativo aprovado) e **não rotulada**. Decidir: manter, substituir o ativo ou trocar o estágio exibido.
2. **Parâmetros de movimento.** Todas as frequências, amplitudes e defasagens são artísticas (seção 2). Confirmar se a escala (câmera lenta, discreta) é aceitável editorialmente e se a extensão da onda ponta→base ao tripomastigota é razoável.
3. **Lado dorsal da *Giardia*.** Sem referência; usa sombreamento neutro nas vistas laterais (> 90°). Evitar apresentar a vista lateral como anatomia.
4. **Ritmo.** Janelas de *T. cruzi* e do ovo foram retocadas (3.6); a proprietária deve aprovar.
5. **Referência da *Giardia* em vida livre** (*J. Exp. Biol.* 60:207): citada por resumo de busca; conferir no texto.

## 7. Revisão independente e autocrítica

Não havia revisor independente disponível: esta é uma **autorrevisão** honesta.

| Critério | Avaliação |
|---|---|
| Morfologia reconhecível (3 organismos) | Sim — conserva exatamente os ativos aprovados. |
| Relações anatômicas | Preservadas na imagem; dúvida aberta do cinetoplasto (seção 6). |
| Plausibilidade do movimento | Coerente e discreta; parâmetros são artísticos e declarados. Sem hélice, sem esticamento, flagelo sempre preso. |
| Vida / aparência "não-ícone" | Boa para *Giardia* e *T. cruzi*. O hub usa os mesmos espécimes pequenos e estáticos: correto, porém decorativo. |
| Materiais | Bom na textura aprovada; sombreamento de relevo e contorno são sutis. *Giardia* e *T. cruzi* compartilham o mesmo shader de fragmento com uniformes distintos (a exigência de shaders diferentes é atendida de fato só pelo ovo). |
| Profundidade | A rotação do visitante mostra relevo, mas é 2,5D: nas vistas laterais a folha revela sua natureza. |
| Pontos fracos | (a) sem esqueleto/volume reais; (b) vista lateral aproximada; (c) cadência real em GPU desconhecida; (d) o "+" ainda toca a margem do corpo (fora da anatomia principal); (e) vídeo revisado por quadros, não em tempo real. |

## 8. Não feito / fora de escopo

- Nenhum modelo 3D esquelético ou volumétrico novo (decisão da seção 1).
- Teste em dispositivo físico (desktop GPU, celular, toque real) e leitor de tela completo: não realizados.
- Auditoria completa de ordem de foco por tecnologia assistiva: parcial (Esc, foco restaurado, armadilha de foco do painel).
- Build Turbopack no repositório: não executado (ressalva acima).
