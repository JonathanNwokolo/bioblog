# Microcosmos — Fase 2.3.X · rodada óptica e morfológica

## A. Veredito honesto

**PARTIAL** para o alvo premium final.

A experiência atende os contratos técnicos e avançou materialmente em direção visual. O microscópio, a objetiva, o caminho frontal, o ambiente de lâmina, os três organismos, os hotspots, o painel, a reversibilidade e os fallbacks estão implementados e validados. Ainda assim, o microscópio procedural continua abaixo de um asset industrial/fotográfico de primeira linha; por isso esta rodada não recebe `PASS` visual definitivo.

Nenhum commit, push, deploy, mudança de CMS, Supabase, billing ou migração foi realizado.

## B. O que foi corrigido

### Caminho óptico

- A jornada preserva o referencial óptico frontal e a câmera continua derivada exclusivamente do progresso real da página.
- Foram adicionadas capturas separadas da aproximação, macro da objetiva, entrada na lente e chegada ao campo microscópico.
- A camada bioeditorial não usa transição autônoma: após uma falha detectada no QA, a transição CSS temporal foi removida. O frame em 62% voltou a ser bit-a-bit idêntico na ida direta e após retorno de 94%.

### Microscópio e objetiva

- Materiais metálicos migraram para `MeshPhysicalMaterial`, com clearcoat controlado e resposta de ambiente mais coerente.
- A objetiva ganhou frisos usinados, inscrição técnica plausível (`100×`, óleo, NA, `∞ / 0.17`, plan achromat), vidro frontal, anéis de retenção e leitura macro mais clara.
- Os comandos de foco receberam dials serrilhados e a base ganhou uma lâmina metálica secundária para reduzir a leitura de bloco simples.

### Micromundo

- Tetraedros flutuantes foram substituídos por microfragmentos suaves.
- Foi criado um campo focal de preparação com fibras curvas, discos fora de foco, partículas finas e planos de profundidade; o fundo deixou de depender apenas de blobs e esferas.
- O campo e as partículas continuam determinísticos: posição e parallax dependem somente do progresso normalizado.

### Organismos

- Os volumes Three.js foram aprofundados com membranas em camadas, clearcoat controlado, fibrilas, disco ventral com lâmina, corpo afilado de *T. cruzi*, membrana ondulante modulada e casca dupla do ovo.
- Três assets bioeditoriais autorais, gerados para esta experiência com transparência real, substituem visualmente os volumes-base nos close-ups. Os volumes permanecem como proxies espaciais mínimos para hotspot/projeção e retornam no hub final.
- *Giardia duodenalis*: contorno piriforme, simetria bilateral, dois núcleos, disco ventral e flagelos legíveis.
- *Trypanosoma cruzi*: corpo alongado e afilado, curvatura, membrana ondulante, núcleo, cinetoplasto e flagelo livre legíveis.
- Ovo de *Trichuris trichiura*: forma em barril/limão, casca espessa multilaminar, conteúdo granular e plugs polares legíveis.

Assets finais:

- `public/images/explore/organisms/giardia-editorial-v2.png`
- `public/images/explore/organisms/t-cruzi-editorial-v2.png`
- `public/images/explore/organisms/trichuris-editorial-v2.png`

Os prompts finais usaram o modo integrado de geração de imagem, categoria `scientific-educational`, com exigência de reconstrução CGI editorial original, fundo realmente transparente, morfologia explícita por organismo e proibição de texto, micrografia imitada, mascote, toy, blob e neon saturado.

### Hotspots e painéis

- Os três hotspots continuam ancorados à projeção espacial dos organismos.
- O alinhamento móvel foi limitado a uma faixa segura horizontal para evitar corte lateral do organismo e do alvo de toque.
- Abrir o painel congela o progresso, mantém o organismo contextual ao fundo, contém foco, fecha com Escape, devolve o foco ao hotspot e restaura a mesma posição da jornada.

## C. O que ainda não atingiu nível final

1. O microscópio completo ainda denuncia geometria procedural em cabeçote, braço e platina. A objetiva macro melhorou, mas um modelo industrial original de maior fidelidade ou uma etapa dedicada de modelagem seria necessária para um `PASS` visual inequívoco.
2. A entrada óptica continua estilizada e translúcida; ela comunica frontalidade e eixo, mas não simula refração física de lentes.
3. Os assets dos organismos são reconstruções artísticas geradas, não micrografias e não prova diagnóstica. Precisam de revisão de especialista antes de qualquer aprovação científica.
4. Performance em GPU física não foi medida. Os números do harness usam ANGLE/SwiftShader e não devem ser interpretados como FPS de desktop ou telefone real.

## D. Evidências

Pasta: `docs/evidence/phase23/round-6-optical-morphology/`

- Microscópio hero: `desktop-opening.png`
- Torre/objetiva: `desktop-objective.png`
- Macro frontal da objetiva: `desktop-objective-macro.png`
- Entrada pela lente: `desktop-optical-transition.png`
- Transição para o micromundo: `desktop-microworld-entry.png`
- Giardia e hotspot: `desktop-giardia.png`
- Painel da Giardia: `desktop-giardia-panel.png`
- *T. cruzi* e hotspot: `desktop-t-cruzi.png`
- Ovo de *Trichuris* e hotspot: `desktop-trichuris.png`
- Estado final: `desktop-discovery.png`
- 768 px: `tablet-opening.png`, `tablet-giardia.png`, `tablet-discovery.png`
- 390 px: `mobile-opening.png`, `mobile-giardia.png`, `mobile-giardia-panel.png`, `mobile-discovery.png`
- Reduced motion: `fallback-reduced-motion-390.png`
- Falha de WebGL: `fallback-no-webgl-1440.png`
- Métricas e contratos: `qa-metrics.json`

## Validação final

| Verificação | Resultado |
| --- | --- |
| `npm test` | PASS — 188/188 |
| `npm run typecheck` | PASS |
| `npm run lint -- --quiet` | PASS |
| `npm run build` | PASS — Next.js 16.4.0; `/explorar` prerenderizada |
| Reversibilidade em 62% | PASS — hashes idênticos |
| Painel | PASS — progresso preservado, Escape e retorno de foco |
| 1440 / 768 / 390 | PASS — sem overflow horizontal |
| Console/página | PASS — zero erros no harness |
| Reduced motion / sem WebGL | PASS — zero canvas e três destinos HTML |
| Rotas públicas testadas | PASS — `/`, `/atlas`, `/laboratorio`, `/onde-vivem`, `/diario`, `/admin/login` com HTTP 200 |

