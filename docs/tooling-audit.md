# Auditoria de ferramentas — Fase 0

Data: 2026-10-10

## Estado inicial (antes de qualquer instalação)

| Item | Valor |
|---|---|
| SO | Windows 11 Pro 10.0.26200 |
| Node.js | v24.15.0 |
| npm | 11.12.1 |
| Claude Code | 2.1.214 |
| Chrome | 155.0.8059.39 (`C:\Program Files\Google\Chrome\Application`) |
| Git | repositório com 1 commit (`505e8cc Initial commit`), branch `main` |
| Projeto | sem `package.json`, sem código, sem `CLAUDE.md`, sem `.mcp.json`, sem imagens |

### Plugins
- Nenhum plugin instalado. Marketplace configurado: `claude-plugins-official` (GitHub `anthropics/claude-plugins-official`).

### MCP (escopo usuário/projeto)
- Nenhum MCP de usuário ou de projeto. Conectores claude.ai presentes: Claude Docs, Google Drive, Google Calendar, Gmail (conectados); Canva (precisa de autenticação). Não relacionados a este projeto; preservados.
- Playwright e Chrome DevTools **não** estavam configurados.

### Skills
- Usuário: `find-skills` (link para `~/.agents/skills`).
- Projeto (não versionado, sem commit): `.agents/skills/*` — 13 skills do pacote `Leonxlnx/taste-skill` (brandkit, design-taste-frontend, design-taste-frontend-v1, full-output-enforcement, gpt-taste, high-end-visual-design, image-to-code, imagegen-frontend-mobile, imagegen-frontend-web, industrial-brutalist-ui, minimalist-ui, redesign-existing-projects, stitch-design-taste), com `.aider-desk/skills/*` como links simbólicos para as mesmas pastas e `skills-lock.json`.
- `.claude/skills/` existia vazio.

### Configuração global relevante
- `~/.claude/settings.json` com lista longa de permissões acumuladas de outros projetos (Expo, Vite, Playwright CLI etc.). Não alterado.

## Achados

| # | Achado | Gravidade | Ação |
|---|---|---|---|
| 1 | `design-taste-frontend` e `design-taste-frontend-v1` são duas versões do mesmo pacote; `.aider-desk/skills/*` duplica `.agents/skills/*` | Baixa | Preservado (funcional). Recomenda-se manter só `design-taste-frontend` quando a direção for fixada |
| 2 | Várias skills do pacote taste impõem estéticas próprias (brutalista, minimalista, bento/GSAP) que podem conflitar com a identidade Microcosmos | Média | Preservadas; `CLAUDE.md` define que `microcosmos-art-direction` prevalece |
| 3 | `find-skills` (usuário) não conflita com nada | — | Mantido |
| 4 | Nenhum plugin/MCP duplicado ou desatualizado | — | — |
| 5 | Sem referência visual no repositório | **Alta** | Pendência (ver `creative-tooling.md`) |
| 6 | `.claude/settings.local.json` é ignorado pelo git global do usuário | Info | Usado para aprovar MCPs de projeto localmente |

## Fontes consultadas
- Ajuda dos próprios CLIs (`claude mcp add --help`, `ctx7 --help`, `ctx7 setup --help`) e os pacotes npm em execução (`@playwright/mcp` 1.64.0-alpha, `chrome-devtools-mcp` 1.10.1). As páginas web citadas no briefing não foram abertas; o comando de instalação do Playwright foi adaptado ao escopo de projeto e à sintaxe `--` do CLI instalado.
