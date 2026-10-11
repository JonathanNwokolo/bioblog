/**
 * Fronteira entre a homepage e a futura experiência cinematográfica.
 *
 * ESTADO (Fase 1): somente o contrato. Nenhum runtime 3D existe, e a homepage
 * NÃO importa Three.js, React Three Fiber, GSAP nem qualquer asset 3D.
 *
 * Regras da fronteira:
 * 1. O código da homepage conhece só este arquivo e o ponto de montagem
 *    `#cinematic-root` (ver `components/explore/ExploreMount.tsx`).
 * 2. O runtime futuro vive em `src/cinematic/runtime/*` e é carregado por
 *    `import()` dinâmico, somente quando o ponto de montagem se aproxima da
 *    viewport (IntersectionObserver) e o visitante não pediu dados reduzidos.
 * 3. Sem runtime (falha, movimento reduzido, sem WebGL), o ponto de montagem
 *    mantém o campo de visão estático já renderizado no servidor.
 * 4. A cena é fixa e narrativa. Não há editor nem CMS de cenas 3D.
 */

export type CinematicStatus = "pending" | "loading" | "ready" | "unsupported";

export interface CinematicMountOptions {
  /** Elemento `#cinematic-root`. */
  element: HTMLElement;
  /** `true` quando o visitante pediu `prefers-reduced-motion: reduce`. */
  reducedMotion: boolean;
  /** Chamado a cada mudança de estado, para refletir em `data-cinematic-status`. */
  onStatus?: (status: CinematicStatus) => void;
}

/** Retorna a função que desmonta a cena e libera GPU/listeners. */
export type CinematicDispose = () => void;

export interface CinematicRuntime {
  mount(options: CinematicMountOptions): Promise<CinematicDispose>;
}

/** Atributo no ponto de montagem que reflete o estado atual. */
export const CINEMATIC_STATUS_ATTRIBUTE = "data-cinematic-status";
export const CINEMATIC_ROOT_ID = "cinematic-root";
