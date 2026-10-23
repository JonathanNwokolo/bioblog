import { ORGANISM_TIMELINE, organismReveal, type OrganismId } from "./opticalTransition.ts";
import { clamp01, smoothstep } from "./scrollProgress.ts";

/**
 * Movimento LOCAL dos organismos (Fase 2.3.9).
 *
 * Contrato (ver README.md e docs/phase239-scientific-motion-report.md):
 *
 *   - O progresso narrativo (rolagem real) continua sendo a única fonte de verdade da câmera,
 *     da transição óptica, da revelação, da composição e da disponibilidade dos marcadores.
 *     Nada neste módulo lê ou escreve o progresso.
 *   - O movimento local é função de um relógio PRÓPRIO (`motionTime`, em segundos), que só avança
 *     enquanto há um organismo visível, o movimento não está pausado, a aba está visível e o
 *     visitante não pediu redução de movimento. Dado `(progress, motionTime)` o quadro é
 *     determinístico: congelar `motionTime` congela a pose.
 *   - Tudo é limitado (amplitudes fixas e pequenas) e não acumula deriva.
 *
 * Este arquivo é puro (sem three, sem DOM) para ser testável em Node. Os mesmos números alimentam
 * o shader (uniforms) e a projeção dos marcadores, de modo que o marcador nunca se afasta da âncora.
 */

export type { OrganismId };

/** Frequências em Hz **de exibição**: interpretação artística em câmera lenta, não medidas biológicas. */
export const MOTION_PARAMS = {
  giardia: {
    /** Fase da onda flagelar (rad/s = 2π·f). Interpretação artística; sem medição publicada de frequência. */
    flagellarHz: 1.35,
    /** Rotação lenta do corpo em torno do eixo longitudinal (descrita qualitativamente na literatura). */
    yawAmplitude: 0.2,
    yawHz: 0.05,
    rollAmplitude: 0.03,
    rollHz: 0.07,
    /** Deslocamento do corpo, em larguras da imagem. */
    shiftAmplitude: [0.012, 0.01] as const,
    shiftHz: [0.045, 0.034] as const,
    /** Amplitude lateral máxima da onda nos flagelos (largura da imagem), na ponta. */
    flagellumAmplitude: 0.024,
    /** Ondas por alcance flagelar. */
    waveNumber: 1.55,
  },
  "t-cruzi": {
    flagellarHz: 1.05,
    yawAmplitude: 0.14,
    yawHz: 0.043,
    rollAmplitude: 0.022,
    rollHz: 0.06,
    shiftAmplitude: [0.01, 0.008] as const,
    shiftHz: [0.04, 0.031] as const,
    flagellumAmplitude: 0.026,
    /** Ondas ao longo do comprimento do flagelo livre. */
    waveNumber: 2.2,
    membraneAmplitude: 0.0075,
    membraneWaveNumber: 3.2,
    /** Flexão sutil do corpo (largura da imagem), parábola 4u(1−u) pinada nas extremidades. */
    flexAmplitude: 0.013,
    flexHz: 0.55,
  },
  trichuris: {
    /** Ovo: sem motilidade autônoma. Apenas inspeção controlada pelo visitante. */
    flagellarHz: 0,
  },
} as const;

/** Qual parâmetro é dado de evidência, interpolação artística ou premissa (para a matriz do relatório). */
export type EvidenceBasis = "morfologia-documentada" | "movimento-documentado" | "interpolacao-artistica" | "premissa-a-revisar";

export interface MotionEvidenceEntry {
  organism: OrganismId;
  parameter: string;
  basis: EvidenceBasis;
  note: string;
}

export const MOTION_EVIDENCE: readonly MotionEvidenceEntry[] = [
  { organism: "giardia", parameter: "oito flagelos em quatro pares", basis: "morfologia-documentada", note: "CDC DPDx lista 8 flagelos; pares anterior, posterolateral, ventral e caudal descritos em literatura revisada por pares (House et al., 2011, PLoS Pathog)." },
  { organism: "giardia", parameter: "flagelos batem de forma ondulatória e coordenada", basis: "movimento-documentado", note: "Descrito qualitativamente (par ventral semi-sigmoidal; nem todos os pares têm forma de onda característica). Sem frequência nem comprimento de onda publicados nas fontes consultadas." },
  { organism: "giardia", parameter: "frequência de exibição 1,35 Hz", basis: "interpolacao-artistica", note: "Câmera lenta legível; NÃO é a frequência biológica." },
  { organism: "giardia", parameter: "rotação lenta do corpo (±11,5°)", basis: "interpolacao-artistica", note: "A natação livre é descrita como saltatória/errática com rotação lenta em torno do eixo longitudinal (J. Exp. Biol. 60:207, conforme resumo da busca; conferir no texto); a amplitude exibida é artística." },
  { organism: "giardia", parameter: "fases entre flagelos", basis: "interpolacao-artistica", note: "Defasagem por setor angular para evitar hélices sincronizadas; não representa o ciclo real de cada par." },
  { organism: "giardia", parameter: "relevo (cúpula dorsal)", basis: "interpolacao-artistica", note: "Profundidade derivada da distância à borda; o lado dorsal não tem referência na imagem." },
  { organism: "t-cruzi", parameter: "onda no flagelo livre com propagação da ponta para a base", basis: "premissa-a-revisar", note: "Documentada para epimastigotas (batimentos simétricos ponta→base impulsionam o avanço; «Flagellar Motility of Trypanosoma cruzi Epimastigotes», 2012). Extrapolada ao tripomastigota sanguíneo; revisão especializada pendente." },
  { organism: "t-cruzi", parameter: "membrana ondulante acoplada à onda flagelar", basis: "interpolacao-artistica", note: "A membrana é a conexão do flagelo ao corpo (CDC DPDx). A amplitude e o número de ondas são artísticos." },
  { organism: "t-cruzi", parameter: "flexão sutil do corpo", basis: "interpolacao-artistica", note: "Corpo mostra curvatura característica em esfregaços fixados (CDC DPDx); a flexão dinâmica exibida é artística e limitada a ~1,3 % da largura." },
  { organism: "t-cruzi", parameter: "frequência de exibição 1,05 Hz", basis: "interpolacao-artistica", note: "Para amastigotas intracelulares mediu-se ~0,7 Hz (PMC10128032, 2023); para tripomastigotas não há medida nas fontes consultadas." },
  { organism: "trichuris", parameter: "ausência de motilidade", basis: "morfologia-documentada", note: "Ovo não embrionado eliminado nas fezes (CDC DPDx); nenhum movimento autônomo é exibido." },
  { organism: "trichuris", parameter: "rotação pelo visitante", basis: "interpolacao-artistica", note: "Operação de visualização do modelo educacional, não movimento biológico." },
] as const;

export const MOTILE_ORGANISMS: readonly OrganismId[] = ["giardia", "t-cruzi"];

const TAU = Math.PI * 2;

export interface BodyPose {
  /** Fase da onda flagelar (rad). */
  flagellarPhase: number;
  /** Rotação em torno do eixo vertical da imagem (rad). */
  yaw: number;
  /** Rotação no plano da imagem (rad). */
  roll: number;
  /** Deslocamento do corpo em larguras da imagem. */
  shift: readonly [number, number];
  /** Fase da flexão do corpo (T. cruzi). */
  flexPhase: number;
  /** Amplitude escalar de entrada (0 → 1) aplicada ao movimento local. */
  amount: number;
}

/**
 * Pose do corpo no instante `time` (s) com amplitude `amount` ∈ [0,1].
 * Função pura: mesmo `(id, time, amount)` → mesma pose.
 */
export function bodyPoseAt(id: OrganismId, time: number, amount: number): BodyPose {
  const a = clamp01(amount);
  if (id === "trichuris") {
    return { flagellarPhase: 0, yaw: 0, roll: 0, shift: [0, 0], flexPhase: 0, amount: 0 };
  }
  const p = MOTION_PARAMS[id];
  const offset = id === "giardia" ? 0.6 : 1.9;
  return {
    flagellarPhase: TAU * p.flagellarHz * time,
    yaw: a * p.yawAmplitude * Math.sin(TAU * p.yawHz * time + offset),
    roll: a * p.rollAmplitude * Math.sin(TAU * p.rollHz * time + 0.4),
    shift: [
      a * p.shiftAmplitude[0] * Math.sin(TAU * p.shiftHz[0] * time + 0.2),
      a * p.shiftAmplitude[1] * Math.sin(TAU * p.shiftHz[1] * time + 1.1),
    ],
    flexPhase: id === "t-cruzi" ? TAU * MOTION_PARAMS["t-cruzi"].flexHz * time : 0,
    amount: a,
  };
}

/**
 * Deslocamento lateral do corpo de T. cruzi (largura da imagem) na coordenada axial `u` ∈ [0,1].
 * Espelha o vertex shader: é com ele que a projeção dos marcadores acompanha o corpo.
 */
export function trypanosomaFlexOffset(u: number, pose: BodyPose): number {
  const env = 4 * u * (1 - u);
  return pose.amount * MOTION_PARAMS["t-cruzi"].flexAmplitude * Math.sin(pose.flexPhase - 2.2 * u) * env;
}

/** Amplitude local do organismo ao longo da jornada: nasce com o foco e some fora da janela e no hub. */
export function motionAmount(id: OrganismId, progress: number): number {
  const reveal = organismReveal(id, progress);
  return reveal * reveal;
}

/** Entrada de decisão do agendador de quadros. */
export interface MotionSchedulerInput {
  /** Algum organismo móvel está visível e suficientemente revelado. */
  organismObservable: boolean;
  /** O visitante pausou o movimento. */
  userPaused: boolean;
  reducedMotion: boolean;
  documentHidden: boolean;
  /** Inspeção explícita em andamento (rotação do ovo, arraste, zoom). */
  interacting: boolean;
  disposed: boolean;
  contextLost: boolean;
}

/**
 * Renderização contínua SOMENTE quando há motilidade ativa visível ou uma interação de inspeção.
 * Em qualquer outro estado o motor volta ao modo por demanda (um quadro por mudança de rolagem).
 */
export function shouldRunMotion(input: MotionSchedulerInput): boolean {
  if (input.disposed || input.contextLost || input.documentHidden || input.reducedMotion) return false;
  if (input.interacting) return true;
  return input.organismObservable && !input.userPaused;
}

// -------------------------------------------------------------- composição

export interface OrganismPlacement {
  /** Centro em NDC (-1…1; y para cima). */
  ndcX: number;
  ndcY: number;
  /** Largura exibida em px CSS. */
  widthPx: number;
  /** Rotação no plano (rad). */
  roll: number;
  /** Fator de escala adicional (entrada/saída). */
  scale: number;
}

export interface HubTarget {
  /** Centro em px CSS relativos ao palco. */
  x: number;
  y: number;
  widthPx: number;
}

/** Proporção altura/largura das texturas (manifesto). */
export const ORGANISM_ASPECT: Record<OrganismId, number> = {
  giardia: 1.09425,
  "t-cruzi": 0.5,
  trichuris: 0.45793,
};

const BASE_ROLL: Record<OrganismId, number> = { giardia: -0.1, "t-cruzi": -0.08, trichuris: -0.36 };

/**
 * Composição final (descoberta): cada organismo ocupa o próprio lugar na lista. O ovo é o último
 * da jornada e permanece (a janela dele termina quando a lista começa); os outros dois entram
 * junto com o texto da descoberta, depois que a janela de observação deles já terminou.
 */
export const HUB_WINDOW: Record<OrganismId, readonly [number, number]> = {
  giardia: [0.985, 0.998],
  "t-cruzi": [0.985, 0.998],
  trichuris: [0.985, 0.998],
};

const enter = (id: OrganismId, progress: number) =>
  smoothstep(ORGANISM_TIMELINE[id].in[0], ORGANISM_TIMELINE[id].in[1], progress);
const exit = (id: OrganismId, progress: number) =>
  smoothstep(ORGANISM_TIMELINE[id].out[0], ORGANISM_TIMELINE[id].out[1], progress);

/** Composição do organismo dentro da própria janela de observação. */
export function windowPlacement(id: OrganismId, progress: number, width: number, height: number): OrganismPlacement {
  const portrait = width <= 700;
  const aspect = ORGANISM_ASPECT[id];
  let centerX: number;
  let centerY: number;
  let widthPx: number;
  if (portrait) {
    centerX = id === "t-cruzi" ? 0.48 : 0.49;
    centerY = id === "giardia" ? 0.43 : id === "t-cruzi" ? 0.44 : 0.44;
    widthPx = width * (id === "giardia" ? 0.40 : id === "t-cruzi" ? 0.48 : 0.40);
    // A altura útil é limitada pela barra inferior e pelo cabeçalho.
    const maxHeight = height * (id === "giardia" ? 0.25 : id === "t-cruzi" ? 0.25 : 0.22);
    widthPx = Math.min(widthPx, maxHeight / aspect);
  } else {
    centerX = id === "t-cruzi" ? 0.44 : id === "giardia" ? 0.43 : 0.44;
    centerY = id === "giardia" ? 0.46 : id === "t-cruzi" ? 0.48 : 0.47;
    // Escala calibrada: organismos integrados ao ecossistema da lâmina, não ocupando o palco inteiro.
    const byHeight = (height * (id === "giardia" ? 0.28 : id === "t-cruzi" ? 0.23 : 0.21)) / aspect;
    const byWidth = width * (id === "giardia" ? 0.18 : id === "t-cruzi" ? 0.24 : 0.16);
    widthPx = Math.min(byHeight, byWidth);
  }
  // Deriva suave de entrada e saída: contida para manter o espécime integrado ao campo.
  const inReach = id === "trichuris" ? 0.16 : 0.08;
  const outReach = id === "t-cruzi" ? 0.10 : 0.06;
  const driftIn = (portrait ? inReach * 0.5 : inReach) * (1 - enter(id, progress));
  const driftOut = -(portrait ? outReach * 0.45 : outReach) * exit(id, progress);
  const scale = 0.94 + 0.06 * enter(id, progress) - 0.04 * exit(id, progress);
  return {
    ndcX: (centerX * 2 - 1) + driftIn + driftOut,
    ndcY: 1 - centerY * 2,
    widthPx,
    roll: BASE_ROLL[id],
    scale,
  };
}

/**
 * Área livre para o espécime enquanto o painel de inspeção está aberto.
 * Desktop/tablet: o painel ocupa a direita (até 430 px) e o espécime fica na área restante.
 * Retrato (≤ 700 px): o painel vira uma folha inferior e o espécime ocupa a faixa acima dela.
 */
export interface InspectionBounds {
  cx: number;
  cy: number;
  maxWidthPx: number;
}

export function inspectionBounds(id: OrganismId, width: number, height: number): InspectionBounds {
  const aspect = ORGANISM_ASPECT[id];
  if (width <= 700) {
    const panelHeight = Math.min(height * 0.46, 400);
    const top = 76;
    const bottom = Math.max(top + 60, height - 94 - panelHeight - 14);
    return {
      cx: width / 2,
      cy: (top + bottom) / 2,
      maxWidthPx: Math.min(width * 0.94, ((bottom - top) / aspect) * 0.92),
    };
  }
  const panelWidth = Math.min(430, width - 36);
  const margin = Math.min(48, Math.max(18, width * 0.03));
  const free = Math.max(120, width - panelWidth - margin - 28);
  return { cx: free / 2, cy: height * 0.5, maxWidthPx: free * 0.94 };
}

/** Composição durante a inspeção: dentro da área livre, sem deriva. */
export function inspectionPlacement(id: OrganismId, progress: number, width: number, height: number): OrganismPlacement {
  const base = windowPlacement(id, progress, width, height);
  const bounds = inspectionBounds(id, width, height);
  return {
    ndcX: (bounds.cx / width) * 2 - 1,
    ndcY: 1 - (bounds.cy / height) * 2,
    widthPx: Math.min(base.widthPx, bounds.maxWidthPx),
    roll: base.roll,
    scale: 1,
  };
}

/** Alvo padrão do hub (quando a camada DOM ainda não mediu a lista). */
export function defaultHubTarget(id: OrganismId, width: number, height: number): HubTarget {
  const index = id === "giardia" ? 0 : id === "t-cruzi" ? 1 : 2;
  if (width <= 980) {
    const sizes = [0.18, 0.26, 0.2];
    return { x: width * (0.2 + index * 0.3), y: height * 0.2, widthPx: width * sizes[index] };
  }
  const sizes = [0.1, 0.14, 0.1];
  return { x: width * 0.41, y: height * (0.33 + index * 0.16), widthPx: width * sizes[index] };
}

/**
 * Composição efetiva: janela de observação → lista de descoberta.
 * `hub` fornece o alvo medido na camada DOM (px relativos ao palco).
 */
export function organismPlacement(
  id: OrganismId,
  progress: number,
  width: number,
  height: number,
  hub?: HubTarget,
): OrganismPlacement {
  const base = windowPlacement(id, progress, width, height);
  const [hubFrom, hubTo] = HUB_WINDOW[id];
  if (progress < hubFrom - 0.0001) return base;
  const target = hub ?? defaultHubTarget(id, width, height);
  const hubPlacement: OrganismPlacement = {
    ndcX: (target.x / width) * 2 - 1,
    ndcY: 1 - (target.y / height) * 2,
    widthPx: target.widthPx,
    roll: BASE_ROLL[id] * 0.5,
    scale: 1,
  };
  // Organismos cuja janela terminou antes do hub aparecem direto no lugar da lista (sem deslizar).
  if (ORGANISM_TIMELINE[id].out[1] < hubFrom) return hubPlacement;
  const mix = smoothstep(hubFrom, hubTo, progress);
  return {
    ndcX: base.ndcX + (hubPlacement.ndcX - base.ndcX) * mix,
    ndcY: base.ndcY + (hubPlacement.ndcY - base.ndcY) * mix,
    widthPx: base.widthPx + (hubPlacement.widthPx - base.widthPx) * mix,
    roll: base.roll + (hubPlacement.roll - base.roll) * mix,
    scale: base.scale + (hubPlacement.scale - base.scale) * mix,
  };
}

/**
 * Opacidade efetiva: janela de observação ou presença quieta na composição final.
 * `focus` (0 → 1) só existe na entrada: o espécime resolve de desfocado a nítido e depois apenas
 * se dissipa, sem voltar a desfocar na saída.
 */
export function organismPresence(id: OrganismId, progress: number): { reveal: number; hub: number; focus: number } {
  const reveal = organismReveal(id, progress);
  const hub = smoothstep(HUB_WINDOW[id][0], HUB_WINDOW[id][1], progress);
  return { reveal, hub, focus: enter(id, progress) };
}

/** Opacidade combinada da janela de observação e da presença quieta no hub (união: nunca dá um vale). */
export function combinedPresence(reveal: number, hub: number): number {
  return 1 - (1 - reveal) * (1 - hub * 0.92);
}
