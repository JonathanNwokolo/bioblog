# Microcosmos — Fase 2.3.10 — The Living Slide

Data da revisão: 13 de outubro de 2026  
Escopo: `/explorar`, somente ambiente local, sem commit, push, deploy ou alteração de dados externos.

## Veredito

[Certeza] **Aceitação técnica local: PASS.** A implementação atual separa os três preparos, mantém capítulos físicos mensuráveis, preserva a entrada óptica aprovada, passa a matriz automatizada e mantém a posição ao abrir e fechar os três painéis.

[Provável] **Autoavaliação visual: PASS — 8,7/10.** A nota só foi mantida depois de três iterações adicionais sobre a densidade e a distribuição do material biológico. É crítica do próprio executor, sustentada pelas capturas abaixo; não é revisão independente nem aceitação estética do proprietário.

[Certeza] **Aceitação científica para publicação: HOLD.** O ativo de *Trypanosoma cruzi* não demonstra com segurança um cinetoplasto grande e terminal/subterminal, característica descrita pelo CDC para o tripomastigota sanguíneo. A interface não nomeia essa estrutura e qualifica a reconstrução como artística e não diagnóstica, mas a publicação permanece bloqueada até revisão de Ynara.

## 1. Auditoria e linha de base

[Certeza] A linha de base usava um único campo verde para os três organismos, com fibras, anéis e partículas reaproveitados. A sequência biológica estava comprimida no trecho final de uma trilha de `600vh`.

[Certeza] As capturas comparáveis estão em [`before/`](./evidence/phase23/round-10-living-slide/before/) e as medidas em [`baseline.json`](./evidence/phase23/round-10-living-slide/before/baseline.json).

## 2. Matriz fonte → decisão visual

| Preparação | Fonte primária | Evidência que orientou o desenho | Tradução e limite |
|---|---|---|---|
| *Giardia duodenalis* — trofozoíto | [CDC DPDx — Giardiasis](https://www.cdc.gov/dpdx/giardiasis/) e [CDC DPDx — exame microscópico de fezes](https://www.cdc.gov/dpdx/diagnosticprocedures/stool/microexam.html) | Trofozoítos podem estar em fezes; montagem úmida pode usar solução salina e preservar motilidade observável | Campo salino fecal verde-oliva, matéria orgânica irregular, granulação e foco estratificado; ilustração educacional, não lâmina diagnóstica |
| *Trypanosoma cruzi* — tripomastigota sanguíneo | [CDC DPDx — American Trypanosomiasis](https://www.cdc.gov/dpdx/trypanosomiasisAmerican/) | Tripomastigotas circulantes em esfregaço fino corado por Giemsa; núcleo central, membrana ondulante, flagelo e cinetoplasto terminal/subterminal | Campo lilás/rosa, hemácias achatadas com palidez central e distribuição irregular; resposta cromática inspirada, não simulação colorimétrica |
| *Trichuris trichiura* — ovo | [CDC DPDx — Trichuriasis](https://www.cdc.gov/dpdx/trichuriasis/) | Ovos em fezes; montagem úmida com ou sem iodo; casca espessa, formato de barril e plugs polares | Campo fecal âmbar/oliva, detritos, grânulos, fragmentos vegetais e bolhas raras; nenhuma outra espécie foi criada |

[Certeza] Nenhuma fotografia de referência foi importada. Os campos são produzidos com geometrias, texturas procedurais e instâncias determinísticas do projeto. As fontes orientaram contexto, estrutura, densidade e cor.

## 3. Arquitetura entregue

[Certeza] A trilha agora tem `1100vh`, ou `1000vh` de percurso útil. A timeline central possui capítulos de aproximação, travessia óptica, formação do campo, Giardia, *T. cruzi*, *Trichuris* e descoberta.

[Certeza] A entrada óptica congelada foi preservada por remapeamento matemático da progressão narrativa para a progressão visual legada; câmera, FOV e corte não foram reautorados.

[Certeza] Cada preparo é um grupo estrutural independente. Em transições editoriais, no máximo dois mundos coexistem e seus pesos somam 1. Fora delas, somente o mundo dominante permanece visível.

[Certeza] O modo de desenvolvimento `?debug=specimen` oculta os protagonistas e hotspots, mantendo o ambiente. O modo é ignorado em produção.

### Distâncias físicas de scroll

| Viewport | Percurso útil | Revelação | Contemplação Giardia | Contemplação *T. cruzi* / *Trichuris* | Buffer mínimo |
|---|---:|---:|---:|---:|---:|
| 1440×900 | 9.000 px | 270 px | 720 px | 810 px | 180 px |
| 1280×800 | 8.000 px | 240 px | 640 px | 720 px | 160 px |
| 768×1024 | 10.240 px | 307 px | 819 px | 922 px | 205 px |
| 390×844 | 8.440 px | 253 px | 675 px | 760 px | 169 px |
| 320×700 | 7.000 px | 210 px | 560 px | 630 px | 140 px |

[Certeza] As janelas dos três protagonistas não se sobrepõem. O próximo organismo só começa depois da saída e do buffer editorial do anterior.

## 4. Revisões visuais executadas

### Passagem A — composição sem protagonistas

[Certeza] O modo diagnóstico foi capturado nos cinco viewports. A primeira leitura revelou Giardia lavada, detritos facetados e hemácias grandes com aparência de anéis decorativos.

[Certeza] As correções escureceram Giardia e sangue, trocaram fragmentos facetados por contornos orgânicos, reduziram hemácias e reforçaram sua palidez central. Evidência: [`composition-pass-a/`](./evidence/phase23/round-10-living-slide/composition-pass-a/).

### Passagem B — organismos integrados

[Certeza] O passe final cobriu 19 estados narrativos em 1440×900, 1280×800, 768×1024, 390×844 e 320×700, sem erro de página ou overflow horizontal. Evidência: [`final-pass-b/`](./evidence/phase23/round-10-living-slide/final-pass-b/) e [`final.json`](./evidence/phase23/round-10-living-slide/final-pass-b/final.json).

[Certeza] Em mobile, título do preparo, organismo, hotspot, controles e progresso permanecem dentro do quadro. A descrição secundária é omitida em telas estreitas para preservar o plano focal; o contexto continua disponível na versão estática acessível.

[Certeza] Esta rodada foi **auto-revisão**. Nenhuma revisão independente foi fabricada ou reivindicada.

### Passagens C e D — crítica dura e correção de densidade

[Certeza] A primeira integração ainda falhava no critério central: *Trichuris* permanecia recortado sobre um fundo limpo, e os fragmentos formavam um bolsão decorativo sob o ovo. O resultado não foi aceito nesse ponto.

[Certeza] A correção final distribuiu massas amorfas pelo substrato inteiro, separou fragmentos em fundo, plano focal e primeiro plano, acrescentou microfragmentos, grânulos escuros, fibras curtas, bolhas e artefatos cristalinos discretos. Giardia recebeu vesículas, partículas finas, matéria translúcida e filamentos em profundidades diferentes. O sangue passou a ter três planos de hemácias com nitidez, escala e opacidade próprias, além de ruído plasmático fino.

[Certeza] As capturas diagnósticas intermediárias estão em [`final-pass-c/`](./evidence/phase23/round-10-living-slide/final-pass-c/) e [`final-pass-d/`](./evidence/phase23/round-10-living-slide/final-pass-d/). A matriz canônica pós-correção foi recapturada em [`final-pass-b/`](./evidence/phase23/round-10-living-slide/final-pass-b/).

## 5. Rubrica visual solicitada

| Critério | Peso | Nota | Evidência e defeito remanescente |
|---|---:|---:|---|
| Plausibilidade biológica específica do preparo | 25% | 8,4 | três preparos estruturalmente distintos; morfologia do cinetoplasto de *T. cruzi* ainda bloqueia aprovação científica |
| Composição, densidade e riqueza ambiental | 20% | 8,8 | campos permanecem compostos sem o protagonista; Giardia é deliberadamente menos densa que o campo fecal de *Trichuris* |
| Ritmo cinematográfico e separação dos capítulos | 20% | 9,1 | dwell de 560–922 px, buffers de 140–410 px e ausência de sobreposição entre protagonistas |
| Integração organismo/ambiente | 15% | 8,7 | hierarquia e hotspots legíveis em desktop/mobile; escala é editorial, não metrológica |
| Luz, foco e materiais | 10% | 8,6 | resposta óptica e planos focais distintos; não simula colorimetria diagnóstica |
| Qualidade visual mobile | 10% | 8,9 | 390×844 e 320×700 sem cortes, overflow ou perda de controle |
| **Total ponderado** | **100%** | **8,7** | **PASS visual em auto-revisão; HOLD científico permanece** |

[Provável] A composição supera o mínimo visual de 8,5 no navegador testado. [Certeza] A nota não substitui aprovação estética do proprietário, revisão científica nem teste em hardware físico.

### Crítica dura final

- [Provável] **Ainda parece palco?** Não nos três quadros de contemplação finais: todos permanecem visualmente ocupados mesmo com o protagonista oculto. A Giardia ainda contém algumas vesículas circulares com leitura ligeiramente gráfica; esse é o defeito visual remanescente mais claro.
- [Provável] **Ainda está limpo demais?** Não como conjunto. Giardia é propositalmente mais rarefeita; o esfregaço tem densidade hematológica controlada; o campo fecal é o mais denso e irregular.
- [Provável] **Os parasitas continuam solitários?** Não. Cada protagonista cruza ou é circundado por matéria em planos diferentes, sem perder silhueta e hotspot.
- [Certeza] **Cada lâmina tem identidade própria?** Sim: verde-oliva úmido e filamentoso; lilás/rosa com hemácias; âmbar/oliva com sedimento fecal heterogêneo.
- [Provável] **O ovo parece encontrado numa preparação fecal rica?** Sim na leitura bioeditorial final: há massas, partículas, fibras, impurezas, bolhas e artefatos distribuídos. Não é nem pretende ser uma micrografia diagnóstica.
- [Provável] **O campo de *T. cruzi* parece sangue?** Sim pela predominância de hemácias em múltiplos planos e pelo ruído plasmático. A cor é inspirada em Giemsa, não simulação colorimétrica.
- [Provável] **A Giardia está em ambiente luminal vivo?** Sim pela matéria amorfa translúcida, granulação fina, filamentos e estratificação; as vesículas mais regulares continuam sendo o ponto menos naturalista.

## 6. Interação, reversibilidade e correção confirmada

[Certeza] A gravação contínua está em [`video/`](./evidence/phase23/round-10-living-slide/video/). Com o relógio local congelado, ida e volta ao mesmo progresso produziram pixels idênticos.

[Certeza] Uma regressão foi encontrada durante a repetição do QA: o navegador podia deslocar o capítulo entre o foco e o click de um hotspot dentro do ancestral `sticky`. O painel agora ancora o progresso no foco, restaura-o antes do paint ao abrir e usa o mesmo valor ao fechar.

[Certeza] O harness passou a conter asserts. Resultado atual para Giardia, *T. cruzi* e *Trichuris*: delta de progresso `0`, delta de `scrollY` `0` e foco devolvido ao hotspot correto.

## 7. Desempenho e limites da medição

| Mundo, tier alto | Draw calls | Triângulos | Geometrias | Texturas |
|---|---:|---:|---:|---:|
| Giardia | 27 | 35.240 | 138 | 17 |
| Sangue | 8 | 9.864 | 139 | 20 |
| Fezes / *Trichuris* | 40 | 46.410 | 165 | 25 |

[Certeza] No buffer sem organismo observável, o contador permaneceu em 6 renders durante 1,2 s: não há render contínuo ocioso nesse estado.

[Certeza] Após aquecimento, o amostrador de movimento do Chromium registrou CPU média de 1,6 ms e P95 de 3,9 ms, com intervalo aproximado de 33,3 ms configurado pelo harness.

[Certeza] As métricas acumuladas do renderer incluem compilação/aquecimento em Chromium com SwiftShader e chegaram a P95 de 1,4–1,7 s. Elas não representam FPS de GPU física e não autorizam alegação de desempenho de produção.

[Certeza] A estimativa consolidada de memória de textura não está instrumentada. As texturas procedurais principais usam 1024×640 no tier alto e 640×400 no tier baixo; a contagem acima é evidência estrutural, não medição de VRAM.

## 8. Verificações atuais

| Verificação | Resultado |
|---|---|
| `npm test` | PASS — 221/221 |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS — Next.js 16.4.0 no checkout; servidor local reiniciado em `http://localhost:3000` depois do build |
| Smoke de rotas | PASS — `/`, `/explorar`, `/atlas`, `/laboratorio` e `/onde-vivem` responderam HTTP 200 após o restart |
| Composição sem protagonistas | PASS — 15 quadros medidos, 3 mundos distinguíveis |
| QA final de navegador | PASS — 5 viewports, 19 estados, zero erro de página, zero overflow |
| Hotspots | PASS — posição preservada e foco devolvido nos 3 organismos |
| Reversibilidade | PASS — pixels idênticos com movimento congelado |
| Pausa / retomada | PASS — relógio local preservado |
| Reduced motion / sem WebGL | PASS — versão estática com os 3 contextos e 6 itens educacionais |
| Descarte / remontagem | PASS no harness local anterior; não é prova de memória de GPU física |

## 9. Pendências obrigatórias

- [Certeza] Revisão de Ynara sobre o cinetoplasto e a leitura morfológica geral do *T. cruzi* antes da publicação.
- [Certeza] Aprovação estética final do proprietário; a nota 8,7 é autoavaliação após iteração, não avaliação independente.
- [Certeza] Teste em aparelho móvel e GPU física representativos antes de alegar desempenho de produção.
- [Provável] Uma revisão científica pode exigir ajustar o ativo de *T. cruzi*; essa alteração não foi especulada nesta rodada porque o organismo e sua motilidade são área congelada sem aprovação especializada.

[Certeza] Não houve commit, push, deploy, alteração de Supabase/CMS, serviço pago ou importação de ativo sem licença.
