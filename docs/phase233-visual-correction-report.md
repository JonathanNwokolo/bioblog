# Fase 2.3.3 — correção visual da experiência cinematográfica

## Veredito

**PARTIAL visual.** A rodada corrige o erro de linguagem mais grave: a abertura não é mais dominada por um aro dourado e o micromundo não é mais composto por blobs e esferas genéricas. Ainda não atribuo PASS porque a objetiva procedural pode ser confundida com uma lente fotográfica por alguns observadores e os organismos ainda têm acabamento 3D mais esquemático do que micrográfico. Não houve revisão independente por especialista nem teste em GPU/aparelho físico.

## Respostas objetivas

| Pergunta | Resposta honesta |
| --- | --- |
| A objetiva agora lê como microscópio real? | **Majoritariamente.** O corpo longo e escalonado, encaixe traseiro, knurl, retenções, vidro frontal menor e gravações `100x / 1.45 Oil` / `Plan Apo` deslocam a leitura de portal para instrumento óptico. A ausência da torre/estrutura completa do microscópio ainda permite uma leitura secundária de lente fotográfica. |
| As formas agora leem como parasitas reais estilizados? | **Sim, em silhueta editorial.** Giardia tem corpo bilateral, dois núcleos, disco e flagelos; T. cruzi tem corpo alongado, membrana ondulante, núcleo, cinetoplasto e flagelo livre; o ovo de Trichuris tem corpo em barril, casca, conteúdo e dois plugs polares. Não são modelos diagnósticos. |
| O micromundo deixou de parecer sci-fi abstrato? | **Sim no vocabulário principal.** Saíram blobs, esferas e fibras aleatórias; entraram três âncoras morfológicas, detrito irregular de preparação e bokeh muito mais discreto. |
| A experiência parece scroll-driven e não vídeo disfarçado? | **Sim, com prova determinística.** O frame em 65% teve hash idêntico (`d30aae22aa0f996f`) após 65% → 100% → 65%; não há relógio nem autoplay como fonte de verdade. |
| O resultado merece PASS visual? | **Ainda não: PARTIAL.** A direção agora está correta, mas o acabamento procedural continua abaixo das referências artísticas geradas e não foi validado por segunda avaliação humana. |

## Antes vs. depois

| Área | Antes — Fase 2.3.2 | Depois — Fase 2.3.3 |
| --- | --- | --- |
| Abertura | Cilindro curto e frontal; aro/lente dominava a leitura | Corpo mais longo e estreito, frente óptica reduzida, encaixe traseiro, gravações técnicas e materiais frios |
| Travessia | Círculos concêntricos com risco de leitura de portal | Vidros, baffles, rosca, trilhos e retenções; o frame central ainda é radial, mas está contextualizado pelo exterior mecânico |
| Biologia | Massa roxa central, satélites ovais, esferas e fibras | Giardia, T. cruzi e ovo de Trichuris construídos como grupos geométricos nomeados |
| Atmosfera | Bolhas circulares evidentes e fios genéricos | Detrito tetraédrico irregular, partículas finas e bokeh reduzido |
| Descoberta | Links editoriais sobre massa abstrata | Os mesmos links HTML ancorados nos três organismos específicos |
| Fallback | Forma celular abstrata | Composição CSS com Giardia, T. cruzi e ovo de Trichuris |

Comparação visual direta:

- abertura anterior: `docs/evidence/phase23/round-3-scroll/scrub-000-1440.png`
- abertura atual: `docs/evidence/phase23/round-4-morphology/desktop-000.png`
- micromundo anterior: `docs/evidence/phase23/round-3-scroll/scrub-065-1440.png`
- micromundo atual: `docs/evidence/phase23/round-4-morphology/desktop-065.png` e `desktop-082.png`
- descoberta anterior: `docs/evidence/phase23/round-3-scroll/scrub-100-1440.png`
- descoberta atual: `docs/evidence/phase23/round-4-morphology/desktop-100.png`

## Evidência de navegador

Capturas e métricas novas: `docs/evidence/phase23/round-4-morphology/`.

- desktop 1440×900: 0%, 35%, 65%, 82% e 100%; sem erros de console/página;
- mobile 390×844: 0%, 65% e 100%; sem erros de console/página;
- reversibilidade: hash idêntico no mesmo progresso após avanço e retorno;
- `prefers-reduced-motion`: 0 canvas, 3 destinos HTML, sem overflow horizontal;
- WebGL indisponível: 0 canvas, 3 destinos HTML, sem overflow horizontal;
- homepage: 8 scripts inspecionados, 0 chunks com `WebGLRenderer`, `PMREMGenerator` ou `RoomEnvironment`, 0 canvas;
- render final em SwiftShader: 47 draw calls, 22.934 triângulos, 85 geometrias e 8 texturas no desktop. Esses números são de GL por software e não provam desempenho em GPU física.

## Verificações

- `npm test`: **188/188 PASS**;
- `npm run typecheck`: **PASS**;
- `npm run lint -- --quiet`: **PASS**;
- `npm run build`: **PASS** com Next.js 16.4.0;
- nenhum commit, push ou deploy executado.

## Escopo preservado

- progresso continua derivado da posição real do scroll;
- `renderSceneAt(progress)` continua determinístico e reversível;
- não foi introduzido vídeo, autoplay ou loop contínuo;
- os três destinos continuam links HTML reais;
- reduced motion e fallback sem WebGL continuam navegáveis;
- a homepage continua sem carregar o motor 3D;
- nenhuma dependência nova foi adicionada nesta rodada.
