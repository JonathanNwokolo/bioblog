# Phase 2.3 — Cinematic Experience Report

> **Nota:** a Rodada 2 (abaixo) descreve a arquitetura baseada em tempo (14,5 s, play/pause, rolagem global travada), **substituída** pela Fase 2.3.2. Ela é mantida como registro histórico; onde conflitar, vale a seção 2.3.2.

## Phase 2.3.2 — Scroll-Driven Cinematic Interaction

### Por que a timeline automática foi substituída

A Fase 2.3.1 era um vídeo interativo: `timelineProgress += delta / 14.5` dentro de um `requestAnimationFrame` contínuo, com play/pause/retomar/repetir, `overflow: hidden` global e uma camada `position: fixed` sobre o site. Isso contradiz a intenção da proprietária: o visitante não deve assistir à jornada, deve controlá-la. A reconstrução remove o relógio por completo. **A rolagem é o relógio.**

### Como o progresso é calculado

`src/cinematic/scrollProgress.ts` (puro, sem DOM nem three):

```
travel   = trackHeight - stageHeight          // percurso em que o palco fica preso
progress = clamp01( -trackRect.top / travel ) // 0 antes da trilha, 1 depois dela
```

A trilha é uma `<section>` de **520vh**; dentro dela o palco (`position: sticky; top: 0; height: 100dvh`) contém o canvas e toda a interface. `trackRect.top` vem de `getBoundingClientRect()` em um único `requestAnimationFrame` agrupado por quadro (listener `scroll` passivo + `ResizeObserver` do palco). Funciona com roda, touchpad, toque, teclado e barra de rolagem porque lê a posição real, não eventos `wheel`. Nada incrementa por tempo, e não há `preventDefault`, biblioteca de smooth-scroll nem scroll-snap.

### Cena determinística

`renderSceneAt(progress)` (`src/cinematic/engine.ts`) é a única operação que altera a imagem. Ela recebe `sampleJourney(progress)` (`src/cinematic/choreography.ts`, função pura) e aplica:

| Propriedade | Como depende do progresso |
| --- | --- |
| Posição, alvo e roll da câmera | Splines Hermite/Catmull–Rom com chaves **não uniformes** por progresso (11 chaves), no referencial óptico da objetiva |
| FOV | Spline escalar (39° → 37° → 43° → 52° → 49° → 44° → 42°) |
| Mundo biológico (opacidade, visibilidade) | `smoothstep(0,30; 0,70)` |
| Atmosfera: névoa, cor de fundo, exposição, ambiente | `smoothstep(0,38; 0,78)` |
| Luzes do instrumento | escala `1 − 0,62·biologyMix` |
| Luz interior | janela 0,20 → 0,30 → 0,44 → 0,54 |
| Rotação/respiração de membranas, organelas, fibras, bokeh, partículas | senóides de `progress`, sem acúmulo |
| Marcadores dos destinos | `smoothstep(0,885; 0,965)` |
| Elementos HTML (convite, dica, descoberta, barra de progresso) | funções puras de `progress` aplicadas direto ao DOM por ref |

Não há integração incremental nem estado acumulado; o frame em 0,42 é o mesmo avançando ou retrocedendo. A parallax de ponteiro da Fase 2.3.1 foi removida justamente por ser estado suavizado ao longo do tempo.

### Câmera

Referencial óptico: a objetiva e o micromundo vivem em um `Group` (posição `(1.68, −0.06, 0)`, rotação `(−0.1, 0.34, −0.08)`); o micromundo fica sobre o eixo óptico em `z = −18,5`. A câmera parte de uma vista em três quartos (`z = 9,4`), converge ao eixo (aproximação, 0–20%), atravessa a abertura e a pilha de lentes (20–45%), sai pela traseira da objetiva e percorre o vazio até as estruturas biológicas (45–70%), voa entre as células em primeiro plano (70–90%) e termina em uma pose de repouso diante do conjunto (90–100%), onde os destinos aparecem.

### Scroll reverso e saída do `sticky`

O reverso é consequência da pureza da função: `progress` decresce, `renderSceneAt` recebe o valor menor e redesenha o estado anterior. Ao fim da trilha o palco `sticky` é liberado pelo próprio fluxo do documento e o rodapé do site entra; nada global é travado (`body`/`html` mantêm `overflow` original; o cabeçalho do site é apenas ocultado nesta rota porque a jornada tem a própria barra).

### Efeitos baseados em tempo

**Nenhum.** O motor não tem `requestAnimationFrame` próprio: ele só desenha quando a posição de rolagem muda (> 1e-4 de progresso, ≈ 0,4 px). Em repouso, a GPU fica ociosa.

### Interface

Barra de progresso (`role="progressbar"`), rótulo e legenda da etapa, "Role para explorar", **Etapa anterior / Próxima etapa / Ir à descoberta** (alteram `scrollY`), **Versão sem movimento**, **Voltar ao site**. Região `role="status"` anuncia a etapa. Os três destinos são `<a>` reais, sempre na árvore de acessibilidade; focar um deles antes da revelação leva a rolagem à descoberta.

### Evidência de navegador (scroll real)

Capturas, métricas e vídeo estão em `docs/evidence/phase23/round-3-scroll/` (`qa-scrub-metrics.json` reúne os números; gerado por `tests/visual-qa-phase23-scroll.mjs` contra `next start`). Ambiente: Chromium headless, ANGLE/SwiftShader (**GL por software**). Toque é emulação CDP (`Input.dispatchTouchEvent`), não aparelho físico.

| Teste | Resultado observado |
| --- | --- |
| 9.1 Progresso direto (0, 10, 20, 35, 50, 65, 80, 90, 100%) | PASS — progresso e etapa corretos em todas as posições; `scrub-*-1440.png` |
| 9.2 Reversibilidade 0→25→70→40→90→10→100→0 | PASS — pose da câmera em 40% idêntica (7 números) e **hash SHA-256 da imagem idêntico** ao visitar 40% direto; retorno a 0% idêntico ao frame inicial |
| 9.3 Rolagem parada (35%, 60%, 85% por 3 s) | PASS — 0 novos renders, **0 chamadas a `requestAnimationFrame`**, pose e imagem idênticas |
| 9.4 Saltos (100→0→90→20→75→5→100→50%) | PASS — progresso e pose recuperados; pose em 50% estável após os saltos |
| Roda do mouse (24 notches, depois 12 de volta) | PASS — 0,19 → 0,38 → 0,57 → 0,73 avançando; 0,38 ao retroceder |
| Teclado (PageDown/End/Home) e controles de etapa | PASS — PageDown 0,203; End = 1 e alcança o fim do documento; Home = 0; Próxima → Travessia óptica; Anterior → Aproximação; Ir à descoberta → 0,97 |
| Foco em destino não revelado | PASS — focar o link do Atlas a 30% leva a rolagem a 0,97 |
| Saída da seção | PASS — `scrollY` chega ao fim do documento, rodapé visível, `overflow` de `html`/`body` = `visible`, palco `sticky` liberado |
| Back/forward | PASS — voltar do `/atlas` restaura 0,97 |
| Montar/desmontar ×4 | PASS — 1 canvas, 53 geometrias e 4 texturas constantes, heap JS 14–20 MB estável |
| Toque (6 gestos + reverso) | PASS (emulado) — 0,154 → 0,307 → … → 0,922; gesto reverso volta a 0,757 |
| Responsivo 1440/1280/768/390/320 | PASS — sem overflow horizontal; 3 destinos visíveis a 100%, nenhum a 0% e 50%; `responsive-*-{000,050,100}.png` |
| Movimento reduzido (390 e 1440) | PASS — 0 canvas, trilha oculta, versão estática com os 3 destinos; nenhum contexto WebGL é criado |
| WebGL indisponível | PASS — versão estática com os 3 destinos |
| "Versão sem movimento" | PASS — destrói o motor (0 canvas) e oferece "Ativar travessia" |
| Homepage sem o motor 3D | PASS — 9 scripts inspecionados, nenhum contém `WebGLRenderer`; 0 canvas |
| Console | 0 erros, 0 erros de página em todas as execuções |

**Vídeo:** `video/*.webm` (48,6 s, 1280×800) registra rolagem real por roda: avança lentamente, **para** (cena estável), **retrocede** até o interior da objetiva e volta a avançar até a descoberta. Os primeiros segundos mostram o carregamento em GL por software.

Durante o QA, os quadros de mobile revelaram sobreposições reais (legenda da etapa × barra inferior, dica de rolagem × texto, botão cortado em 320 px). Foram corrigidas (legenda oculta no mobile, dica no topo, rótulo curto "Sem movimento", barra inferior em duas linhas) e as capturas finais foram regeneradas.

### Desempenho

Todas as medidas abaixo vêm de GL por software e **não representam GPU física**.

| Medida | Valor |
| --- | ---: |
| Chunk do motor (apenas em `/explorar`, `import()` dinâmico) | 595 KB bruto / 147 KB gzip |
| Draw calls / triângulos (micromundo visível) | 55 / 69 686 |
| Geometrias / texturas | 89 / 7 |
| Renders para 60 eventos de roda | 55 (agrupados por quadro) |
| Custo de CPU por `renderSceneAt` (média / p95) | 70,9 ms / 245 ms (software) |
| Intervalo entre quadros durante rolagem contínua (média / p95) | 258 ms / 2 500 ms (software) |
| Render em repouso | nenhum (0 rAF em 3 s) |

Descobertas durante o QA, corrigidas: (1) o primeiro uso de cada programa de shader levava segundos em SwiftShader; o motor agora compila tudo de antemão (`warmUp()` com `compileAsync`) antes da primeira pintura guiada por rolagem; (2) partículas muito próximas da câmera viravam discos enormes — o tamanho do ponto é limitado a 22 px; (3) no micromundo, `transmission`, `clearcoat` e iridescência foram retirados (translucidez por alpha), reduzindo programas e passes de renderização. A qualidade gráfica adapta o pixel ratio (1,75 → 1 → 0,8) pela cadência real dos quadros durante a rolagem; `?quality=high|medium|low` força um nível e desliga a adaptação (usado no QA).

### Acessibilidade

- Nenhuma reprodução automática; nada se move sem rolagem.
- Teclado: a rolagem nativa funciona; botões de etapa; foco visível; foco num destino leva à descoberta.
- Leitor de tela: região `role="status"` anuncia "Etapa n de 5"; barra `role="progressbar"`; links dos destinos sempre na árvore de acessibilidade.
- `prefers-reduced-motion`: decidido por CSS (sem flash) e por `matchMedia`; versão estática editorial com as quatro etapas em texto.
- Alternativa explícita "Versão sem movimento" e retorno "Ativar travessia".

### Arquivos desta rodada

Novos: `src/cinematic/scrollProgress.ts`, `src/cinematic/choreography.ts`, `tests/cinematic-scroll.test.ts` (16 testes), `tests/visual-qa-phase23-scroll.mjs`. Reescritos: `src/cinematic/engine.ts`, `src/cinematic/sceneBuilder.ts`, `src/cinematic/types.ts` (posições dos destinos), `src/cinematic/runtime/index.ts`, `src/cinematic/README.md`, `src/app/explorar/{CinematicExperience.tsx,explorar.module.css,layout.tsx,page.tsx}`. `tests/visual-qa-phase23.mjs` (Rodada 2) foi marcado como obsoleto. Nenhuma alteração em CMS, Supabase, NCBI/CDC/GBIF, ordem da homepage ou dependências.

### Regressões

| Verificação | Resultado |
| --- | --- |
| `npm test` | PASS — 188 testes (172 anteriores + 16 novos), 0 falhas |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm audit --omit=dev` | PASS — 0 vulnerabilidades |
| HTTP | `/`, `/atlas`, `/laboratorio`, `/onde-vivem`, `/diario`, `/ciencia`, `/explorar` = 200; `/admin` → 307 `/admin/login` |

### Limitações

1. **Sem GPU nem aparelho físico.** Cadência real em desktop/celular não medida; a adaptação de pixel ratio está implementada mas não foi exercida (o QA usou `?quality=`); toque é emulado.
2. **Qualidade visual ainda abaixo da meta.** A travessia interior melhorou (reflexos de ambiente, pilha de lentes, rosca, trilhos, parafusos), mas ainda lê como anéis concêntricos nos quadros centrais; perto das lentes o vidro de transmissão desfoca o quadro (cinematográfico, porém não revisado); o micromundo permanece abstrato e "bolhoso". Não houve revisão visual independente nesta rodada.
3. Marcadores e linhas-guia foram posicionados para proporções ≈ 16:10; em outras proporções os marcadores caem em outros pontos da cena (as linhas-guia acompanham).
4. `html { scroll-behavior: smooth }` (global do site) faz os botões de etapa e o teclado deslizarem nativamente; a posição continua sendo a fonte de verdade, mas é rolagem suave do navegador, não animação própria.
5. O cabeçalho do site é ocultado nesta rota por uma regra CSS no layout (`#topo`); a jornada tem barra própria.
6. Perda de contexto WebGL: tratamento implementado (4 s de espera, depois versão estática), não exercitado em teste.
7. Sem teste manual com leitor de tela, nem auditoria manual completa da ordem de foco.
8. Pendências da proprietária: elenco de organismos, texto final da jornada e aprovação visual da direção de arte.

### Veredito da Fase 2.3.2

**PARTIAL.**

- **Interação principal — atende aos critérios 1–6 e 8–11:** a rolagem governa diretamente o progresso; não há reprodução automática nem dependência dos 14,5 s; parar interrompe; o reverso reconstrói estados idênticos (pose e imagem); o palco `sticky` não aprisiona a navegação; a descoberta está integrada à cena e os destinos são links HTML; há fallback acessível; desktop, tablet e mobile (emulado) funcionam; QA de navegador e regressões passam.
- **Por que não PASS:** o critério 7 (continuidade espacial convincente, sem parecer sequência de slides) e o 12 (melhora visual *demonstrada*) só foram atendidos em parte — há capturas e vídeo, mas sem revisão independente, sem medição em GPU física e com o interior da objetiva ainda aquém de 8/10.
- **Próximos passos:** perfilar em um desktop e um celular físicos; revisar o vídeo com um segundo avaliador; enriquecer a travessia interior (elementos assimétricos visíveis no quadro central) e o micromundo; validar com a proprietária a calibração (`JOURNEY_TRACK_VH` = 520 e as chaves de `choreography.ts`).

---

## Round 2 — Phase 2.3.1 reconstruction

**Verdict: PARTIAL.** The reconstruction is materially different from the rejected implementation and the functional acceptance checks pass, but the visual-quality target is not met: several categories remain below 8/10, the overall craft remains below 9/10, and no physical-device GPU measurement was performed.

### Baseline diagnosis

The rejected evidence is preserved in `docs/evidence/phase23/scene-01-invitation.png` through `scene-04-discovery.png`. Its main problems were a flat gold portal-like lens, a radial-fan traversal, star-like particles, a small collection of glowing blobs and a conventional card-row climax. The result communicated “procedural WebGL demo” more strongly than precision optics or microscopy.

### Why the previous version was not cinematic enough

The previous visual system had no convincing mechanical silhouette, insufficient optical depth, weak material separation and no continuous visual bridge between instrument and biological scale. The camera revealed procedural geometry instead of moving through a constructed objective, while the final cards visually detached navigation from the journey. Automated correctness could not compensate for those compositional defects.

### Architecture: before and after

| Area | Rejected version | Round 2 |
| --- | --- | --- |
| Optical object | Flat circular/torus-led assembly | Profile-driven `LatheGeometry` housing, retaining tube, collars, rings, instanced knurl, aperture and two convex lens elements |
| Camera | Procedural-looking reveal | Deterministic Catmull–Rom position and target paths with keyed 39° → 52° → 42° FOV |
| Scene transition | Distinct scene replacement | Instrument and biological volumes overlap through a progressive 0.30–0.62 timeline crossfade |
| Particles | Bright space-like field | Seeded, restrained suspended matter with low opacity and layered depth |
| Microworld | Sparse glowing spheres | Distorted membranes, cytoplasm, nucleus, vesicles, folds and curved filaments |
| Discovery | Three dashboard cards | Asymmetric editorial observation paths integrated over the frozen biological scene; navigation remains HTML |
| Runtime | Continuous rendering risk | Demand rendering while idle/final, one controlled RAF during travel, deterministic seeking and explicit resource disposal |
| Fallback | Functional fallback | Polished static discovery composition for reduced motion and WebGL failure |

The implementation remains local to `src/app/explorar` and `src/cinematic`; the application architecture, CMS, scientific providers and Supabase schema were not rewritten.

### Optical assembly, materials and lighting

The objective is generated in code from rotational profiles. Graphite housing materials use controlled metalness, roughness and clearcoat variation; the convex lens elements use transmission, thickness and IOR; mint and lilac coatings are restrained to highlights. A studio-style key, rim, front fill, hemisphere fill and biological light rig replaces arbitrary portal lighting.

No external 3D model, HDRI, image, video or generated biological asset was added. All Round 2 scene geometry is procedural and project-authored, so there is no third-party attribution or license requirement and no external asset file size to report.

### Camera, timing and state

The deterministic traversal lasts **14.5 seconds**. It approaches the front element, crosses the aperture, changes FOV through the optical interior and continues into the biological volume without camera spins. Start, pause, resume, skip and replay were exercised by the browser QA. Replay returned to `intro`; pause exposed the resume state; the three required destinations remained reachable.

### Microscopic environment and discovery

The microscopic scene uses deliberately abstract biological forms and is labeled as an artistic, non-diagnostic visualization. It does not claim to be a microscope photograph, a validated organism or exact anatomy. The final interface exposes exactly the principal destinations `/atlas`, `/laboratorio` and `/onde-vivem` as semantic links, while retaining separate site-return links.

### Evidence and comparison

Rejected baseline evidence remains under `docs/evidence/phase23/`. Round 2 captures are under `docs/evidence/phase23/round-2/`:

- `stage-01-invitation-1440.png` — rebuilt objective and editorial invitation.
- `stage-02-approach-1440.png` — mechanical approach.
- `stage-03-optical-traversal-1440.png` — interior housing and progressive biological reveal.
- `stage-04-microscopic-reveal-1440.png` — final change of scale.
- `stage-05-discovery-1440.png` — spatial discovery composition.
- `responsive-*` — invitation and discovery at 1440, 1280, 768, 390 and 320 px.
- `fallback-reduced-motion-390.png` and `fallback-no-webgl-1440.png` — settled static fallbacks.
- `interaction-paused-1440.png` — paused control state.
- `qa-metrics.json` — machine-readable browser observations.

### Performance measurements

The production build was measured in headless Chromium using ANGLE/SwiftShader. These results are software-rendering evidence and must not be represented as desktop- or mobile-GPU performance.

| Measurement | Result |
| --- | ---: |
| Average sampled frame time | 24.59 ms |
| P95 sampled frame time | 100 ms |
| Slow sampled frames | 4 / 40 |
| Draw calls | 26 |
| Triangles | 44,928 |
| Geometries | 13 |
| Textures | 2 |
| Observed response `Content-Length` | 1,360,250 bytes |
| Console errors / page errors | 0 / 0 |

The viewport matrix covers 1440×900, 1280×800, 768×1024, 390×844 and 320×568. Mobile layout is therefore simulated only; no representative physical phone or desktop GPU was profiled. Memory stability after many replay cycles and context-loss recovery were implemented structurally but not proven with a long-running heap/GPU trace. The homepage bundle-separation architecture remains route-local, but this round did not produce a browser coverage trace proving every chunk boundary.

### Accessibility results

The experience does not autoplay. Start, pause/resume, skip, replay and return controls are semantic buttons or links with visible focus styling. The discovery destinations are ordinary HTML links rather than WebGL picking targets. `prefers-reduced-motion` opens the polished static discovery state, and WebGL failure resolves to the same navigable fallback. Page scroll is locked only while the fixed cinematic route is mounted and restored on cleanup.

Browser automation confirmed the reduced-motion and no-WebGL destinations, responsive layout and control transitions. A complete manual screen-reader pass, full keyboard focus-order audit and physical mobile touch test were not performed and remain acceptance risks.

### Automated regression results

Final local run on 2026-10-12:

| Check | Result |
| --- | --- |
| `npm test` | PASS — 172 tests, 0 failures |
| `npm run typecheck` | PASS |
| `npm run lint -- --quiet` | PASS |
| `npm run build` | PASS — Next.js 16.4.0 production build |
| `npm audit --omit=dev` | PASS — 0 vulnerabilities |

The test runner still emits existing `MODULE_TYPELESS_PACKAGE_JSON` warnings; they are not test failures. Final production-server checks returned HTTP 200 for `/`, `/atlas`, `/laboratorio`, `/onde-vivem` and `/diario`; `/admin` returned its expected HTTP 307 redirect to `/admin/login`. The visual run reported no console or page errors. Browser back navigation from `/atlas` returned to `/explorar`.

### Independent review and correction pass

An independent read-only reviewer assessed the first Round 2 evidence as **PARTIAL**, with an approximate 6.8/10 average. Scores were: optical credibility 7.0, materials 6.5, lighting 6.5, camera 6.0, depth 6.5, atmosphere 6.0, transition 5.5, typography 8.2, discovery 7.8 and originality 7.0.

The reviewer identified three major defects: the microworld still leaned toward blob/space imagery, the world appeared through a binary timeline cut, and fallback screenshots were captured during their entrance fade. The follow-up changed the biological reveal to a progressive crossfade, added membrane filaments and fill lighting, and delayed fallback capture until the composition settled. The new evidence was inspected after those corrections, but no second independent score was obtained; the original reviewer scores therefore remain the only independent scores.

### Final self-assessment

| Category | Score | Evidence-bound assessment |
| --- | ---: | --- |
| Optical credibility | 7.5 | Recognizable layered objective; housing is still a stylized interpretation rather than model-grade industrial detail. |
| Materials and reflections | 7.0 | Convex glass and differentiated metal read clearly; reflections remain generated by the local light rig rather than an authored laboratory environment. |
| Lighting | 7.0 | Controlled key/rim/fill hierarchy; the interior traversal remains intentionally dark and loses some form separation. |
| Camera choreography | 6.8 | Deterministic continuous curve and FOV changes; screenshots cannot prove motion cadence, and no motion-capture review was produced. |
| Depth and scale | 7.2 | Strong foreground/medium/background overlap; biological forms can still read as oversized blobs. |
| Microscopic atmosphere | 6.8 | No starfield and improved suspended matter; insufficient fine biological complexity prevents a more credible microscopy impression. |
| Transition quality | 7.0 | Progressive optical-to-biological crossfade replaces the hard cut; it remains an approximation rather than refractive transformation. |
| Typography and composition | 8.2 | Editorial hierarchy and negative space are coherent across breakpoints. |
| Discovery scene | 8.0 | Conventional cards were replaced with an integrated spatial list while preserving accessible HTML navigation. |
| Creative originality | 7.3 | Distinctly more authored than the baseline, but the microworld vocabulary is not yet singular enough for 9/10 craft. |

**Overall self-assessment: 7.3/10 — PARTIAL.** No score is raised merely because the implementation compiles or the controls work.

### Unresolved risks and recommended next round

1. Replace the central blob-led biology with more membrane detail, anisotropic fiber networks and at least one visually specific microscopy-inspired structure, reviewed by a scientific subject-matter expert before making factual claims.
2. Review a recorded traversal rather than isolated frames, then tune curve velocity, focus cues and the 0.30–0.62 blend interval.
3. Profile on one representative desktop GPU and one midrange physical phone; record frame-time distribution, thermal behavior and replay memory over repeated runs.
4. Complete manual keyboard, screen-reader and physical touch testing.
5. Obtain a second independent visual review after those changes. The current work should not be promoted from PARTIAL until the below-8 categories and physical-device evidence are resolved.
