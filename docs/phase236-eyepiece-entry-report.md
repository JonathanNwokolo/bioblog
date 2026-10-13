# Fase 2.3.6 — Entrada pela ocular superior (correção crítica)

Rota `/explorar`. Sem commit, push, deploy ou alterações no Supabase.

## Diagnóstico

A câmera da Fase 2.3 voava para `z ≈ 1,0` e depois subia pelo eixo da **objetiva inferior** (chaves em `[0, 0.04, 1.02] → [0.12, 0.12, -1.2]`, alvo `selected-objective-100x`). Além disso, o vidro das oculares estava construído na ponta de **baixo** do tubo: a normal externa de `ocular-glass` (`+z` do grupo, rotação X −0,35) apontava `(0.08, 0.34, 0.94)`, isto é, para a base. Entrar "pelo vidro" a partir dessa normal significaria chegar por baixo.

## Correção

| Item | Antes | Depois |
|---|---|---|
| Alvo da aproximação | objetiva 100× (frente, `z≈0,72`) | vidro da **ocular direita** (tela), centro `(0.664, 1.619, -4.833)` |
| Normal externa do vidro | `(0.08, 0.34, 0.94)` (para baixo) | `(-0.080, 0.406, -0.910)` (para cima e para o observador) |
| Orientação das oculares | olho para a base | olho para cima, inclinado 0,42 rad para o observador (`EYEPIECE_SPEC`) |
| Travessia | subia pela objetiva, atravessava o cabeçote | segue `-normal` pelo tubo da ocular |
| Micromundo | origem fixa em `z=-11,6` | ancorado no eixo óptico (`OBSERVATION_DEPTH = 8,5`), alinhado à normal |

Ocular escolhida: **`eyepiece-right`** (direita na vista frontal), a circulada na captura anotada; mantida em toda a jornada.

Trajetória nova (progresso): 0–0,20 instrumento completo · 0,20–0,40 sobe pelo lado do observador até o eixo da ocular · 0,40–0,55 alinhamento frontal, vidro preenche o campo · 0,55–0,70 travessia por `-normal` com fade instrumento→micromundo · 0,70–0,95 observação (chaves originais, transformadas rigidamente) · 0,95–1 descoberta.

## Arquivos

- `src/cinematic/opticalEntry.ts` (novo): especificação das oculares e entrada nominal (pura).
- `src/cinematic/choreography.ts`: `buildJourneyPath(entry)`; curva derivada do centro/normal; `sampleJourney(p, path)` continua puro.
- `src/cinematic/engine.ts`: mede o vidro nos `matrixWorld`; grupo `observation-frame`; `up` por amostra; auditoria de colisão; depuração.
- `src/cinematic/opticsDebug.ts` (novo): overlay (centro, normal, eixo, curva, direção, pontos de passagem). Só com `?debug=optics` **e** `NODE_ENV !== "production"`.
- `src/cinematic/microscopeAsset.ts`: oculares com nomes e orientação corrigida (única alteração de modelo; silhueta preservada).
- `src/cinematic/scrollProgress.ts`, `src/app/explorar/CinematicExperience.tsx`: textos (ocular), etapas (`scale` 0,4–0,7; `micro` 0,7–0,88).
- `tests/cinematic-scroll.test.ts`, `tests/visual-qa-phase236.mjs`.

## Evidência

- Geometria medida == nominal (`debug/report.json`). Auditoria de raios 0–0,56: **0 colisões**. 0,56–0,70: 6 interseções, todas com o conjunto vidro/copo da própria ocular e com cabeçote/prisma durante a travessia simbólica, quando o instrumento já está transparente (alpha 0 a partir de ≈0,59).
- Capturas: `docs/evidence/phase23/round-7-eyepiece-entry/` (`000`…`100`, `debug/vista-*.png` com normal/eixo/curva, `mobile/`).
- Testes: 190/190; typecheck e lint limpos.

## Limitações honestas

- O interior (0,56–0,60) é uma interpretação abstrata: a câmera atravessa o tubo e o cabeçote enquanto o instrumento se dissolve; os frames 0,57–0,59 mostram a face interna do cabeçote.
- Em mobile (390 px) as oculares ficam rente ao topo no quadro inicial.
- Reversibilidade verificada por teste (função pura) e por seek avançando; não foi gravado vídeo.
