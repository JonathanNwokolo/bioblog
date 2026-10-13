# Microcosmos — Fase 2.3.4

## Veredito honesto

| Gate | Estado | Evidência / limite |
| --- | --- | --- |
| Engenharia local | **PASS** | 188 testes, typecheck, lint e build aprovados; QA de navegador sem erros nas rotas verificadas. |
| Visual interno | **PASS provisório** | A inspeção das capturas confirma microscópio composto reconhecível, percurso espacial até a objetiva, três momentos biológicos e painel responsivo. O **visual PASS do owner continua pendente**. |
| Ciência | **PENDENTE** | Textos e estruturas foram limitados às referências CDC DPDx, mas as reconstruções continuam artísticas, não diagnósticas e dependem da revisão de Ynara/especialista. |
| Performance física | **NÃO COMPROVADA** | O teste automatizado usou Chromium headless com ANGLE/SwiftShader. Esses tempos de CPU não equivalem a FPS/GPU de um dispositivo real. |
| Licenciamento | **PASS para o que foi entregue** | Nenhum modelo ou micrografia externo foi publicado. O microscópio e os organismos são geometria original do projeto; o candidato CC0 pesquisado foi rejeitado e retido apenas como evidência. |

Não houve commit, push, deploy, migração Supabase ou alteração de billing.

## O que foi entregue

- Abertura clara com microscópio composto completo: oculares binoculares, cabeçote, revólver, quatro objetivas, platina mecânica com abertura, condensador, controles X/Y, foco grosso/fino, braço e base.
- Materiais separados em grafite, metal, vidro e esmalte, com fundo de estúdio neutro e iluminação própria da abertura.
- Jornada determinística em cinco atos: instrumento (0–20%), objetiva (20–40%), transição óptica (40–55%), parasitologia (55–88%) e descoberta (88–100%).
- Transição pela lente frontal sem túnel radial, portal ou alegação de deslocamento físico literal.
- Três reconstruções interativas: *Giardia duodenalis* (trofozoíto), *Trypanosoma cruzi* (tripomastigota sanguíneo) e *Trichuris trichiura* (ovo).
- Hotspots `+` ancorados às projeções dos organismos no canvas, com painel `dialog`, foco inicial, contenção de Tab, fechamento por Escape, retorno de foco e links HTML reais.
- Contrato de painel: o progresso é congelado; roda/toque fora do painel não avançam a jornada; o painel possui rolagem própria; fechar restaura exatamente o progresso anterior.
- Hub final editorial integrado à cena com links para `/atlas`, `/laboratorio` e `/onde-vivem`, sem dashboard de cards.
- Fallbacks sem WebGL e para `prefers-reduced-motion`, ambos sem canvas e com os três destinos acessíveis.

## Checkpoints

### A — Microscópio

**Aprovado internamente.** A composição de abertura mostra o instrumento inteiro antes da transição. O modelo é procedural Three.js, porém não é uma aproximação de cilindro isolado: as peças são hierárquicas e têm posições mecânicas coerentes. A opção por autoria procedural foi mantida depois que o único candidato gratuito inspecionado mostrou baixa fidelidade (1.264 triângulos e aparência low-poly).

### B — Aproximação por rolagem

**Aprovado tecnicamente.** A câmera parte do instrumento completo, estabelece o revólver, centraliza a objetiva selecionada e chega ao elemento frontal. A pose é função pura do progresso e a captura em 62% é idêntica na ida direta e após ida/volta (`1453769ea55a34ea`).

### C — Giardia

**Aprovado como prova técnica e visual interna; ciência pendente.** A reconstrução usa contorno piriforme, simetria bilateral, dois núcleos, contexto de disco ventral, corpos medianos e oito flagelos. O hotspot e o painel são funcionais em desktop e mobile.

### D — Organismos restantes

**Aprovado como implementação; ciência pendente.** O tripomastigota de *T. cruzi* preserva corpo alongado/curvo, membrana ondulante, flagelo, núcleo e cinetoplasto. O ovo de *Trichuris* usa silhueta em barril, casca e tampões bipolares, em vez de cápsula oval genérica.

### E — Experiência final

**Aprovado tecnicamente.** Hub, responsividade, teclado, toque, reduced motion, fallback WebGL e restauração da rolagem foram exercitados no navegador.

### F — Revisão visual independente

**Revisão interna concluída; owner pendente.** As capturas reais foram inspecionadas e corrigidas, inclusive composição do microscópio, escala isolada dos organismos, integração final e legibilidade do painel móvel. Como não houve revisão humana externa nesta execução, o estado não é promovido a visual PASS definitivo.

## Quadro de morfologia e proveniência

| Organismo / estágio | Referência | Características usadas | Limites e suposições para revisão |
| --- | --- | --- | --- |
| *Giardia duodenalis*, trofozoíto | [CDC DPDx — Giardiasis](https://www.cdc.gov/dpdx/giardiasis/index.html) | Forma piriforme, simetria bilateral, dois núcleos grandes, disco ventral, corpos medianos, oito flagelos. | Espessura, curvatura, cor, transparência e pose são interpretação editorial. |
| *Trypanosoma cruzi*, tripomastigota sanguíneo | [CDC DPDx — American Trypanosomiasis](https://www.cdc.gov/dpdx/trypanosomiasisamerican/index.html) | Corpo alongado com curvatura em C, núcleo central, cinetoplasto terminal/subterminal, membrana ondulante e flagelo. | Amplitude da membrana, espessura e pose tridimensional são estilizadas. |
| *Trichuris trichiura*, ovo | [CDC DPDx — Trichuriasis](https://www.cdc.gov/dpdx/trichuriasis/index.html) | Silhueta em barril, casca espessa e tampões bipolares. | Cor, translucidez, rugosidade e conteúdo interno são interpretação não diagnóstica. |

Nenhuma barra de escala, magnificação fabricada ou micrografia real foi adicionada. Os painéis identificam explicitamente as peças como reconstruções artísticas educacionais pendentes de revisão especializada.

## Pesquisa de modelo e licença

- Candidato inspecionado: [University Lecture Hall and Campus Microscope, 3Dassets.dev](https://3dassets.dev/assets/university-lecture-hall-and-campus-microscope-c9d6c890), declarado CC0 1.0 na página de origem.
- Decisão: **rejeitado** por baixa densidade geométrica e proporções/peças insuficientes para o gate visual.
- Evidência arquivada: `references/rejected-cc0-compound-microscope.glb` e poster da origem. Esses arquivos não são carregados pela aplicação.
- Asset entregue: geometria original em `src/cinematic/microscopeAsset.ts`; portanto não há licença de terceiro a propagar no runtime.
- Referência de direção: captura do site Biological Preparations guardada apenas para comparação. Nenhum asset, modelo, branding, código ou composição exata foi copiado.

## Evidência visual

- Abertura: [`desktop-opening.png`](evidence/phase23/round-5-interactive/desktop-opening.png)
- Aproximação da objetiva: [`desktop-objective.png`](evidence/phase23/round-5-interactive/desktop-objective.png)
- Transição óptica: [`desktop-optical-transition.png`](evidence/phase23/round-5-interactive/desktop-optical-transition.png)
- Giardia e hotspot: [`desktop-giardia.png`](evidence/phase23/round-5-interactive/desktop-giardia.png)
- *T. cruzi*: [`desktop-t-cruzi.png`](evidence/phase23/round-5-interactive/desktop-t-cruzi.png)
- Ovo de *Trichuris*: [`desktop-trichuris.png`](evidence/phase23/round-5-interactive/desktop-trichuris.png)
- Painel desktop: [`desktop-giardia-panel.png`](evidence/phase23/round-5-interactive/desktop-giardia-panel.png)
- Hub final: [`desktop-discovery.png`](evidence/phase23/round-5-interactive/desktop-discovery.png)
- Mobile: [`mobile-opening.png`](evidence/phase23/round-5-interactive/mobile-opening.png), [`mobile-giardia.png`](evidence/phase23/round-5-interactive/mobile-giardia.png), [`mobile-giardia-panel.png`](evidence/phase23/round-5-interactive/mobile-giardia-panel.png) e [`mobile-discovery.png`](evidence/phase23/round-5-interactive/mobile-discovery.png)
- Reduced motion: [`fallback-reduced-motion-390.png`](evidence/phase23/round-5-interactive/fallback-reduced-motion-390.png)
- Sem WebGL: [`fallback-no-webgl-1440.png`](evidence/phase23/round-5-interactive/fallback-no-webgl-1440.png)
- Métricas e contratos verificáveis: [`qa-metrics.json`](evidence/phase23/round-5-interactive/qa-metrics.json)

## QA funcional e acessível

No contrato medido do painel Giardia:

- progresso antes: `0.6201058201058202`;
- progresso durante leitura/scroll: `0.6201058201058202`;
- progresso após fechar: `0.6201058201058202`;
- Escape fechou o diálogo;
- foco retornou ao hotspot `giardia`;
- zero erros de console/página;
- painel mobile visível, sem overflow horizontal próprio ou da página.

A reversibilidade foi comparada por hash de screenshot em 62%: ida direta e retorno após 94% produziram o mesmo hash. A suíte também verifica matematicamente pureza, continuidade, chaves exatas, clamp e progresso derivado apenas da rolagem.

As rotas `/`, `/atlas`, `/laboratorio`, `/onde-vivem`, `/diario` e `/admin/login` responderam HTTP 200 em viewport 1280×800, sem overflow horizontal, erro de console ou erro de página.

## Performance medida

O asset estático de fallback tem 35.642 bytes. Não há GLB nem textura externa do microscópio no runtime.

No frame mais pesado observado do desktop high (abertura), o renderer reportou:

- 172 draw calls;
- 133.430 triângulos;
- 99 geometrias;
- 7 texturas;
- pixel ratio adaptado para 1 no harness.

Os tempos de CPU do JSON são deliberadamente mantidos como evidência, mas **não recebem PASS de GPU**: SwiftShader é renderização por software e inclui aquecimento/compilação de shaders. É necessária medição num navegador em hardware físico antes de afirmar FPS, fluidez de dispositivo ou orçamento de frame.

## Regressão executada

| Comando | Resultado |
| --- | --- |
| `npm test` | PASS — 188/188 |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS — Next.js 16.4.0, `/explorar` prerenderizada |
| `npm audit --omit=dev` | PASS — 0 vulnerabilidades |

## Pendências que não podem ser promovidas por engenharia

1. Owner deve decidir se a linguagem visual atingiu o nível esperado; a inspeção interna não substitui essa aprovação.
2. Ynara/especialista deve revisar morfologia, texto e relações entre estrutura e estágio antes de qualquer alegação de aprovação científica.
3. Performance deve ser medida em ao menos um desktop e um telefone físicos representativos.

