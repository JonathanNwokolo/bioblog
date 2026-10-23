# Microcosmos — Fase 2.3.11

## Specimen Ecology Rebuild

Data da execução: 2026-10-13  
Rota: `/explorar`  
Estado: implementação e regressão aprovadas; aceitação visual da proprietária pendente; liberação científica bloqueada.

## Resposta desconfortável

A Fase 2.3.10 não falhou por falta de partículas. Ela falhou porque o organismo era a composição e o restante funcionava como preenchimento. O código repetia círculos, elipses e blobs em distribuições reconhecíveis, mantinha quase tudo igualmente “presente” no plano e apresentava o alvo grande e cedo demais. A paleta mudava, mas o modelo visual continuava sendo “herói + fundo”.

## Diagnóstico do estado rejeitado

- **Escala:** o alvo dominava o campo desde a entrada do capítulo; elementos secundários não estabeleciam uma escala ambiental confiável.
- **Repetição:** anéis, discos e partículas revelavam famílias primitivas e intervalos de opacidade semelhantes.
- **Foco:** o blur era principalmente uma propriedade global; faltavam planos óticos locais.
- **Distribuição:** apesar de aleatória, a composição parecia uniforme, sem clusters, bolsões vazios e continuidade forte nas bordas.
- **Continuidade:** o mundo terminava visualmente no viewport; havia poucos elementos convincentes cruzando o primeiro plano.
- **Câmera e ritmo:** a revelação ocorria perto demais da entrada; os capítulos não reservavam distância suficiente para campo, busca, pista, inspeção, saída e buffer.

## Pesquisa e limites científicos

A classificação completa está em [reference-matrix.md](evidence/phase23/round-11-specimen-ecology/references/reference-matrix.md). Foram usados CDC DPDx para observar preparação e morfologia; nenhuma micrografia externa foi incorporada aos ativos. Os dois atlas transparentes são reconstruções originais, não cópias de referência.

- Giardia: montagem salina fecal com matéria orgânica, grânulos, sedimento e poucos fragmentos/fibras plausíveis.
- T. cruzi: esfregaço fino com hemácias em agrupamentos irregulares, variação de forma/foco e células cortadas pelas bordas.
- Trichuris: montagem fecal com matéria amorfa, fragmentos vegetais, fibras, sedimento e artefatos refrativos contidos.
- Espécies adicionais, partículas “vivas” e estruturas escolhidas apenas por apelo visual foram rejeitadas.

**SCIENTIFIC HOLD — YNARA REVIEW REQUIRED:** a questão do cinetoplasto de *T. cruzi* continua aberta. Esta fase não constitui aprovação nem liberação científica.

## Reconstrução

Foi criado `src/cinematic/specimenFieldSystem.ts`, com cinco zonas explícitas: deep field, background specimen, active field, subject plane e near field. Os campos de Giardia e Trichuris usam atlas 4×3 transparentes, instanciamento, clustering determinístico, distribuição de escala irregular, blur dependente de profundidade e corte natural nas bordas. O sangue usa três planos instanciados de hemácias com silhueta e resposta cromática variadas.

O carregamento de atlas agora participa do `warmUp()` do motor. Isso elimina a condição em que o link de validação podia pintar um campo liso antes da textura. A variação de foco é reversível: cada quadro volta ao blur-base e calcula o estado apenas pelo progresso.

O modo exigido está operacional:

`/explorar?debug=specimen&chapter=trichuris&subject=off`

Ele esconde o ovo e preserva a preparação completa. O piloto foi aceito como base metodológica antes de aplicar o sistema à Giardia. O sangue manteve uma implementação específica de esfregaço, não uma recoloração do campo fecal.

## Narrativa e ritmo

A trilha passou de `1100vh` para `1500vh`. Em 1440×900, a distância rolável é aproximadamente 12.600 px; em 320×700, 9.800 px.

| Capítulo | Campo | Revelação | Contemplação | Saída | Buffer | Distâncias em 900 px |
|---|---:|---:|---:|---:|---:|---:|
| Giardia | 0,052 | 0,035 | 0,080 | 0,030 | 0,166 | 655 / 441 / 1008 / 378 / 2092 px |
| T. cruzi | 0,024 | 0,025 | 0,060 | 0,018 | 0,017 | 302 / 315 / 756 / 227 / 214 px |
| Trichuris | 0,045 | 0,030 | 0,060 | 0,030 | 0,035 | 567 / 378 / 756 / 378 / 441 px |

O esfregaço sanguíneo recebeu uma correção adicional: o início do capítulo foi alinhado ao trecho da câmera em que as hemácias já são legíveis. A primeira tentativa foi reprovada porque produzia um intervalo ciano quase vazio antes do organismo.

## Revisão visual adversarial

- **Campo ainda parece apenas fundo?** Não no piloto de Trichuris; matéria cruza planos e bordas e sustenta a imagem sem o ovo. Giardia agora tem matéria específica de montagem salina. O sangue continua mais abstrato que uma micrografia, mas se lê como esfregaço antes do tripomastigota.
- **Organismo parece colado?** A redução de escala inicial, o scan do campo, a pista parcial e a permanência do contexto reduziram esse efeito. Na inspeção ele ainda recebe prioridade editorial deliberada.
- **Há padrão procedural óbvio?** A repetição caiu substancialmente com atlas, clustering e variação de forma. Hemácias continuam reconhecíveis como uma família repetida — apropriado ao material — sem grade regular.
- **As preparações diferem só por cor?** Não. O comparativo sem organismos distingue material salino irregular, campo celular e detrito fecal fibroso.
- **Existe busca real?** Sim nas três sequências de oito quadros. O alvo não aparece nos dois primeiros estados; pista, descoberta, inspeção, saída e campo posterior são separáveis.
- **Mobile perde o mundo?** Não nos frames de 320 e 390; o contexto permanece, com simplificação por qualidade e sem overflow horizontal.

Comparativo principal: [three-preparations-field-only.webp](evidence/phase23/round-11-specimen-ecology/side-by-side/three-preparations-field-only.webp).

Sequências: [Giardia](evidence/phase23/round-11-specimen-ecology/giardia/discovery-sequence.webp), [T. cruzi](evidence/phase23/round-11-specimen-ecology/tcruzi/discovery-sequence.webp), [Trichuris](evidence/phase23/round-11-specimen-ecology/trichuris-pilot/discovery-sequence.webp).

## QA executado

- `npm test`: 221/221 testes passaram.
- `npm run typecheck`: passou.
- `npm run lint`: passou sem erros nem warnings após incluir a dependência do callback de scroll.
- `npm run build`: build de produção Next.js 16.4 passou, incluindo `/explorar` estática.
- `npm audit --omit=dev`: 0 vulnerabilidades no grafo de produção.
- Regressão óptica: 171 pontos em 1440 e 390, zero violações; sete rotas reversas estrutural e pixel-identicamente iguais em cada viewport.
- Hotspots: Giardia, T. cruzi e Trichuris abriram/fecharam com delta de progresso e scroll igual a zero; foco retornou ao marcador.
- Fallbacks: `prefers-reduced-motion` e WebGL indisponível renderizaram a versão estática sem canvas.
- Responsivo: 1440, 1280, 768, 390 e 320 sem erros de console; overflow medido em 320 e 390 = 0.
- Repouso: zero renders adicionais no intervalo medido.
- Ciclo de vida: quatro alternâncias jornada/estático removeram canvas e engine; `rafStatic = 0`; contagens de listeners retornaram ao baseline a cada desmontagem.
- Cena medida no Chromium/SwiftShader, qualidade alta: 8 chamadas, 9.864 triângulos e 24 texturas. SwiftShader não é evidência de FPS de GPU física.

Dados brutos: [browser-qa.json](evidence/phase23/round-11-specimen-ecology/debug/browser-qa.json) e [regression.json](evidence/phase23/round-11-specimen-ecology/debug/optical-regression/regression.json).

## Vídeo contínuo

[microscopic-journey.webm](evidence/phase23/round-11-specimen-ecology/journey/microscopic-journey.webm) registra 47,88 s em 1280×800, VP8, 25 fps, do campo óptico à composição final. O registro não tem erros de console e cobre progressivamente Giardia, T. cruzi e Trichuris.

**Limitação declarada:** o ambiente de automação bloqueou a abertura de `file://` e o preview do app foi apenas enfileirado; portanto eu não alego ter assistido ao arquivo inteiro em reprodução contínua em tempo real. A revisão visual foi feita no navegador ao vivo durante a implementação e pelos contatos cronológicos de oito frames. O requisito específico de “assistir à gravação completa em tempo real” permanece não verificado.

## Veredito honesto

- **Engenharia e regressão:** PASS.
- **Barra visual interna:** candidato a PASS; a diferença frente ao baseline rejeitado é direta e não depende de legenda.
- **Aceitação da proprietária:** PENDENTE — nenhuma autoavaliação substitui essa decisão.
- **Revisão contínua em tempo real:** NÃO VERIFICADA pela limitação acima.
- **Liberação científica:** HOLD — revisão da Ynara obrigatória para o cinetoplasto.

Consequentemente, a fase não recebe “PASS final” neste relatório. O trabalho está pronto para revisão visual humana, sem commit, push, deploy, alteração de CMS ou Supabase.
