# Ferramentas criativas — Fase 0

## Resumo

| Ferramenta | Instalado | Configurado | Testado | Resultado |
|---|---|---|---|---|
| Frontend Design | Sim (plugin, escopo projeto) | Sim (`.claude/settings.json`) | Parcial: skill descoberta em sessão nova; processo aplicado ao planejamento; não invocada pela ferramenta Skill nesta sessão | PARTIAL |
| Playwright MCP | Sim (`.mcp.json`) | Sim, aprovado, "Connected" | Sim: navegar, snapshot, clicar, evaluate, screenshot | PASS |
| Chrome DevTools MCP | Sim (`.mcp.json`) | Sim, telemetria e CrUX desativados | Sim: DOM, CSS computado, console, screenshot, trace (ver atualização Fase 0.1) | PASS |
| Context7 | Sim (CLI + skill) | Sim | Sim: `library` + `docs` reais | PASS |
| Microcosmos Art Direction | Sim (arquivo) | Sim | Descoberta confirmada em sessão nova | PARTIAL: referência visual pendente |

## Frontend Design

- Plugin: `frontend-design@claude-plugins-official`, escopo projeto, "enabled". Autor Anthropic. Versão reportada como `unknown` (cache `claude-plugins-official/frontend-design/b8e53f1c05df`).
- Instalação: `claude plugin install frontend-design@claude-plugins-official --scope project`.
- Acionamento: a skill aparece como `frontend-design:frontend-design` (confirmado com `claude -p` em sessão nova). Invocar pela ferramenta Skill ou citar o nome.
- Teste: ver `docs/art-direction-decisions.md` — plano de tokens, revisão e mudanças registrados.
- Limite honesto: a instalação ocorreu durante esta sessão e a skill não estava na lista de skills dela; o processo foi aplicado lendo o SKILL.md, não chamando a ferramenta Skill. O uso pela ferramenta vale a partir da próxima sessão.
- O SKILL.md diz que o brief do usuário prevalece sobre seus defaults. Fundo claro com verde-menta está dentro do brief.

## Playwright MCP

- Config: `claude mcp add --scope project playwright -- npx @playwright/mcp@latest` → `.mcp.json`.
- Pacote em execução: Playwright MCP 1.64.0-alpha, 25 ferramentas (navigate, snapshot, click, type, fill_form, evaluate, take_screenshot, resize, network_requests, console_messages, tabs, emulate_media…).
- Teste real (stdio, headless): `browser_navigate https://example.com` → título "Example Domain"; `browser_snapshot` → árvore de acessibilidade; `browser_click` no link "Learn more" → URL passou a `https://www.iana.org/help/example-domains`; `browser_evaluate` retornou título e URL; `browser_take_screenshot` gerou `docs/evidence/playwright-probe.png`.
- `browser_emulate_media` permite testar `prefers-reduced-motion`; `browser_resize` testa mobile (listados, não exercitados).
- A primeira chamada de clique falhou por argumento errado (nesta versão o parâmetro é `target`, não `element`/`ref`); corrigida e repetida com sucesso.

## Chrome DevTools MCP

- Config: `claude mcp add --scope project chrome-devtools -- npx chrome-devtools-mcp@latest`.
- Pacote: `chrome-devtools-mcp` 1.10.1, 30 ferramentas (inclui `lighthouse_audit`, `performance_start_trace`, `performance_analyze_insight`, `take_heapsnapshot`, `get_css_styles`, `list_console_messages`, `list_network_requests`, `evaluate_script`, `emulate`).
- Teste real: `new_page` → `take_snapshot` (DOM com uids), `list_console_messages` (nenhuma), `list_network_requests` (2 requisições, ambas 200), `performance_start_trace` com reload → LCP 64 ms, CLS 0.00 (página trivial de exemplo, não é medida do projeto).
- Não confirmado: `get_css_styles`. Minha chamada usou o uid da raiz (`1_0`), que não é elemento, e retornou erro; não foi repetida com elemento válido. `lighthouse_audit` e `take_heapsnapshot` estão listados mas não foram executados.
- Telemetria: por padrão envia estatísticas de uso e pode consultar o CrUX; existem as flags `--no-usage-statistics` e `--no-performance-crux`. O `.mcp.json` não as inclui. A decisão fica com a proprietária.
- Playwright vs. DevTools: Playwright para fluxos (publicar, curtir, comentar), capturas e responsividade; DevTools para diagnóstico (console, rede, estilos computados, performance, WebGL).

## Context7

- Modalidade escolhida: **CLI + Skill** (não MCP): um servidor a menos, consulta direta pela skill `find-docs`.
- Comando: `npx ctx7 setup --claude --cli --project --yes`. Abriu um fluxo de autorização por dispositivo, concluído com "Authenticated with API key". Instalou `.claude/skills/find-docs/SKILL.md` e `.claude/rules/context7.md`.
- Teste real: `ctx7 library next.js …` → `/vercel/next.js` (versões listadas até v16.2.9); `ctx7 docs /vercel/next.js "generateMetadata …"` → trecho de `docs/01-app/01-getting-started/14-metadata-and-og-images.mdx` do repositório `vercel/next.js` (canary).
- A credencial fica na conta do usuário, fora do repositório; nenhuma chave foi escrita em arquivos do projeto (conferir antes de qualquer commit).

## Skill `microcosmos-art-direction`

- Arquivo: `.claude/skills/microcosmos-art-direction/SKILL.md`, com `name` e `description`.
- Disponibilidade: confirmada em sessão nova (`claude -p` listou `microcosmos-art-direction`).
- Registra: identidade, hierarquia, anti-slop, motion, honestidade de conteúdo, validação visual.
- **Pendente:** a captura de referência da homepage não está no repositório. A skill proíbe aprovar seções sem ela.

## Pendências

1. Fornecer a captura da homepage (sugestão: `docs/reference/homepage-reference.png`) e atualizar o caminho na skill.
2. Decidir sobre a telemetria do DevTools MCP.
3. Decidir sobre o pacote taste-skill (versão duplicada, possíveis conflitos).
4. Repetir `get_css_styles` com elemento válido e rodar `lighthouse_audit` na primeira página real.
5. Reiniciar a sessão para que as ferramentas MCP apareçam diretamente (aqui foram exercitadas por stdio e o `claude mcp list` as marca como Connected).

## Atualização Fase 0.1 (2026-10-10)

- **Frontend Design invocado de fato:** sessão nova (`claude -p`, session `42711f59-b5d2-47f6-a2e3-ae29aee66dec`), ferramenta Skill chamada com `frontend-design:frontend-design`; retornou sucesso e as primeiras palavras das instruções ("Approach this as the design lead at a design studio…").
- **Microcosmos Art Direction invocada** em sessão nova (session `21c3ff1b-b837-43a3-a68b-b040edc81ea6`). A releitura apontou duas tensões; uma (motion fora do encerramento) foi corrigida na skill; a outra (preto "fixado na referência") é consequência da referência ausente e permanece aberta.
- **DevTools:** `.mcp.json` agora usa `--no-usage-statistics --no-performance-crux` (flags confirmadas em `--help` da v1.10.1; recursos locais de trace mantidos). Em página local de fixture (fora do repositório): snapshot do DOM (`h1` uid `1_1`), `get_css_styles` do h1 válido (font-size 64px, letter-spacing -.02em, background var(--menta), vars `--menta:#80F9C7`, `--lilas:#E5CBFF`), console com warn e error esperados, `evaluate_script` (h1 = 64px) e screenshot em `docs/evidence/devtools-fixture.png`. Observação: `get_css_styles` exige `take_snapshot` antes na mesma página e não aceita lista de propriedades. Lighthouse não foi executado (sem página real).
- A mudança em `.mcp.json` vale a partir da próxima sessão do Claude Code; os testes usaram os mesmos argumentos por stdio.
