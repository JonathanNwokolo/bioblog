import { clamp01, smoothstep } from "./scrollProgress.ts";

export type SpecimenWorldId = "giardia" | "blood" | "stool";

export interface SpecimenChapter {
  id: "giardia" | "t-cruzi" | "trichuris";
  world: SpecimenWorldId;
  environment: readonly [number, number];
  reveal: readonly [number, number];
  contemplation: readonly [number, number];
  departure: readonly [number, number];
  transitionBuffer: readonly [number, number];
}

/**
 * Timeline editorial da Fase 2.3.11.
 *
 * A entrada óptica termina em 24,3% de uma trilha de 1500vh. Em distância física isso preserva
 * a travessia aprovada da Fase 2.3.10. O ganho de percurso pertence à busca, revelação,
 * contemplação, saída e buffer de cada preparo.
 */
export const SPECIMEN_TIMELINE = {
  opticalEnd: 0.235,
  chapters: {
    giardia: {
      id: "giardia",
      world: "giardia",
      environment: [0.235, 0.315],
      reveal: [0.315, 0.355],
      contemplation: [0.355, 0.435],
      departure: [0.435, 0.465],
      transitionBuffer: [0.465, 0.535],
    },
    "t-cruzi": {
      id: "t-cruzi",
      world: "blood",
      environment: [0.535, 0.615],
      reveal: [0.615, 0.650],
      contemplation: [0.650, 0.725],
      departure: [0.725, 0.755],
      transitionBuffer: [0.755, 0.795],
    },
    trichuris: {
      id: "trichuris",
      world: "stool",
      environment: [0.800, 0.835],
      reveal: [0.835, 0.865],
      contemplation: [0.865, 0.940],
      departure: [0.940, 0.965],
      transitionBuffer: [0.965, 0.985],
    },
  } satisfies Record<"giardia" | "t-cruzi" | "trichuris", SpecimenChapter>,
  discovery: [0.985, 0.999] as const,
  worldTransitions: {
    giardiaToBlood: [0.495, 0.535] as const,
    bloodToStool: [0.765, 0.800] as const,
  },
} as const;

/**
 * O sample visual legado 0..0,665 contém a aproximação/entrada aprovada. Remapeá-lo para
 * 0..0,34, em vez de reautorá-lo, preserva câmera, FOV e óptica enquanto a trilha cresce.
 */
export function legacyVisualProgress(progressInput: number): number {
  const progress = clamp01(progressInput);
  const edge = SPECIMEN_TIMELINE.opticalEnd;
  const visual = progress <= edge
    ? (progress / edge) * 0.665
    : 0.665 + ((progress - edge) / (1 - edge)) * (1 - 0.665);
  // Garante a semântica inclusiva do corte mesmo após a ida e volta entre os dois domínios.
  return Math.abs(visual - 0.555) < 1e-12 ? 0.555 : visual;
}

export function narrativeProgressFromLegacy(legacyInput: number): number {
  const legacy = clamp01(legacyInput);
  const edge = SPECIMEN_TIMELINE.opticalEnd;
  if (legacy <= 0.665) return (legacy / 0.665) * edge;
  return edge + ((legacy - 0.665) / (1 - 0.665)) * (1 - edge);
}

export function specimenWorldWeights(progressInput: number): Record<SpecimenWorldId, number> {
  const progress = clamp01(progressInput);
  const first = smoothstep(
    SPECIMEN_TIMELINE.worldTransitions.giardiaToBlood[0],
    SPECIMEN_TIMELINE.worldTransitions.giardiaToBlood[1],
    progress,
  );
  const second = smoothstep(
    SPECIMEN_TIMELINE.worldTransitions.bloodToStool[0],
    SPECIMEN_TIMELINE.worldTransitions.bloodToStool[1],
    progress,
  );
  return {
    giardia: 1 - first,
    blood: first * (1 - second),
    stool: second,
  };
}

export const PREPARATION_CONTEXTS = {
  giardia: {
    eyebrow: "Preparação 01 · montagem salina fresca",
    title: "Trofozoíto em amostra fecal ilustrativa",
    note: "Campo inspirado em montagem salina de fezes diarreicas frescas, onde trofozoítos podem ser observados. Interpretação educacional, não lâmina diagnóstica.",
  },
  blood: {
    eyebrow: "Preparação 02 · esfregaço sanguíneo",
    title: "Tripomastigota em filme fino corado",
    note: "Hemácias em distribuição irregular e resposta cromática inspirada em Giemsa. Escala relativa editorial.",
  },
  stool: {
    eyebrow: "Preparação 03 · montagem fecal",
    title: "Ovo em campo úmido com iodo",
    note: "Detritos fecais, grânulos e fragmentos vegetais ilustrativos. Nenhuma outra espécie parasitária foi inventada.",
  },
} as const;

export function dominantSpecimenWorld(progressInput: number): SpecimenWorldId {
  const weights = specimenWorldWeights(progressInput);
  return (Object.entries(weights) as Array<[SpecimenWorldId, number]>).sort((a, b) => b[1] - a[1])[0][0];
}
