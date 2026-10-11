# `src/cinematic/` — fronteira da experiência cinematográfica

**Estado na Fase 1: só o contrato.** Não existe runtime 3D. A homepage não importa
Three.js, React Three Fiber, GSAP nem qualquer asset 3D (verificado no bundle de
produção: nenhuma ocorrência em `.next/static`).

## O que existe

- `contract.ts`: tipos do runtime futuro (`CinematicRuntime`, `CinematicMountOptions`,
  `CinematicStatus`) e as constantes do ponto de montagem.
- Ponto de montagem na homepage: `#cinematic-root`, renderizado por
  `src/components/explore/ExploreMount.tsx`, com `data-cinematic-status="pending"`.
  Ele já contém, renderizado no servidor, o campo de visão estático (anel,
  retículo, partículas) que é o **fallback definitivo** para movimento reduzido,
  falha de WebGL e carregamento.

## Regras

1. A homepage só conhece `contract.ts` e o ponto de montagem. Nada de `import` do
   runtime a partir de `components/`.
2. O runtime vive em `src/cinematic/runtime/` (a criar) e é carregado por
   `import()` dinâmico, somente quando `#cinematic-root` se aproxima da viewport
   e `prefers-reduced-motion` não é `reduce`.
3. Assets pesados (modelos, texturas) são pedidos pelo runtime, nunca pela
   homepage inicial.
4. A cena é **fixa e narrativa**, original, inspirada na investigação técnica.
   Não há editor de cenas 3D nem CMS de cenas.
5. Organismos: ainda **não escolhidos** pela proprietária. Não inventar o elenco.

## Para a fase cinematográfica

- Implementar `CinematicRuntime.mount()` e devolver a função de descarte.
- Atualizar `data-cinematic-status` por `onStatus`.
- Medir antes/depois: o custo de carregamento na homepage deve permanecer nulo
  até a seção se aproximar da viewport.
