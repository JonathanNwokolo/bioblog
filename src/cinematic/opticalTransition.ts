import { clamp01, smoothstep, window01 } from "./scrollProgress.ts";
import {
  SPECIMEN_TIMELINE,
  legacyVisualProgress,
  narrativeProgressFromLegacy,
} from "./specimenTimeline.ts";

/**
 * Contrato visual da travessia óptica (Fase 2.3.8) — módulo puro (sem three, sem DOM).
 *
 * O visitante percebe cinco estados, e cada um tem uma regra de visibilidade explícita:
 *
 * | Estado        | Progresso     | Instrumento | Amostra  | Organismo |
 * |---------------|---------------|-------------|----------|-----------|
 * | A aproximação | 0 – 0,40      | sólido      | oculta   | oculto    |
 * | B acoplamento | 0,40 – 0,50   | sólido      | oculta   | oculto    |
 * | C óptico      | 0,50 – 0,60   | sólido até o corte (0,545) | depois do corte | oculto |
 * | D formação    | 0,60 – 0,66   | oculto      | visível  | oculto    |
 * | E revelação   | ≥ 0,66        | oculto      | visível  | por janela |
 *
 * A câmera NÃO atravessa a carcaça de forma visível. Entre B e D a representação do
 * instrumento cede lugar ao campo de observação por trás de uma passagem óptica: o
 * exterior escurece até o limitador de campo (a ocular), o vidro acende, e o corte
 * entre as duas cenas acontece com o campo inteiro luminoso, sem nada do exterior
 * à vista. Tudo é função pura do progresso.
 */

export type OpticalPhase = "approach" | "coupling" | "optical" | "formation" | "observation";

export const OPTICAL_VISUAL_TIMELINE = {
  /** A câmera chega ao eixo da ocular e se acopla. */
  coupling: 0.4,
  /** O exterior do instrumento escurece até o limitador de campo (ocular). */
  eyecup: [0.43, 0.5],
  /** O vidro acende: luz do campo entra pela ocular. */
  glowRise: [0.49, 0.535],
  glowHold: [0.535, 0.58],
  glowFall: [0.58, 0.63],
  /** Troca da representação do instrumento pela cena da amostra (campo totalmente luminoso). */
  cut: 0.555,
  /** O limitador de campo abre até a vinheta final. */
  iris: [0.565, 0.645],
  /** O campo ganha textura, profundidade e partículas. */
  formation: [0.565, 0.65],
  /** A iluminação se acomoda: do campo recém-aceso ao campo escuro de observação. */
  exposure: [0.6, 0.74],
  focus: [0.575, 0.705],
  /** Primeira janela biológica possível. Nada biológico existe antes disso. */
  organismsFrom: 0.665,
} as const;

const mapRange = (range: readonly [number, number]) =>
  [narrativeProgressFromLegacy(range[0]), narrativeProgressFromLegacy(range[1])] as const;

/** Mesma coreografia óptica aprovada, expressa no novo progresso narrativo de 1100vh. */
export const OPTICAL_TIMELINE = {
  coupling: narrativeProgressFromLegacy(OPTICAL_VISUAL_TIMELINE.coupling),
  eyecup: mapRange(OPTICAL_VISUAL_TIMELINE.eyecup),
  glowRise: mapRange(OPTICAL_VISUAL_TIMELINE.glowRise),
  glowHold: mapRange(OPTICAL_VISUAL_TIMELINE.glowHold),
  glowFall: mapRange(OPTICAL_VISUAL_TIMELINE.glowFall),
  cut: narrativeProgressFromLegacy(OPTICAL_VISUAL_TIMELINE.cut),
  iris: mapRange(OPTICAL_VISUAL_TIMELINE.iris),
  formation: mapRange(OPTICAL_VISUAL_TIMELINE.formation),
  exposure: mapRange(OPTICAL_VISUAL_TIMELINE.exposure),
  focus: mapRange(OPTICAL_VISUAL_TIMELINE.focus),
  organismsFrom: narrativeProgressFromLegacy(OPTICAL_VISUAL_TIMELINE.organismsFrom),
} as const;

export const FIELD_STOP_RADIUS = 0.56;

export type OrganismId = "giardia" | "t-cruzi" | "trichuris";

/** Janela de revelação de cada organismo: entra em `in`, sai em `out`. */
export const ORGANISM_TIMELINE: Record<OrganismId, { in: readonly [number, number]; out: readonly [number, number] }> = {
  giardia: {
    in: SPECIMEN_TIMELINE.chapters.giardia.reveal,
    out: SPECIMEN_TIMELINE.chapters.giardia.departure,
  },
  "t-cruzi": {
    in: SPECIMEN_TIMELINE.chapters["t-cruzi"].reveal,
    out: SPECIMEN_TIMELINE.chapters["t-cruzi"].departure,
  },
  trichuris: {
    in: SPECIMEN_TIMELINE.chapters.trichuris.reveal,
    out: SPECIMEN_TIMELINE.chapters.trichuris.departure,
  },
};

/** O marcador só é visível e acionável quando o organismo está suficientemente revelado. */
export const HOTSPOT_MIN_REVEAL = 0.9;

export function organismReveal(id: OrganismId, progress: number): number {
  const { in: enter, out } = ORGANISM_TIMELINE[id];
  return smoothstep(enter[0], enter[1], progress) * (1 - smoothstep(out[0], out[1], progress));
}

export function hotspotActive(id: OrganismId, progress: number): boolean {
  return organismReveal(id, progress) >= HOTSPOT_MIN_REVEAL;
}

export interface OpticalState {
  phase: OpticalPhase;
  /** A malha do microscópio é desenhada. */
  instrumentVisible: boolean;
  /** A cena da amostra (campo, partículas, organismos) é desenhada. */
  sampleVisible: boolean;
  /** 1 = limitador de campo totalmente aberto (sem máscara); 0 = fechado na ocular. */
  fieldStop: number;
  /** 0 → 1 → 0: o campo luminoso da ocular (cobre as duas cenas durante o corte). */
  glow: number;
  /** 0 → 1: o núcleo luminoso cresce dentro da lente (só a subida; não encolhe na saída). */
  glowCore: number;
  /** 0 → 1: textura, partículas e estruturas do campo existem. */
  formation: number;
  /**
   * 0 → 1: contraste das estruturas em suspensão (fibras, detritos, partículas). Cresce com o
   * assentamento da iluminação: sobre o campo recém-aceso elas apareceriam como manchas claras.
   */
  detail: number;
  /** Luminosidade percebida do campo (sRGB; 1 = recém-aceso, depois se acomoda). */
  exposure: number;
  /** 0 → 1: nitidez do plano focal. */
  focus: number;
  /** Desfoque de CSS aplicado à cena (px a 1440 de largura). Zero antes do corte. */
  blurPx: number;
  /** Escurecimento do exterior do instrumento (0 = ambiente claro, 1 = só a ocular). */
  eyecup: number;
}

function opticalPhaseAtVisual(p: number): OpticalPhase {
  if (p < OPTICAL_VISUAL_TIMELINE.coupling) return "approach";
  if (p < OPTICAL_VISUAL_TIMELINE.eyecup[1]) return "coupling";
  if (p < 0.6) return "optical";
  if (p < OPTICAL_VISUAL_TIMELINE.organismsFrom) return "formation";
  return "observation";
}

export function opticalPhaseAt(progress: number): OpticalPhase {
  return opticalPhaseAtVisual(legacyVisualProgress(progress));
}

export function sampleOptics(progressInput: number): OpticalState {
  const p = legacyVisualProgress(progressInput);
  const T = OPTICAL_VISUAL_TIMELINE;
  const eyecup = smoothstep(T.eyecup[0], T.eyecup[1], p);
  const open = smoothstep(T.iris[0], T.iris[1], p);
  const glowCore = smoothstep(T.glowRise[0], T.glowRise[1], p);
  const glow = glowCore * (1 - smoothstep(T.glowFall[0], T.glowFall[1], p));
  const focus = smoothstep(T.focus[0], T.focus[1], p);
  const sampleVisible = p >= T.cut;
  const formation = smoothstep(T.formation[0], T.formation[1], p);
  return {
    phase: opticalPhaseAtVisual(p),
    instrumentVisible: p < T.cut,
    sampleVisible,
    fieldStop: clamp01(1 - eyecup + open),
    glow,
    glowCore,
    formation,
    detail: formation * (0.3 + 0.7 * smoothstep(0.62, 0.73, p)),
    exposure: 1 - 0.76 * smoothstep(T.exposure[0], T.exposure[1], p),
    focus,
    blurPx: sampleVisible ? 16 * (1 - focus) * (1 - focus) : 0,
    eyecup,
  };
}

/** Janela [a, b, c, d] usada pelos testes de contrato (entrada e saída suaves). */
export function revealWindow(progress: number, a: number, b: number, c: number, d: number) {
  return window01(progress, a, b, c, d);
}
