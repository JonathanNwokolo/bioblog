/**
 * Progresso de rolagem — a única fonte de verdade da jornada em `/explorar`.
 *
 * Este módulo é puro (sem DOM, sem three, sem relógio). Dada a geometria da
 * trilha de rolagem, devolve um progresso normalizado em [0, 1]. Nada aqui
 * incrementa por tempo: a mesma posição de rolagem sempre produz o mesmo valor.
 */

/** Comprimento da trilha em vh (1 viewport fixa + o restante é percurso de rolagem). */
export const JOURNEY_TRACK_VH = 1100;

/** Variação mínima de progresso que justifica redesenhar (~0,4 px de rolagem em 4 000 px). */
export const PROGRESS_EPSILON = 1e-4;

export interface ScrollGeometry {
  /** `getBoundingClientRect().top` da trilha (relativo à viewport). */
  trackTop: number;
  /** Altura total da trilha. */
  trackHeight: number;
  /** Altura do palco `sticky` (≈ 100dvh). */
  viewportHeight: number;
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** Percurso de rolagem útil: o palco fica preso enquanto a trilha excede a viewport. */
export function scrollTravel({ trackHeight, viewportHeight }: Pick<ScrollGeometry, "trackHeight" | "viewportHeight">) {
  return Math.max(0, trackHeight - viewportHeight);
}

/** progresso ∈ [0, 1] a partir da posição real da trilha. Sem estado, sem tempo. */
export function computeScrollProgress(geometry: ScrollGeometry): number {
  const travel = scrollTravel(geometry);
  if (travel <= 0) return 0;
  return clamp01(-geometry.trackTop / travel);
}

/**
 * Posição absoluta de `scrollY` que corresponde a um progresso (para controles
 * de teclado/acessibilidade, que alteram a rolagem — nunca iniciam animação própria).
 */
export function scrollOffsetForProgress(
  geometry: Pick<ScrollGeometry, "trackHeight" | "viewportHeight"> & { trackDocumentTop: number },
  progress: number,
): number {
  return geometry.trackDocumentTop + clamp01(progress) * scrollTravel(geometry);
}

/** Suaviza um intervalo [edge0, edge1] → [0, 1] (Hermite). */
export function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge1 === edge0) return value < edge0 ? 0 : 1;
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** Janela com entrada e saída suaves: 0 → 1 em [a, b], 1 até [c], 1 → 0 em [c, d]. */
export function window01(progress: number, a: number, b: number, c: number, d: number): number {
  return smoothstep(a, b, progress) * (1 - smoothstep(c, d, progress));
}

export type JourneyStageId =
  | "approach"
  | "optical"
  | "scale"
  | "giardia"
  | "t-cruzi"
  | "trichuris"
  | "discovery";

export interface JourneyStage {
  id: JourneyStageId;
  label: string;
  subtitle: string;
  /** Início (inclusivo) em progresso normalizado. */
  start: number;
  /** Fim (exclusivo, exceto o último). */
  end: number;
}

/** Capítulos físicos da Fase 2.3.10; os intervalos biológicos vivem em `specimenTimeline`. */
export const JOURNEY_STAGES: readonly JourneyStage[] = [
  {
    id: "approach",
    label: "O instrumento",
    subtitle: "O microscópio composto estabelece o espaço de observação.",
    start: 0,
    end: 0.11,
  },
  {
    id: "optical",
    label: "A ocular",
    subtitle: "A câmera sobe até o cabeçote binocular e se aproxima da ocular superior.",
    start: 0.11,
    end: 0.22,
  },
  {
    id: "scale",
    label: "Pela ocular",
    subtitle: "O vidro da ocular preenche o campo; a luz do instrumento forma a imagem e o campo de observação se organiza.",
    start: 0.22,
    end: 0.34,
  },
  {
    id: "giardia",
    label: "Giardia",
    subtitle: "Montagem úmida intestinal ilustrativa: matéria orgânica, grânulos e foco local envolvem o trofozoíto.",
    start: 0.34,
    end: 0.56,
  },
  {
    id: "t-cruzi",
    label: "T. cruzi",
    subtitle: "Um novo preparo assume o campo: filme fino de sangue com hemácias e resposta cromática inspirada em Giemsa.",
    start: 0.56,
    end: 0.75,
  },
  {
    id: "trichuris",
    label: "Trichuris",
    subtitle: "A montagem fecal torna-se mais densa, com detritos irregulares e o ovo em seu próprio plano focal.",
    start: 0.75,
    end: 0.92,
  },
  {
    id: "discovery",
    label: "Descoberta",
    subtitle: "Três caminhos para investigar o que acabou de ficar visível.",
    start: 0.92,
    end: 1,
  },
] as const;

export function stageIndexAt(progress: number): number {
  const p = clamp01(progress);
  for (let index = JOURNEY_STAGES.length - 1; index >= 0; index -= 1) {
    if (p >= JOURNEY_STAGES[index].start) return index;
  }
  return 0;
}

/** Próximo (ou anterior) início de etapa em relação a um progresso, para controles de passo. */
export function adjacentStageStart(progress: number, direction: 1 | -1): number {
  const p = clamp01(progress);
  const index = stageIndexAt(p);
  const current = JOURNEY_STAGES[index];
  if (direction === 1) {
    return JOURNEY_STAGES[Math.min(JOURNEY_STAGES.length - 1, index + 1)].start;
  }
  // Para voltar: se já avançou dentro da etapa, volta ao início dela; senão, à anterior.
  if (p - current.start > 0.015) return current.start;
  return JOURNEY_STAGES[Math.max(0, index - 1)].start;
}

/**
 * Opacidade (0–1) dos elementos narrativos em função do progresso.
 * Funções puras: o texto visível em 0,42 não depende do caminho percorrido.
 */
export const BEAT_VISIBILITY = {
  /** Convite inicial (título e chamada para rolar). */
  invitation: (p: number) => 1 - smoothstep(0.05, 0.16, p),
  /** Dica "Role para explorar". */
  scrollHint: (p: number) => 1 - smoothstep(0.015, 0.06, p),
  /** Revelação final dos destinos. */
  discovery: (p: number) => smoothstep(0.92, 0.975, p),
} as const;
