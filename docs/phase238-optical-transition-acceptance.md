# Fase 2.3.8 — Transição óptica (aceite)

Rota `/explorar`. Sem commit, push, deploy, alteração de Supabase ou CMS.
Skills `microcosmos-art-direction` e `frontend-design` consultadas; decisões em `docs/art-direction-decisions.md`.

**Veredito: PASS com ressalvas declaradas** (seção 9). Nenhum dos oito bloqueadores da rodada está confirmado. A avaliação é de uma sequência capturada em Chromium (SwiftShader) em 1440×900 e 390×844, com revisão visual quadro a quadro. Não houve teste em hardware físico nem revisão independente.

---

## 1. Diagnóstico por frames (estado anterior, `evidence/.../before/`)

Medido com `sampleJourney` (distância `s` do centro do vidro ao longo da normal; `s < 0` = depois do vidro) e com sondagem do DOM em cada captura.

| Progresso | Câmera | Geometrias visíveis | Estado óptico | Organismo | Defeito |
|---|---|---|---|---|---|
| 0,45 | `s = 1,72`, lateral 0,03, FOV 42,6° | cabeçote, ambas as oculares, estúdio claro | — | oculto | — (aproximação correta) |
| 0,49 | `s = 0,89` | vidro + aro; carcaça cinza ao redor | — | oculto | exterior inteiro ainda cerca a ocular |
| 0,53 | `s = 0,59`, FOV 49° | vidro ocupa o quadro; carcaça nas bordas | — | oculto | idem |
| 0,55 | `s = 0,30`, alpha do instrumento 0,86 | vidro + carcaça começando a fadear | `biologyMix` 0,05 | oculto | cinza escuro por transparência acumulada (B02/B03) |
| 0,57 | `s = −0,22` (**atrás do vidro**), alpha 0,51 | **faces internas do cabeçote e do prisma**, platina ao fundo | `biologyMix` 0,18 | oculto | **a câmera "sai" do microscópio** (B01/B02) |
| 0,59 | `s = −0,88`, alpha 0,01 | instrumento quase transparente; fundo `#e8e5dd` ainda 35 % misturado | `worldReveal` 0,02 | **Giardia 0 → 0,88 de opacidade num quadro** | tela cinza-clara sem sentido óptico; organismo antes do campo (B03/B04/B05) |
| 0,61–0,65 | `s = −1,6 … −2,9` | fundo claro→escuro (`biologyMix` 0,55→0,90) + véu claro CSS à esquerda | `worldReveal` 0,16→0,62 | Giardia, opacidade 0,88 constante | lavado cinza, Giardia sobre cinza (B03/B04) |
| 0,67–0,69 | `s = −3,6 … −4,2` | micromundo, véu claro CSS ainda presente até 0,70 | `worldReveal` 0,84→0,98 | Giardia **e** T. cruzi juntos | composição confusa de duas cenas (B03) |
| ≥ 0,71 | `s < −4,7` | micromundo escuro | `worldReveal` 1 | só T. cruzi | — |

### Causas-raiz no código

1. **Câmera atravessa a carcaça** (`choreography.ts`, versão anterior): as chaves `onAxis(−1,9)` em 0,62 e alvo `onAxis(−5,5)` fazem a câmera avançar em `−normal`. A normal do vidro é `(−0,08; 0,41; −0,91)`, logo a direção de observação aponta para a base: a câmera entra pelo cabeçote, atravessa torre e platina e continua. O que se vê entre 0,55 e 0,59 é o interior das malhas.
2. **Cinza lavado** (`engine.ts`, `applySample`): o instrumento "dissolvia" via `instrumentAlpha = 1 − biologyMix·2,8` aplicado a dezenas de materiais com `depthWrite = false` (camadas translúcidas acumuladas), enquanto `scene.background`, `fog` e `environmentIntensity` eram interpolados do estúdio claro (`#e8e5dd`) ao verde-escuro entre 0,53 e 0,68. Em paralelo, o véu CSS `.opticalVignette` (76 % de creme à esquerda) só era trocado quando a etapa passava a `micro` (0,70).
3. **Giardia prematura** (`types.ts` `progressWindow [0,55; 0,69]` + `paintParasiteMarkers`): a imagem DOM ligava-se assim que o ponto 3D projetado entrava no frustum, em salto de opacidade 0 → 0,88 (CSS sem rampa), sem relação com a formação do campo (`worldReveal` só 0,58–0,70).

---

## 2. Modelo de transição

Fonte única: `src/cinematic/opticalTransition.ts` (puro, sem three/DOM). `sampleOptics(p)` alimenta o motor **e** a camada DOM; nada anima por tempo.

| Estado | Progresso | Instrumento | Amostra | Organismo | O que o visitante vê |
|---|---|---|---|---|---|
| A aproximação | 0 – 0,40 | sólido | oculta | oculto | microscópio → cabeçote → ocular direita (inalterado) |
| B acoplamento | 0,40 – 0,50 | sólido | oculta | oculto | o vidro cresce; o exterior escurece até o limitador de campo (anel da ocular) |
| C óptico | 0,50 – 0,60 | sólido até `CUT = 0,555` | a partir do corte | oculto | a lente escurece, um núcleo luminoso cresce dentro dela e cobre o campo; **o corte acontece sob o campo totalmente luminoso** |
| D formação | 0,60 – 0,665 | oculto | visível | oculto | o limitador abre; o campo ganha grão, bolhas fora de foco, profundidade; o foco se resolve |
| E revelação | ≥ 0,665 | oculto | visível | por janela | silhueta desfocada → foco → marcador |

Decisões que resolvem as causas, não o sintoma:

- **Sem atravessar a carcaça.** Antes do corte a câmera só se aproxima e para diante do vidro (`EYE_RELIEF = 0,34`, nunca `s < 0,34`). Depois do corte o instrumento não é desenhado; a câmera continua pelo mesmo eixo e entra no campo de observação. Posição, direção de visão e FOV são contínuos no corte (teste).
- **Sem transparência acumulada.** O fade de materiais do instrumento foi removido. O instrumento e a cena da amostra **nunca** são desenhados juntos (`instrumentVisible ≠ sampleVisible` em 1001 amostras). A troca é de visibilidade (`visible`), sem recompilar programas; `warmUp` compila tudo de antemão.
- **Passagem óptica em camadas DOM** sobre o mesmo canvas: `fieldVignette`, `opticalGlow` (campo luminoso, opacidade e raio por progresso) e `opticalIris` (limitador de campo, raio em px por progresso). O véu CSS claro some em 0,40–0,50 (sob o escurecimento).
- **Campo microscópico intencional** (`createFieldBackdrop`): poça de iluminação de Köhler em verde-menta, grão fino em sobreposição suave, bolhas/células de borda suave em vários tamanhos, partículas de 1–2 px; fibras e detritos 3D só ganham contraste conforme a iluminação se acomoda (`detail`). A exposição (percebida, sRGB) cai de 1 → 0,24 entre 0,60 e 0,74 e converge para o campo escuro aprovado.
- **Foco por progresso**: `blur(16·(1−foco)² px)` no canvas só depois do corte; zero antes.
- **Ordem dos eventos:** o limitador fecha em 0,43–0,50; a lente escurece em 0,47–0,505; o núcleo começa a crescer em 0,49 e o campo cobre o limitador em 0,535. Entre o fim do fechamento e o corte (0,555) não há exterior algum à vista.

Trilha de rolagem: `JOURNEY_TRACK_VH` 520 → **600** (mais percurso para cinco estados; a travessia ficou mais longa e o trecho biológico foi redistribuído). A composição inicial (0–0,20) não mudou.

## 3. Regra de ocultação/revelação dos organismos

`ORGANISM_TIMELINE` (entrada `in`, saída `out`); `organismReveal = smoothstep(in) · (1 − smoothstep(out))`.

| Organismo | Entra | Sai | Marcador ativo (reveal ≥ 0,9) |
|---|---|---|---|
| *Giardia* | 0,665 – 0,72 | 0,76 – 0,785 | ≈ 0,709 – 0,765 |
| *T. cruzi* | 0,745 – 0,795 | 0,835 – 0,86 | ≈ 0,785 – 0,84 |
| *Trichuris* | 0,815 – 0,855 | 0,88 – 0,90 | ≈ 0,847 – 0,884 |

- Nada biológico existe antes de `organismsFrom = 0,665`; o campo termina de se formar em 0,65.
- O objeto 3D só é `visible` dentro da janela da própria espécie (escala mínima, para projetar o marcador) e cresce desde a escala mínima na composição final (0,875 – 0,915); antes saltava.
- A opacidade/foco/escala da imagem DOM é `--reveal` (0 → 1) escrito por progresso; antes era 0 → 0,88 num quadro.
- Marcador: `data-visible`/`tabIndex 0`/`pointer-events` só com `reveal ≥ 0,9` e sem painel aberto; fora disso `pointer-events: none`, `tabIndex −1`.
- Em retrato (≤ 700 px) a projeção horizontal fica fora do enquadramento curto; o motor deixou de descartar o organismo por esse limite (o DOM já recentraliza na faixa 34–66 %). **Defeito encontrado e corrigido nesta rodada** (mobile não mostrava nenhum organismo).

## 4. Alterações

| Arquivo | Alteração |
|---|---|
| `src/cinematic/opticalTransition.ts` (novo) | linha do tempo, `sampleOptics`, janelas e regra de marcador |
| `src/cinematic/choreography.ts` | câmera em dois trechos (instrumento / amostra), `CUT`, `EYE_RELIEF`, `JourneySample.optics` |
| `src/cinematic/engine.ts` | visibilidade por fase, sem fade de instrumento, backdrop, estado recalculado sempre, `getOpticalDiagnostics` |
| `src/cinematic/sceneBuilder.ts` | `createFieldBackdrop`, grão/bolhas, visibilidade dos organismos por janela |
| `src/cinematic/types.ts`, `scrollProgress.ts` | janelas derivadas; etapas (`scale` 0,40–0,65, `micro` 0,65–0,88); trilha 600vh |
| `src/app/explorar/CinematicExperience.tsx`, `explorar.module.css` | camadas ópticas por variáveis CSS, `--reveal`, `getOptical` para QA |
| `tests/cinematic-scroll.test.ts` | contrato novo (+10 testes) |
| `tests/visual-qa-phase238*.mjs` | capturas, contrato fino, reversibilidade, rotas |

Preservados (não tocados): microscópio e composição inicial, entrada pela ocular direita, hotspots e destinos de descoberta, painéis científicos, três organismos (assets DOM e geometria), versão sem movimento, fallback sem WebGL, navegação, integrações científicas, CMS/Supabase.

## 5. Reversibilidade (`reversibility.json`, `reversibility-mobile.json`)

Cinco rotas, desktop e mobile: estado completo (pose, estado óptico, variáveis CSS, DOM e marcadores) **e pixels** idênticos na volta.

| Rota | Diferenças estruturais | Pixels |
|---|---|---|
| 0,45 → 0,60 → 0,45 | 0 | idênticos |
| 0,50 → 0,75 → 0,50 | 0 | idênticos |
| 0,55 → 0,95 → 0,55 | 0 | idênticos |
| 0,70 → 0,30 → 0,70 | 0 | idênticos |
| 0,00 → 1,00 → 0,00 | 0 | idênticos |

A primeira versão desta rodada **não** passava na comparação estrutural: com a cena da amostra oculta o motor não recalculava escala/exposição, e o estado interno invisível dependia do caminho. Os pixels eram iguais, mas isso violava o contrato; corrigido (`engine.applySample` recalcula sempre).

Parar a rolagem para o progresso: nenhum laço próprio, nenhuma animação autônoma; o único agendamento é o `requestAnimationFrame` agrupado disparado por `scroll`/`resize` (inalterado).

## 6. Varredura de contrato (`contract-scan*.json`)

105 passos (0,40 → 0,92, a cada 0,5 %), desktop e mobile, **0 violações**:

- instrumento e amostra nunca juntos nem ambos ocultos; amostra só a partir do corte (0,555);
- antes de 0,665: nenhum organismo visível (DOM e cena 3D), nenhum marcador focável;
- marcador ativo só com reveal ≥ 0,9; `tabIndex` coerente;
- primeiro quadro com organismo: 0,6665 (*Giardia*); primeiro marcador ativo: 0,7093;
- clique real no marcador abre a anotação, fixa o progresso; `Esc` fecha e restaura a posição; marcador oculto antes da hora: `pointer-events: none`, `tabIndex −1`;
- sem overflow horizontal.

## 7. Evidências (`docs/evidence/phase23/round-8-optical-transition/`)

- `before/` e `after/`: 0,45 → 0,75 em passos de 0,02 (desktop); `sheet-before-45-75.png`, `sheet-after-45-75.png`.
- `milestones/`, `sheet-milestones.png`: 0 %, 35 %, 48 %, 55 %, 60 %, 65 %, 66,7 % (1º organismo), 70 %, 70,9 % (1º marcador), 71,2 %, 72,5 %.
- `after-mobile/`, `sheet-mobile.png`: 390×844.
- `iterations/rodada-1…5.png`: revisão visual (ver seção 8).
- `fallback-no-webgl.png`, `reduced-motion*.png`, `homepage-explore.png`, `routes-smoke.json`.

Evidências das rodadas anteriores não foram apagadas.

## 8. Revisão visual: o que foi encontrado e corrigido

A primeira sequência **não foi aceita**. Defeitos vistos e corrigidos (ver `iterations/`):

1. Campo assentado claro e nebuloso demais (fator de exposição multiplicado em espaço linear): corrigido, converge ao campo escuro aprovado.
2. Textura com repetição de ladrilho e manchas largas ("quadro-negro"): grão só de altas frequências, bolhas de borda suave.
3. Fibras claras sobre campo claro (manchas): contraste só conforme a iluminação se acomoda.
4. Núcleo luminoso encolhendo sobre o campo já formado (bola sobreposta em 0,62): o núcleo só cresce; a saída é fade do campo inteiro.
5. Lente cinza-esverdeada sem intenção em 0,50: a lente escurece junto do fechamento da ocular e o brilho nasce como um núcleo.
6. *Giardia* saindo pela borda esquerda em 0,76–0,78 por pan da câmera: chave de câmera adicional em 0,77.
7. Marcador de *Trichuris* ativo por apenas 1,8 % de rolagem: janelas redistribuídas.
8. Mobile sem organismos: ver seção 3.

## 9. Testes e regressões

| Verificação | Resultado |
|---|---|
| `npm test` | 200/200 (190 anteriores + 10 do contrato óptico) |
| `npm run typecheck` | limpo |
| `npm run lint` | limpo |
| `npm audit --omit=dev` | 0 vulnerabilidades |
| `next build` | **webpack OK** em cópia isolada do repositório (as 19 rotas); o build padrão (Turbopack) falhou apenas na cópia, por causa do *junction* de `node_modules` ("Symlink node_modules … leaves the filesystem root"), artefato do isolamento. Não foi executado no repositório para não sobrescrever o `.next` do servidor de desenvolvimento em uso. |
| Rotas `/`, `/diario`, `/atlas`, `/laboratorio`, `/onde-vivem`, `/ciencia`, `/admin`, `/explorar` (1440 e 390) | 200, 0 erros de console, 0 overflow horizontal |
| `prefers-reduced-motion` | versão estática, sem canvas (desktop e mobile) |
| WebGL desligado | modo estático com os destinos (links) |
| Homepage | segue sem 3D (status `pending` por desenho; não importa o motor) |

## 10. Ressalvas e pendências

- **Capturas em SwiftShader (CPU).** Cores e desempenho em GPU real podem diferir; o desfoque CSS foi dimensionado para resolução de 1440 px. Sem teste em dispositivo físico.
- **0,47–0,49:** a lente ainda é um disco verde-acinzentado liso até o núcleo acender; é o vidro da ocular, mas sem reflexos detalhados. Candidato a refinamento de material, sem impacto no contrato.
- **Organismos como imagens DOM:** a revelação por foco/escala é do plano DOM; os organismos 3D continuam só como âncoras e na composição final (decisão herdada das fases anteriores).
- **Saída de *T. cruzi* (0,84–0,86):** o organismo já está cortado pela borda esquerda enquanto some (pan da câmera nos trechos finais, herdado das chaves de observação).
- **Trilha mais longa (600vh):** altera o ritmo de rolagem; a proprietária deve aprovar.
- **Build Turbopack** não validado no repositório (ver acima); rodar `npm run build` com o servidor de dev parado.

---

## Nota da Fase 2.3.9 (organismos)

A transição óptica descrita acima **não foi alterada**. Mudanças na camada de organismos (detalhes em `docs/phase239-scientific-motion-report.md`):

- Os organismos deixaram de ser imagens DOM e passaram a ser desenhados em WebGL (mesmos ativos aprovados), com movimento local separado do progresso.
- Janelas retocadas apenas para evitar o cruzamento de dois organismos e o recorte de *T. cruzi*: `t-cruzi.out` 0,835–0,86 → **0,834–0,858**; `trichuris.in` 0,815–0,855 → **0,834–0,864**; `trichuris.out` 0,88–0,90 → **0,884–0,90**. Início do primeiro organismo (0,665) e demais janelas intactos.
- Os scripts `tests/visual-qa-phase238-{contract,reverse}.mjs` consultam `[data-parasite-visual]` (imagens DOM removidas); a regressão equivalente passou a ser `tests/visual-qa-phase239-optical-regression.mjs`.
