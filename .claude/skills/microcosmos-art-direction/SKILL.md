---
name: microcosmos-art-direction
description: Identidade visual e regras de direção de arte do site Microcosmos — Além das Lentes (Ynara Raíssa Nwokolo). Use em qualquer tarefa de design, implementação de interface, motion, copy de interface ou revisão visual deste projeto, e antes de aprovar qualquer seção.
---

# Microcosmos — Direção de Arte

Esta skill preserva a identidade visual aprovada entre sessões. Ela **complementa** a skill `frontend-design` (plugin oficial da Anthropic): `frontend-design` guia o processo (plano → revisão contra o brief → build → crítica); esta skill fixa o que já foi decidido. Quando houver conflito, vale a decisão registrada aqui.

## Identidade

- **Marca:** Microcosmos
- **Assinatura:** Além das Lentes
- **Autora / protagonista:** a biomédica Ynara Raíssa Nwokolo
- **Linguagem:** editorial premium, moderna, científica e humana
- **Fundo:** claro
- **Tipografia:** preta, expressiva, com personalidade (a família exata ainda NÃO foi escolhida — registrar em `docs/art-direction-decisions.md` quando for)
- **Verde-menta:** `#80F9C7`
- **Lilás:** `#E5CBFF`
- **Composição:** assimétrica
- **Imagem:** fotografias microscópicas
- **Motion:** intencional (ver abaixo)

Cores além das duas acima, neutros, escala tipográfica e grid são decisões em aberto. Não as invente em silêncio: proponha, registre em `docs/art-direction-decisions.md` e peça aprovação.

## Referência principal — PENDENTE

Caminho esperado: `docs/reference/homepage-reference.png`. Verificado em 2026-10-10: o arquivo **não existe** no repositório.

Enquanto não existir:

1. Não invente nem descreva a aparência da referência.
2. Solicite o arquivo antes de implementar ou aprovar qualquer seção.
3. Quando chegar, registre as características observáveis em `docs/approved-homepage-composition.md`, separando o aprovado do apenas ilustrativo.

**Status:** pendente.

## Hierarquia da homepage (ordem obrigatória)

1. Hero sobre Ynara.
2. Minha Trajetória (timeline profissional).
3. Diário de Bancada (posts e interações: curtidas, comentários).
4. Parasita em Destaque.
5. Explore o Invisível (encerramento cinematográfico).
6. Footer.

A experiência cinematográfica fica **exclusivamente** em "Explore o Invisível"; as demais seções são editoriais e quietas. Numeração só na timeline, onde há sequência real; fora dela, estruturas numeradas ou eyebrows só entram se codificarem informação. Detalhes em `docs/approved-homepage-composition.md`.

## Precedência sobre outras skills e regras

Esta skill decide a identidade visual. Em conflito com `frontend-design` ou com as skills taste-skill de `.agents/skills`, vale esta. Conflitos identificados (ver `docs/skills-audit.md`):

- `design-taste-frontend` proíbe o traço longo (—) em qualquer texto. Não "corrigir" textos da marca por regra genérica; decidir caso a caso com a proprietária.
- `design-taste-frontend` e `minimalist-ui` proíbem preto puro `#000000`; a marca pede tipografia preta expressiva. Usar o preto fixado na referência ou em `docs/art-direction-decisions.md`, não um default.
- Layout sorteado e estrutura AIDA (`gpt-taste`) e geração obrigatória de imagem de design (`image-to-code`) não se aplicam: a composição é fixa.

## Regras anti-AI-slop

Rejeitar:

- Hero genérico centralizado.
- Cards idênticos repetidos em todas as seções.
- Gradientes sem função.
- Imagens stock desconectadas da narrativa.
- Uso exagerado de ícones.
- Tipografia sem personalidade.
- Animações repetitivas e decorativas.
- Composição sem hierarquia clara.
- Experiência mobile improvisada.
- Interfaces bonitas sem funcionalidade real.

Armadilhas adicionais apontadas pela skill `frontend-design`: um único termo destacado em itálico/cor no título, rótulos em caixa-alta em tudo, eyebrow acima de todo título, `→` em todo link, mono para qualquer rótulo pequeno, near-black "tingido" no lugar de preto. Verde-menta e lilás são decisões da marca: usar com papel definido (destaque funcional, estado, marca de dado), não como lavagem decorativa.

## Qualidade de motion

Todo efeito deve cumprir uma intenção:

- orientar a atenção;
- explicar uma descoberta;
- revelar conteúdo;
- comunicar profundidade;
- reforçar a identidade microscópica.

Se não der para nomear a intenção, o efeito não entra. Preferir um momento orquestrado a efeitos espalhados. Fora de "Explore o Invisível", motion se limita a resposta a ação do usuário (abrir, curtir, comentar, expandir) e ao momento de carregamento do hero; nada de animação ambiente ou por scroll nessas seções. `prefers-reduced-motion` deve ter um caminho equivalente sem movimento.

## Honestidade de conteúdo

- Não fabricar dados profissionais da autora (cargos, instituições, datas, publicações, títulos). Usar apenas o que a proprietária fornecer; o resto fica marcado como pendente.
- Imagens científicas ilustrativas, geradas ou de acervo não podem ser apresentadas como registros reais da autora ou do laboratório. Legenda deve dizer a origem.
- Curtidas, comentários e publicações devem funcionar de verdade, não ser mock.

## Validação visual — obrigatória antes de aprovar cada seção

1. Capturar screenshot real (Playwright MCP).
2. Comparar com a referência e com esta direção.
3. Listar diferenças de composição.
4. Corrigir o que for relevante.
5. Testar em desktop e mobile (ex.: 1440×900 e 390×844).
6. Confirmar acessibilidade (contraste, foco visível, teclado, leitor de tela básico) e movimento reduzido.
7. Usar Chrome DevTools MCP para console, rede, estilos computados e desempenho quando houver dúvida.

Sem a referência visual no repositório, o passo 2 não pode ser concluído: a seção fica **não aprovada**, não "aprovada com ressalvas".

## Quando acionar

Ao criar ou reformular interface, implementar componentes visuais, ajustar motion, escrever copy de interface ou revisar visualmente. Acione em conjunto com `frontend-design`.
