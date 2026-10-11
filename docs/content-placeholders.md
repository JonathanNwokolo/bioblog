# Conteúdo demonstrativo e placeholders

Regra: nenhuma informação profissional, afiliação, data, publicação ou imagem é atribuída à Ynara sem origem verificada. Tudo que não for fornecido por ela é placeholder, **visível como tal** na interface e **substituível por dado real** sem mexer em código de layout.

## Convenção de dados

Todo item de conteúdo carrega um estado de verificação:

```json
{
  "id": "trajetoria-001",
  "status": "placeholder",
  "title": "Experiência a ser informada",
  "source": null
}
```

- `status`: `"placeholder"` ou `"verified"`.
- `source`: obrigatório quando `verified` (quem forneceu, quando).
- Itens `placeholder` renderizam um selo visível ("Conteúdo de exemplo") e nunca texto que pareça real.

## Categorias

| Categoria | Placeholder aceito | Proibido |
|---|---|---|
| Retrato profissional | Bloco neutro de proporção fixa, identificado como "Retrato a ser enviado" | Foto de banco de imagens ou gerada apresentada como Ynara |
| Imagens microscópicas | Imagem rotulada "Ilustrativa" com origem declarada, ou bloco vazio com proporção | Apresentar imagem ilustrativa ou de acervo como registro real do laboratório |
| Trajetória | Entradas "Experiência a ser informada" | Cargos, instituições, datas ou títulos inventados |
| Publicações do Diário | Posts rotulados como demonstrativos, usáveis para testar curtidas e comentários | Posts que simulem autoria ou fatos científicos reais |
| Parasita em Destaque | Estrutura com campos vazios ou texto marcado como exemplo | Afirmações científicas não verificadas apresentadas como definitivas |

## Substituição

1. Trocar o dado por um registro com `status: "verified"` e `source`.
2. O selo some automaticamente; o layout não muda.
3. Antes de publicar, nenhum item `placeholder` deve permanecer visível.

## Estado atual (Fase 1)

Implementado em `src/content/` com os tipos de `src/content/types.ts`:

| Arquivo | Conteúdo | Estado |
|---|---|---|
| `trajectory.ts` | 4 marcos | **todos `placeholder`**: nenhum dado verificado (LinkedIn respondeu HTTP 999 em 2026-10-10) |
| `posts.ts` | 3 posts | `placeholder`, rotulados "Post de exemplo"; textos gerais e cautelosos, sem autoria simulada; `baseLikes: 0` |
| `featured-organism.ts` | *Giardia lamblia* | `placeholder`, rotulado "Provisório"; organismo não aprovado |
| `site.ts` | marca, autora, LinkedIn, navegação | LinkedIn fornecido pela proprietária; e-mail `null` |

O selo some sozinho quando `status` vira `verified` (trajetória e posts). `tests/content.test.ts` garante que `verified` exige `source` e que `placeholder` não carrega dados profissionais.

Imagens: todas as microscopias são ilustrações geradas em código (`src/components/specimens/Specimen.tsx`), legendadas como tal. O retrato é uma silhueta genérica (`PortraitSlot`).
