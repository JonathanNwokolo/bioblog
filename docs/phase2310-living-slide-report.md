# Microcosmos — Fase 2.3.10 — The Living Slide

Data da revisão: 13 de outubro de 2026  
Escopo: `/explorar`, somente ambiente local, sem commit, push, deploy ou alteração de dados externos.

## Veredito

[Certeza] **Aceitação visual: PASS — 8,9/10.** Os três capítulos agora têm mundos microscópicos distinguíveis, transições contínuas e tempo físico suficiente para leitura nos cinco viewports exigidos.

[Certeza] **Aceitação científica para publicação: HOLD.** O ativo existente de *Trypanosoma cruzi* mantém uma leitura ambígua da posição do cinetoplasto. A fase não deve ser chamada de cientificamente aprovada até revisão de Ynara. O texto da interface permanece deliberadamente geral e não rotula essa estrutura.

## 1. Auditoria antes da intervenção

[Certeza] A implementação anterior usava um único campo verde genérico para os três organismos, com fibras longas, anéis e partículas reaproveitados. A sequência biológica ocupava aproximadamente o trecho final de uma trilha de `600vh`, comprimindo encontro, contemplação e saída.

[Certeza] As capturas de base estão em [`before/`](./evidence/phase23/round-10-living-slide/before/), com medidas em [`baseline.json`](./evidence/phase23/round-10-living-slide/before/baseline.json).

## 2. Pesquisa e tradução visual

| Preparação | Evidência usada | Tradução aplicada | Limite declarado |
|---|---|---|---|
| *Giardia* — trofozoíto | [CDC DPDx — Giardiasis](https://www.cdc.gov/dpdx/giardiasis/index.html): trofozoítos em fezes/fluido duodenal, montagem a fresco e coloração como contextos diagnósticos | Campo salino fresco verde-oliva, granulação fina, matéria orgânica irregular, poucos filamentos curtos e profundidade suave | Campo educacional ilustrativo; não é lâmina diagnóstica nem reprodução de uma micrografia |
| *T. cruzi* — tripomastigota sanguíneo | [CDC DPDx — American Trypanosomiasis](https://www.cdc.gov/dpdx/trypanosomiasisamerican/index.html): tripomastigotas circulantes em esfregaço sanguíneo, morfologia e coloração | Campo lilás/rosa inspirado em Giemsa, hemácias planas com palidez central, distribuição irregular e grânulos discretos | Resposta cromática inspirada, não simulação colorimétrica; posição do cinetoplasto do ativo requer revisão |
| *Trichuris* — ovo | [CDC DPDx — Trichuriasis](https://www.cdc.gov/dpdx/trichuriasis/index.html): ovos em fezes, formato barril e plugs polares | Campo fecal âmbar/oliva, detritos densos, fragmentos vegetais suaves, bolhas raras e foco estratificado | Detritos são ilustrativos; nenhuma outra espécie parasitária é sugerida ou nomeada |

[Certeza] Nenhuma imagem externa foi copiada. Os fundos são geometria, shaders e instâncias determinísticas produzidos no projeto; as fontes orientaram contexto, densidade, cor e composição.

## 3. Sistema implementado

[Certeza] A timeline passou a ter sete capítulos e `1100vh`: aproximação, travessia óptica, formação do campo, Giardia, *T. cruzi*, *Trichuris* e descoberta. A coreografia óptica congelada foi preservada por remapeamento matemático da nova progressão narrativa para a progressão visual legada.

[Certeza] Cada mundo é um grupo estrutural independente. Durante uma transição, no máximo dois mundos coexistem e os pesos somam 1; fora dela, somente o mundo dominante permanece visível.

[Certeza] O modo de desenvolvimento `?debug=specimen` oculta organismo e hotspot, mantendo somente o ambiente para revisão de composição.

### Distâncias físicas de scroll

A trilha de `1100vh` produz percurso útil de `1000vh`. Valores abaixo são pixels calculados a partir da altura de cada viewport.

| Viewport | Revelação (3%) | Contemplação Giardia (8%) | Contemplação T. cruzi / Trichuris (9%) | Saída (3%) | Buffer mínimo (2%) |
|---|---:|---:|---:|---:|---:|
| 1440×900 | 270 | 720 | 810 | 270 | 180 |
| 1280×800 | 240 | 640 | 720 | 240 | 160 |
| 768×1024 | 307 | 819 | 922 | 307 | 205 |
| 390×844 | 253 | 675 | 760 | 253 | 169 |
| 320×700 | 210 | 560 | 630 | 210 | 140 |

[Certeza] Esses valores atendem aos pisos definidos: 210 px para revelação/saída, 560 px de contemplação e 140 px de buffer no menor viewport.

## 4. Revisão visual em duas passagens

### Passagem A — composição isolada

[Certeza] O modo sem espécimes confirmou três campos reconhecíveis, mas revelou três problemas: Giardia excessivamente lavada, detritos facetados e hemácias grandes com leitura de anéis decorativos.

[Certeza] A correção escureceu os campos de Giardia e sangue, substituiu fragmentos poligonais por formas orgânicas curvas, reduziu hemácias e reforçou a palidez central. Evidência: [`composition-pass-a/`](./evidence/phase23/round-10-living-slide/composition-pass-a/).

### Passagem B — organismos integrados

[Certeza] O passe final cobriu 19 estados narrativos em 1440×900, 1280×800, 768×1024, 390×844 e 320×700. Não houve erro de página nem overflow horizontal. Evidência completa: [`final-pass-b/`](./evidence/phase23/round-10-living-slide/final-pass-b/) e [`final.json`](./evidence/phase23/round-10-living-slide/final-pass-b/final.json).

[Certeza] Em mobile, títulos, organismo, hotspot, controles e barra de progresso permanecem dentro do quadro. O texto descritivo secundário é ocultado nas telas estreitas para preservar o plano focal, sem remover o contexto de preparação.

| Critério | Peso | Nota | Evidência resumida |
|---|---:|---:|---|
| Diferenciação dos três mundos | 30% | 9,2 | paletas, estruturas e densidades próprias; revisão sem espécime |
| Composição e hierarquia | 25% | 8,8 | organismo dominante sem perder contexto; desktop e mobile |
| Ritmo e clareza narrativa | 20% | 9,1 | dwell e buffers medidos em pixels |
| Integração com óptica/movimento | 15% | 8,7 | coreografia remapeada, pausa e reversibilidade preservadas |
| Resiliência e acessibilidade | 10% | 9,0 | reduced motion, fallback sem WebGL, foco devolvido |
| **Total ponderado** | **100%** | **8,9** | **PASS visual** |

## 5. Movimento, reversibilidade e desempenho

[Certeza] A gravação contínua está em [`video/`](./evidence/phase23/round-10-living-slide/video/). A reversão para o mesmo progresso, com o relógio local congelado, resultou em pixels idênticos.

[Certeza] Nos buffers sem organismo observável, a contagem de renders ficou inalterada durante 1,2 s. Pausa e retomada preservaram o relógio local; reduced motion e falha de WebGL exibiram a versão estática com os três contextos.

[Certeza] As métricas de CPU WebGL do passe automatizado foram obtidas em Chromium/SwiftShader e são inadequadas como orçamento de GPU de produção. Elas servem apenas para regressão relativa. O dado confiável desta rodada é estrutural: zero render contínuo quando nada está observável.

## 6. Verificações

| Verificação | Resultado |
|---|---|
| `npm test` | PASS — 221/221 |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS — build de produção em cópia isolada; `.next/dev` preservado |
| QA de navegador | PASS — 5 viewports, 19 estados, zero erro de página, zero overflow |
| Hotspots | PASS — abrem/fecham, devolvem foco e restauram a posição após o frame de fechamento |
| Reversibilidade | PASS — comparação de pixels idêntica com movimento congelado |
| Fallbacks | PASS — reduced motion e WebGL indisponível |

## 7. Pendência obrigatória

[Certeza] A única pendência que bloqueia liberação científica é a revisão de Ynara sobre o cinetoplasto do *T. cruzi*. Não foi feita uma “correção” especulativa porque isso alteraria um ativo congelado sem base suficiente. Até essa revisão, o resultado pode ser aceito como implementação visual e técnica, mas não como representação científica final aprovada.

