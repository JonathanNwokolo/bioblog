# `src/cinematic/` — experiência cinematográfica guiada pela rolagem

**Estado (Fase 2.3.2):** o runtime existe e é carregado somente em `/explorar`, por
`import()` dinâmico a partir do componente cliente. A homepage continua sem
Three.js nem assets 3D (verificado nos chunks de produção; ver o relatório da
fase em `docs/phase23-cinematic-experience-report.md`).

## Princípio central

> O visitante não assiste à animação: ele a controla rolando a página.

A **posição de rolagem real é a única fonte de verdade**. Não existe relógio,
`deltaTime`, play/pause nem laço de animação próprio.

## Módulos

| Arquivo | Papel | Depende de |
| --- | --- | --- |
| `scrollProgress.ts` | Progresso `[0,1]` a partir da geometria da trilha; etapas; visibilidade narrativa | nada (puro) |
| `opticalTransition.ts` | Contrato da travessia óptica: fases, visibilidade instrumento/amostra, limitador de campo, brilho, foco, janelas dos organismos | `scrollProgress` (puro) |
| `choreography.ts` | `sampleJourney(progress)`: pose de câmera (dois trechos, antes/depois do corte), FOV e estado óptico | `scrollProgress`, `opticalTransition` (puro) |
| `sceneBuilder.ts` | Geometria/materiais: objetiva, pilha óptica, micromundo, partículas, âncoras de destino | three |
| `organismMotion.ts` | Movimento LOCAL dos organismos: parâmetros (artísticos, rotulados), pose `f(tempo local)`, agendador de quadros, composição por viewport | `opticalTransition` (puro) |
| `organisms.ts` | `OrganismSystem`: folhas de relevo deformadas na GPU (*Giardia*, *T. cruzi*) e sólido de revolução (ovo de *Trichuris*); âncoras projetadas | three |
| `organismManifest.ts` | **Gerado** por `scripts/prepare-organism-assets.mjs`: dimensões, âncoras derivadas do alfa, perfil do ovo | — |
| `engine.ts` | `renderSceneAt(progress)`; laço de movimento local sob demanda; qualidade adaptativa; ciclo de vida WebGL | three |
| `types.ts` | Destinos científicos (`CINEMATIC_HOTSPOTS`), tiers gráficos | — |
| `contract.ts`, `runtime/` | Contrato do ponto de montagem da homepage (um quadro estático em progresso 0) | engine |

## Regras

1. **Determinismo.** O estado em `progress = p` não pode depender de como se
   chegou a `p`. Proibido: somar `delta` a rotações/posições/opacidades, filtros
   temporais (lerp por quadro), `Math.random()` em tempo de execução, relógio.
2. **Sem laço próprio.** Quem chama `renderSceneAt` é o controlador de rolagem
   (um `requestAnimationFrame` agrupado por quadro, disparado por `scroll`).
   Sem rolagem, nenhum quadro é desenhado.
3. **Sem sequestro de rolagem.** Nada de `preventDefault` em `wheel`/`touchmove`,
   `overflow: hidden` global, `position: fixed` sobre o site, scroll-snap
   obrigatório ou biblioteca de smooth-scroll.
4. **Reversibilidade testada.** `tests/cinematic-scroll.test.ts` cobre progresso,
   limites, saltos e reversibilidade; `tests/visual-qa-phase23-scroll.mjs` cobre o
   navegador real.
5. **Organismos (Fase 2.3.9):** *Giardia duodenalis* (trofozoíto), *Trypanosoma cruzi*
   (tripomastigota sanguíneo) e ovo de *Trichuris trichiura* são reconstruções editoriais
   rotuladas como não diagnósticas. Os parâmetros de movimento são interpretação artística
   (ver `MOTION_EVIDENCE`); nenhuma frequência ou mecânica é apresentada como medida biológica.
6. **Acessibilidade:** os destinos são `<a>` HTML. `prefers-reduced-motion` e falta
   de WebGL abrem a versão estática; o visitante também pode escolhê-la.

## Calibração

`JOURNEY_TRACK_VH` (600) e as chaves de `choreography.ts` são parâmetros de
direção. Ajustar só após QA visual com rolagem real.

## Movimento local dos organismos (Fase 2.3.9)

Duas coisas diferentes, nunca misturadas:

| | Progresso narrativo | Movimento local |
| --- | --- | --- |
| Fonte | posição real de rolagem | `motionTime` (relógio próprio, em segundos) |
| Controla | câmera, transição óptica, revelação, composição, marcadores | ondulação flagelar, flexão, rotação lenta do corpo |
| Determinismo | `f(progress)`, reversível | `f(progress, motionTime)`; congelar `motionTime` congela a pose |
| Quadros | um por mudança de rolagem (agrupado em rAF) | rAF contínuo (~30 Hz) **somente** com organismo móvel revelado |

Regras do laço local (`engine.syncMotionLoop` / `shouldRunMotion`):

1. Corre só quando há motilidade ativa visível (`motionAmount > 0`) **ou** a inspeção ainda está assentando.
2. Para com: pausa do visitante, aba oculta, `prefers-reduced-motion`, perda de contexto, descarte.
3. Nunca altera câmera, progresso nem rolagem; nunca soma tempo ao progresso.
4. O ovo de *Trichuris* não tem motilidade; só gira por ação do visitante (painel de inspeção).
5. Marcadores e anotações são projetados com as MESMAS funções do shader (`trypanosomaFlexOffset`,
   uniforms de pose), de modo que não se afastam do alvo.
6. Nada é alocado por quadro: só uniforms e transformações.

QA determinístico: `__MICROCOSMOS_CINEMATIC__.motion.freezeAt(t)` congela a fase; só então a
comparação de pixels entre visitas ao mesmo progresso é válida (ver `tests/visual-qa-phase239*.mjs`).
