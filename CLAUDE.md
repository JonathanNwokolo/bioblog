# Microcosmos — Além das Lentes

Site autoral premium da biomédica Ynara Raíssa Nwokolo. Marca: Microcosmos. Assinatura: Além das Lentes.

Estado: Fase 1 implementada (veredito PARTIAL, ver `docs/phase1-qa-report.md`). Next.js 16 (App Router) + TypeScript, CSS Modules, sem dependências de UI/animação. A referência visual está em `docs/reference/homepage-reference.png`. Dependências de conteúdo em aberto: retrato real, microscopias reais, dados da trajetória, escolha do parasita, decisão sobre as três tensões da referência. Cinematográfico (WebGL) ainda não iniciado; fronteira em `src/cinematic/README.md`.

Comandos: `npm run dev` · `npm run build` · `npm run typecheck` · `npm test`.

## Regras permanentes

### Direção de arte
- Para trabalho relevante de interface, usar o plugin `frontend-design` (instalado em escopo de projeto) **e** consultar a skill `.claude/skills/microcosmos-art-direction/SKILL.md`.
- Registrar as decisões de direção de arte produzidas (plano de tokens, revisão, mudanças) em `docs/art-direction-decisions.md`. Declarar que a skill foi usada não basta.
- Preservar o design aprovado. Mudanças de identidade exigem aprovação explícita da proprietária.
- Não implementar nem aprovar seções sem a captura de referência da homepage no repositório; se ela não existir, solicitá-la. Não inventar sua aparência.

### Verificação
- Fazer browser QA (Playwright MCP) após alterações visuais significativas: screenshot real, desktop e mobile, interação real.
- Usar Chrome DevTools MCP para console, rede, estilos computados e desempenho. Playwright e DevTools não são redundantes: Playwright para fluxos e capturas, DevTools para diagnóstico.
- Build bem-sucedido não é prova de qualidade visual.
- Não declarar PASS com problemas graves abertos.
- Conferir `prefers-reduced-motion`, foco visível e contraste.

### Documentação de bibliotecas
- Usar Context7 (CLI `npx ctx7@latest library|docs`, skill `find-docs`) quando documentação atualizada de Next.js, React, GSAP, Three.js, React Three Fiber, ORM/banco ou APIs de auth/storage for necessária. Documentação não substitui teste real.

### Conteúdo e honestidade
- Não fabricar dados profissionais da autora (cargos, datas, instituições, publicações, títulos).
- Não apresentar imagens científicas ilustrativas como registros reais.
- Curtidas, comentários e publicações devem ser funcionais, não decorativos.

## Ferramentas do projeto
- `.mcp.json`: `playwright` (`@playwright/mcp`), `chrome-devtools` (`chrome-devtools-mcp`).
- `.claude/settings.json`: plugin `frontend-design@claude-plugins-official`.
- `.claude/skills/find-docs`, `.claude/rules/context7.md`: Context7 (CLI + skill).
- `.claude/skills/microcosmos-art-direction`: identidade visual.
- `.agents/skills/*` e `.aider-desk/skills/*`: pacote de skills de terceiros (taste-skill). Não fazem parte da direção aprovada; se conflitarem com `microcosmos-art-direction`, esta vence.

## Composição e conteúdo
- Ordem fixa da homepage: Hero sobre Ynara, Minha Trajetória, Diário de Bancada, Parasita em Destaque, Explore o Invisível, Footer. Experiência cinematográfica só em Explore o Invisível. Ver `docs/approved-homepage-composition.md`.
- Placeholders e dados demonstrativos seguem `docs/content-placeholders.md`: sempre rotulados, substituíveis, sem informação profissional inventada.
- Conflitos entre skills: `docs/skills-audit.md`.
