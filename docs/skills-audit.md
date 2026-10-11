# Auditoria das taste-skills

Data: 2026-10-10. Nenhum arquivo foi excluído ou alterado.

## Origem e instalação

- Origem: `Leonxlnx/taste-skill` (GitHub), registrado em `skills-lock.json` (13 skills).
- `.agents/skills/<nome>/SKILL.md`: cópias reais.
- `.aider-desk/skills/<nome>`: links simbólicos com caminho absoluto (`/c/Users/Home/Desktop/WORKS/bioblog/.agents/skills/<nome>/`) para as mesmas pastas. Não são duplicatas de conteúdo, só do ponto de descoberta (usado pelo aider-desk). Caminhos absolutos quebram se o projeto for movido.
- Verificação de integridade: o SHA-256 de cada `SKILL.md` **não** bate com `computedHash` do lock. Não dá para concluir adulteração: o hash do lock pode cobrir a pasta inteira ou outro formato, e `.gitattributes` normaliza finais de linha. Origem não verificada criptograficamente.
- Carregamento: em sessão nova (`claude -p`, 2026-10-10), as 13 aparecem na lista de skills disponíveis ao lado de `frontend-design:frontend-design` e `microcosmos-art-direction`. Ou seja, **estão ativas** e podem ser acionadas pelo modelo.

## Conteúdo

| Skill | Tamanho | Foco | Relação com o Microcosmos |
|---|---|---|---|
| design-taste-frontend | 88 KB, 1206 linhas | Anti-slop geral, tipografia, paleta, motion | **Sobrepõe** frontend-design. Conflitos: proíbe o traço longo (—) em qualquer texto, proíbe `#000000`, proíbe eyebrows numerados, desencoraja serifa |
| design-taste-frontend-v1 | 21 KB | Versão antiga da anterior | Redundante com a v2 |
| gpt-taste | 8 KB | Layout sorteado, AIDA, GSAP | **Conflita**: composição é fixa |
| image-to-code | 38 KB | Gerar imagens de design antes do código (Codex) | **Conflita**: a referência é a imagem da proprietária |
| imagegen-frontend-web | 38 KB | Gerar imagens de seção | Conflita pelo mesmo motivo |
| imagegen-frontend-mobile | 42 KB | Apps mobile | Irrelevante (site) |
| minimalist-ui | 8 KB | Editorial minimalista, off-white/off-black, serifa | Sobrepõe e impõe paleta/tipografia próprias |
| industrial-brutalist-ui | 9 KB | Brutalismo | Estética oposta |
| high-end-visual-design | 11 KB | Estética "agência" | Impõe defaults visuais |
| stitch-design-taste | 12 KB | DESIGN.md para Google Stitch | Irrelevante |
| brandkit | 17 KB | Pranchas de identidade | Irrelevante agora |
| redesign-existing-projects | 15 KB | Auditar/redesenhar sites existentes | Útil só em reformulações futuras |
| full-output-enforcement | 3 KB | Impede truncamento de código | Compatível; útil |

## Sobreposição

- **Com Frontend Design:** `design-taste-frontend` cobre o mesmo terreno (anti-slop, tipografia, motion), com regras mais numerosas e mais rígidas. Duas skills longas dando instruções divergentes sobre as mesmas escolhas aumentam a chance de conflito e de consumo de contexto.
- **Com Microcosmos Art Direction:** as skills de estética (minimalist, brutalist, high-end, gpt-taste) impõem paleta, tipografia e estrutura próprias. A skill do projeto declara precedência (ver SKILL.md), mas precedência escrita não impede que uma skill genérica seja acionada e injete defaults.

## Proposta mínima e não destrutiva (NÃO aplicada)

Manter os arquivos. Bloquear a invocação das que conflitam, em `.claude/settings.json`, de forma reversível:

```json
{
  "permissions": {
    "deny": [
      "Skill(gpt-taste)",
      "Skill(image-to-code)",
      "Skill(imagegen-frontend-web)",
      "Skill(imagegen-frontend-mobile)",
      "Skill(minimalist-ui)",
      "Skill(industrial-brutalist-ui)",
      "Skill(high-end-visual-design)",
      "Skill(stitch-design-taste)",
      "Skill(design-taste-frontend-v1)",
      "Skill(brandkit)"
    ]
  }
}
```

Permaneceriam ativas: `frontend-design` (plugin), `microcosmos-art-direction`, `find-docs`, `full-output-enforcement`, `redesign-existing-projects` e `design-taste-frontend`.

`design-taste-frontend` é a decisão aberta: é útil como checklist, mas contradiz a marca em dois pontos (traço longo, preto puro) e duplica o plugin oficial. Recomendo mantê-la e confiar na precedência da skill do projeto, ou bloqueá-la também se aparecer conflito na prática.

Esta configuração **não foi aplicada** porque altera o comportamento do projeto e a instrução era propor. Aplicar exige sua confirmação.
