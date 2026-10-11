# Fase 1 — Especificação visual da homepage

Fonte: `docs/reference/homepage-reference.png` (941 × 1672 px, inspecionada em 2026-10-10).
Convenção: **[V]** = visível na imagem; **[I]** = inferido, a imagem não mostra; **[D]** = decisão desta fase que se afasta da referência, com motivo.

A referência é um mock de direção. Fixa composição e linguagem visual, não dados, fotos ou textos finais (ver `docs/content-placeholders.md`).

Conversão usada nas medidas: a referência tem 941 px de largura; a 1440 px de viewport o fator é ≈ 1,53.

## 1. Composição global

| Faixa (y na ref.) | Seção | Fundo [V] | Papel compositivo |
|---|---|---|---|
| 0–55 | Cabeçalho | claro | logo à esquerda, menu central, CTA pílula menta à direita |
| 55–440 | Hero | claro com halo suave menta/lilás atrás do retrato | capa editorial assimétrica: texto à esquerda, retrato + campos microscópicos à direita |
| 440–800 | Minha trajetória | branco | timeline horizontal de 4 marcos, linha fina com pontos menta |
| 800–1208 | Diário de Bancada | cinza muito claro | fileira de 3 cards brancos com imagem, tag, data, título, resumo e interação |
| 1208–1395 | Parasita em destaque | branco | texto à esquerda, imagem retrato central, nome + atributos à direita |
| 1395–1632 | Explore o Invisível | escuro (única) | título à esquerda, organismo 3D à direita, 3 itens de apoio na base |
| 1632–1672 | Footer | claro | linha única: logo, menu, ícones sociais, tagline |

Ritmo [V]: claro → branco → cinza → branco → escuro → claro. Margem lateral ≈ 76 px (≈ 8 % → 116 px a 1440), conteúdo ocupa ≈ 84 % da largura.

## 2. Tipografia

- [V] Display preto, peso alto, entrelinha ≈ 0,95, tracking apertado; títulos em 3 linhas no hero (cap ≈ 46 px na ref. → ≈ 66–72 px a 1440).
- [V] Títulos de seção em peso semibold/bold, ≈ 36 px na ref. (≈ 55 px a 1440).
- [V] Corpo pequeno (≈ 11 px na ref.), cinza escuro, linhas curtas (≈ 45–60 caracteres).
- [V] Anotação manuscrita (script) em lilás/cinza, inclinada, com seta desenhada: "Pequenos organismos, grandes perguntas." no hero e "O invisível também faz parte de nós." na seção escura.
- [V] Texto circular em volta de um ponto (selo) no canto superior direito do hero.
- [I] A família exata não aparece com nome. A leitura é de grotesco geométrico-humanista (a de dupla camada, g de camada única). Decisão em `docs/art-direction-decisions.md`: Plus Jakarta Sans (todas as camadas de texto) + Caveat só para anotações de bancada.

## 3. Cor

- [V] Fundo `#F2F2F2` / branco; tipografia `#211F20`; menta `#80F9C7` em CTAs primários, pontos da timeline, ícones de atributo; lilás `#E5CBFF` em eyebrows e tags.
- [V] Imagens microscópicas em roxos saturados (coloração tipo Giemsa/H&E), uma em bege/dourado (ovo), uma prateada (larva).
- [V] Seção escura: quase preto azulado com organismo translúcido roxo/azul e partículas.
- [I] Texto secundário e cor de tag (roxo escuro sobre lilás) não têm valor lido; definidos como tokens e verificados quanto a contraste.

## 4. Tratamento de imagem

- [V] Fragmentos microscópicos no hero como retângulos arredondados com borda branca fina e brilho lilás/menta, sobrepostos ao retrato em escalas diferentes.
- [V] Cards do diário: imagem larga com cantos arredondados internos ao card branco.
- [V] Imagem do parasita em formato retrato com selo "Em destaque" no canto.
- [V] Esferas lilás soltas (células) espalhadas ao redor do retrato.
- [D] Nenhuma imagem da referência é reutilizada: a foto da pessoa não pode ser apresentada como Ynara, e as imagens microscópicas da referência têm resolução insuficiente e origem não verificada. Retrato e microscopia são **placeholders marcados** (ilustrações vetoriais geradas em código, com legenda de origem).

## 5. Transições entre seções

- [V] Cortes secos por troca de cor de fundo; sem curvas ou ondas.
- [V] A entrada para a seção escura é um corte reto; o halo luminoso do organismo invade a borda superior.
- [D] A entrada de "Explore o Invisível" ganha um motivo próprio (campo de visão circular de microscópio com graticule) para ancorar o futuro runtime 3D.

## 6. Adaptação mobile [I]

A referência é só desktop. Decisões desta fase:
- Hero: título primeiro, depois palco visual (retrato + fragmentos) em proporção própria, CTAs empilhados, sem faixa de números.
- Timeline: vira trilho vertical à esquerda com pontos menta.
- Diário: post de destaque em largura total; demais posts em lista com miniatura.
- Parasita: imagem acima, nome grande, atributos em lista simples.
- Menu: botão com painel; alvo de toque ≥ 44 px.

## 7. Intenção de interação

| Elemento | Intenção | Fonte |
|---|---|---|
| Lente nos fragmentos do hero | revelar detalhe microscópico (camada extra visível só sob a lente) | [D] pedida no briefing da Fase 1 |
| Carregamento do hero | "focar": os campos saem do desfoque para a nitidez, uma vez | [D] Fase 0 (um momento orquestrado) |
| Curtir / comentar | feedback imediato, estado persistido no navegador | [V] botões presentes; funcionamento definido em `docs/content-placeholders.md` |
| Cards e botões | estado de foco e hover discretos | [I] |

## 8. Divergências conscientes da referência

| # | Referência | Esta fase | Motivo |
|---|---|---|---|
| 1 | Faixa "+100 / +50 / 1" no hero | omitida | números não verificados (regra de honestidade; tensão nº 1) |
| 2 | Diário em 3 cards idênticos | 1 destaque + 2 entradas em escalas diferentes | briefing da Fase 1 proíbe cards idênticos; tensão nº 2 |
| 3 | Eyebrow em quase toda seção | só no hero e nas tags de post (onde codificam informação) | tell de IA; tensão nº 3 |
| 4 | Contagens 142 / 89 / 76 | 0 inicial, soma o que o visitante faz neste navegador | contagens não são reais |
| 5 | Timeline com cargos e datas | quatro marcos pendentes | nenhum dado verificado; LinkedIn respondeu HTTP 999 |
| 6 | Foto da pessoa | silhueta genérica rotulada | não apresentar imagem gerada como Ynara |
| 7 | Organismo 3D renderizado | campo de visão vazio + ponto de montagem | 3D fora do escopo da Fase 1 |
| 8 | "Recursos" no menu | removido | não há conteúdo; evitaria beco sem saída |
