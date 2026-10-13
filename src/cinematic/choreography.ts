import { clamp01, smoothstep } from "./scrollProgress.ts";
import { nominalEntry, type OpticalEntry } from "./opticalEntry.ts";
import { OPTICAL_TIMELINE, OPTICAL_VISUAL_TIMELINE, sampleOptics, type OpticalState } from "./opticalTransition.ts";
import { legacyVisualProgress, narrativeProgressFromLegacy } from "./specimenTimeline.ts";

/**
 * Coreografia determinística da jornada.
 *
 * `sampleJourney(progress, path)` é uma função pura: o mesmo progresso devolve sempre
 * a mesma pose de câmera, o mesmo FOV e os mesmos fatores de cena. Não há
 * integração incremental, relógio nem estado acumulado — por isso o frame em
 * 0,42 é idêntico quando se chega avançando ou retrocedendo.
 *
 * As coordenadas estão no referencial do microscópio (`+z` aponta da platina para
 * a base, `-z` para o topo do cabeçote, `+y` para o visitante). O motor converte
 * para o mundo com a matriz do referencial.
 *
 * A trajetória é DERIVADA da ocular: `buildJourneyPath(entry)` recebe o centro e a
 * normal externa do vidro (medidos nos transforms reais da malha) e constrói a
 * curva a partir deles. A câmera chega pelo eixo da ocular, do lado do observador,
 * e para diante do vidro.
 *
 * A curva é composta em dois trechos, separados no `CUT` de `opticalTransition`:
 *
 *   - antes do corte: a câmera só existe no espaço do instrumento e NUNCA entra no
 *     vidro nem no cabeçote (o último ponto é `onAxis(EYE_RELIEF)`, diante da ocular);
 *   - depois do corte: o instrumento não é mais desenhado; a câmera continua pelo
 *     eixo óptico e segue pelo campo de observação (cena da amostra).
 *
 * Na troca, a posição e a direção de visão são contínuas e o campo inteiro está
 * luminoso: nada do exterior é visível. Ver `docs/phase238-optical-transition-acceptance.md`.
 */

export type Vec3 = readonly [number, number, number];
type V3 = [number, number, number];

interface Keyframe<T> {
  /** Progresso normalizado em [0, 1]. */
  p: number;
  v: T;
}

/** Origem do micromundo no referencial em que ele foi autorado (a câmera olha para `-z`). */
export const WORLD_OFFSET: Vec3 = [0.35, 0.1, -11.6];
/**
 * Distância, ao longo do eixo óptico a partir do vidro, em que a origem do micromundo
 * é ancorada. O campo de observação fica, portanto, "do outro lado" da ocular.
 */
export const OBSERVATION_DEPTH = 8.5;

/** Instante do corte: o instrumento deixa de ser desenhado e a cena da amostra assume. */
export const CUT = OPTICAL_TIMELINE.cut;
const VISUAL_CUT = OPTICAL_VISUAL_TIMELINE.cut;
/** Distância mínima ao vidro (ao longo da normal): a câmera para diante da ocular. */
export const EYE_RELIEF = 0.34;

const add = (a: Vec3, b: Vec3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: Vec3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const normalize = (a: Vec3): V3 => {
  const length = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / length, a[1] / length, a[2] / length];
};

/** Quaternion [x, y, z, w] da rotação mínima que leva `from` a `to` (ambos unitários). */
function quaternionFromUnitVectors(from: Vec3, to: Vec3): [number, number, number, number] {
  const d = dot(from, to);
  if (d > 0.999999) return [0, 0, 0, 1];
  if (d < -0.999999) {
    const axis = normalize(Math.abs(from[0]) < 0.9 ? cross(from, [1, 0, 0]) : cross(from, [0, 1, 0]));
    return [axis[0], axis[1], axis[2], 0];
  }
  const axis = cross(from, to);
  const w = 1 + d;
  const length = Math.hypot(axis[0], axis[1], axis[2], w);
  return [axis[0] / length, axis[1] / length, axis[2] / length, w / length];
}

function rotateByQuaternion(v: Vec3, q: readonly [number, number, number, number]): V3 {
  const [x, y, z, w] = q;
  const uv = cross([x, y, z], v);
  const uuv = cross([x, y, z], uv);
  return [v[0] + 2 * (w * uv[0] + uuv[0]), v[1] + 2 * (w * uv[1] + uuv[1]), v[2] + 2 * (w * uv[2] + uuv[2])];
}

/** Tensão das tangentes (Catmull–Rom cardinal). 0,5 = Catmull–Rom clássico. */
const TENSION = 0.5;

function segmentIndex<T>(keys: readonly Keyframe<T>[], p: number): number {
  let index = 0;
  for (let i = 0; i < keys.length - 1; i += 1) {
    if (p >= keys[i].p) index = i;
  }
  return index;
}

function tangent(keys: readonly Keyframe<number>[], i: number): number {
  const prev = keys[Math.max(0, i - 1)];
  const next = keys[Math.min(keys.length - 1, i + 1)];
  const dp = next.p - prev.p;
  return dp === 0 ? 0 : (TENSION * 2 * (next.v - prev.v)) / dp;
}

/** Interpolação Hermite (tangentes Catmull–Rom, espaçamento não uniforme) de um escalar. */
export function sampleScalarTrack(keys: readonly Keyframe<number>[], progress: number): number {
  const p = clamp01(progress);
  const i = segmentIndex(keys, p);
  const a = keys[i];
  const b = keys[i + 1];
  const h = b.p - a.p;
  if (h <= 0) return a.v;
  const s = (p - a.p) / h;
  const s2 = s * s;
  const s3 = s2 * s;
  const m0 = tangent(keys, i) * h;
  const m1 = tangent(keys, i + 1) * h;
  return (
    (2 * s3 - 3 * s2 + 1) * a.v +
    (s3 - 2 * s2 + s) * m0 +
    (-2 * s3 + 3 * s2) * b.v +
    (s3 - s2) * m1
  );
}

function sampleVec3Track(keys: readonly Keyframe<Vec3>[], progress: number): V3 {
  const channel = (axis: 0 | 1 | 2) =>
    sampleScalarTrack(
      keys.map((key) => ({ p: key.p, v: key.v[axis] })),
      progress,
    );
  return [channel(0), channel(1), channel(2)];
}

/** Pontos de passagem nomeados (usados pela depuração e pelo QA espacial). */
export interface Waypoint {
  p: number;
  name: string;
  position: Vec3;
}

export interface JourneyPath {
  entry: OpticalEntry;
  /** Câmera e alvo antes do corte (espaço do instrumento). */
  camera: readonly Keyframe<Vec3>[];
  target: readonly Keyframe<Vec3>[];
  /** Câmera e alvo a partir do corte (cena da amostra). */
  sampleCamera: readonly Keyframe<Vec3>[];
  sampleTarget: readonly Keyframe<Vec3>[];
  fov: readonly Keyframe<number>[];
  /** Referencial do campo de observação (micromundo + partículas), alinhado ao eixo da ocular. */
  observation: {
    position: Vec3;
    quaternion: readonly [number, number, number, number];
  };
  waypoints: readonly Waypoint[];
}

const FOV_KEYS: readonly Keyframe<number>[] = [
  { p: 0.0, v: 39 },
  { p: 0.2, v: 37 },
  { p: 0.3, v: 38 },
  { p: 0.4, v: 40 },
  { p: 0.47, v: 44 },
  { p: 0.52, v: 48 },
  { p: VISUAL_CUT, v: 50 },
  { p: 0.62, v: 50 },
  { p: 0.8, v: 44 },
  { p: 1.0, v: 42 },
];

/**
 * Chaves de câmera/alvo ao longo do eixo óptico. `onAxis(s, lateral)` é o ponto
 * `centro + normal·s` (s > 0: lado do observador; s < 0: do outro lado do vidro).
 *
 * | progresso    | etapa                                                    |
 * |--------------|----------------------------------------------------------|
 * | 0 – 0,20     | microscópio completo (composição editorial)              |
 * | 0,20 – 0,40  | aproximação do cabeçote e da ocular superior             |
 * | 0,40 – 0,545 | acoplamento: a câmera chega ao vidro e para diante dele  |
 * | 0,545 – 0,70 | campo de observação (instrumento oculto)                 |
 * | 0,70 – 1,00  | observação microscópica e descoberta                     |
 */
export function buildJourneyPath(entry: OpticalEntry): JourneyPath {
  const c = entry.center;
  const n = normalize(entry.normal);
  const onAxis = (s: number, lateral: Vec3 = [0, 0, 0]): V3 => add(add(c, scale(n, s)), lateral);

  // Referencial de observação: o `+z` autoral do micromundo passa a ser a normal da ocular,
  // de modo que a câmera, que no micromundo avança para `-z`, segue o eixo óptico (`-normal`).
  const quaternion = quaternionFromUnitVectors([0, 0, 1], n);
  const anchor = add(c, scale(n, -OBSERVATION_DEPTH));
  const position = sub(anchor, rotateByQuaternion(WORLD_OFFSET, quaternion));
  const toFrame = (authored: Vec3): V3 => add(position, rotateByQuaternion(authored, quaternion));

  // Trecho de observação, autorado no referencial do micromundo (chaves originais da Fase 2.3).
  const observationCamera: Keyframe<Vec3>[] = [
    { p: 0.7, v: [0.72, 0.2, -7.6] },
    { p: 0.77, v: [0.8, 0.22, -8.5] },
    { p: 0.82, v: [0.95, 0.3, -9.7] },
    { p: 0.9, v: [1.1, 0.28, -10.6] },
    { p: 1.0, v: [1.2, 0.22, -11.15] },
  ];
  const observationTarget: Keyframe<Vec3>[] = [
    { p: 0.7, v: [0.9, 0.15, -10.7] },
    { p: 0.77, v: [0.98, 0.16, -11.0] },
    { p: 0.82, v: [1.4, 0.2, -11.45] },
    { p: 0.9, v: [1.7, 0.2, -11.6] },
    { p: 1.0, v: [1.8, 0.15, -11.7] },
  ];

  // Antes do corte: espaço do instrumento. A câmera só se aproxima; nunca entra no vidro.
  const instrumentCamera: Keyframe<Vec3>[] = [
    // 0 – 0,20: o instrumento inteiro, vista frontal (composição aprovada).
    { p: 0.0, v: [-2.8, 19.0, 0.6] },
    { p: 0.1, v: [-2.0, 14.5, -0.9] },
    { p: 0.2, v: [-0.3, 10.6, -4.2] },
    // 0,20 – 0,40: sobe pelo lado do observador até o eixo da ocular.
    { p: 0.3, v: onAxis(7.0, [0.5, 0, 0]) },
    { p: 0.4, v: onAxis(3.2, [0.12, 0, 0]) },
    // 0,40 – corte: alinhamento frontal; o vidro passa a ocupar o campo visual.
    { p: 0.44, v: onAxis(1.7, [0.04, 0, 0]) },
    { p: 0.47, v: onAxis(1.0) },
    { p: 0.5, v: onAxis(0.62) },
    { p: 0.53, v: onAxis(0.42) },
    { p: VISUAL_CUT, v: onAxis(EYE_RELIEF) },
  ];
  const instrumentTarget: Keyframe<Vec3>[] = [
    { p: 0.0, v: [-2.8, 0.0, 0.6] },
    { p: 0.1, v: [-2.0, 0.0, -0.9] },
    { p: 0.2, v: [0.3, 0.8, -3.9] },
    { p: 0.3, v: onAxis(0.4) },
    { p: 0.4, v: onAxis(0) },
    { p: 0.44, v: onAxis(-0.3) },
    { p: 0.47, v: onAxis(-0.7) },
    { p: 0.5, v: onAxis(-1.2) },
    { p: 0.53, v: onAxis(-1.7) },
    { p: VISUAL_CUT, v: onAxis(-2.0) },
  ];

  // Depois do corte: a cena da amostra. A câmera segue o mesmo eixo e entra no campo.
  const sampleCamera: Keyframe<Vec3>[] = [
    { p: VISUAL_CUT, v: onAxis(EYE_RELIEF) },
    { p: 0.62, v: onAxis(-2.2) },
    ...observationCamera.map((key) => ({ p: key.p, v: toFrame(key.v) as Vec3 })),
  ];
  const sampleTarget: Keyframe<Vec3>[] = [
    { p: VISUAL_CUT, v: onAxis(-2.0) },
    { p: 0.62, v: onAxis(-5.5) },
    ...observationTarget.map((key) => ({ p: key.p, v: toFrame(key.v) as Vec3 })),
  ];

  const waypoints: Waypoint[] = [
    { p: 0.0, name: "instrumento completo", position: instrumentCamera[0].v },
    { p: 0.2, name: "início da aproximação", position: instrumentCamera[2].v },
    { p: 0.3, name: "cabeçote binocular", position: instrumentCamera[3].v },
    { p: 0.4, name: "diante da ocular", position: instrumentCamera[4].v },
    { p: 0.47, name: "alinhamento frontal", position: instrumentCamera[6].v },
    { p: CUT, name: "vidro da ocular (corte óptico)", position: instrumentCamera[instrumentCamera.length - 1].v },
    { p: 0.7, name: "plano da amostra", position: sampleCamera[2].v },
    { p: 1.0, name: "descoberta", position: sampleCamera[sampleCamera.length - 1].v },
  ];

  return {
    entry,
    camera: instrumentCamera,
    target: instrumentTarget,
    sampleCamera,
    sampleTarget,
    fov: FOV_KEYS,
    observation: { position, quaternion },
    waypoints,
  };
}

/** Trajetória nominal (a partir da especificação do asset). O motor a substitui pela medida. */
export const DEFAULT_PATH: JourneyPath = buildJourneyPath(nominalEntry());

export interface JourneySample {
  progress: number;
  camera: [number, number, number];
  target: [number, number, number];
  /** Vetor "para cima" da câmera no referencial do microscópio. */
  up: [number, number, number];
  fov: number;
  roll: number;
  /** Estado óptico (visibilidade do instrumento/amostra, limitador de campo, luz, foco). */
  optics: OpticalState;
  /** 0 → 1: marcadores dos destinos. */
  discoveryReveal: number;
  /** Escala dos holofotes do instrumento (o campo da amostra é iluminado por luzes próprias). */
  instrumentLight: number;
}

/** "Para cima" do estúdio: topo do cabeçote (`-z`). Durante a observação, o `+y` autoral do micromundo. */
const STUDIO_UP: Vec3 = [0, 0, -1];

export function sampleJourney(progressInput: number, path: JourneyPath = DEFAULT_PATH): JourneySample {
  const progress = clamp01(progressInput);
  const visualProgress = legacyVisualProgress(progress);
  const optics = sampleOptics(progress);
  const observationUp = rotateByQuaternion([0, 1, 0], path.observation.quaternion);
  const upMix = smoothstep(0.46, 0.56, visualProgress);
  const up = normalize([
    STUDIO_UP[0] + (observationUp[0] - STUDIO_UP[0]) * upMix,
    STUDIO_UP[1] + (observationUp[1] - STUDIO_UP[1]) * upMix,
    STUDIO_UP[2] + (observationUp[2] - STUDIO_UP[2]) * upMix,
  ]);
  const inSample = visualProgress >= VISUAL_CUT;
  return {
    progress,
    camera: sampleVec3Track(inSample ? path.sampleCamera : path.camera, visualProgress),
    target: sampleVec3Track(inSample ? path.sampleTarget : path.target, visualProgress),
    up,
    fov: sampleScalarTrack(path.fov, visualProgress),
    // Rolagem sutil só depois do corte (sem girar o horizonte durante o acoplamento).
    roll: 0.1 * Math.sin(Math.PI * smoothstep(0.62, 0.8, visualProgress)),
    optics,
    discoveryReveal: smoothstep(0.92, 0.975, progress),
    instrumentLight: optics.instrumentVisible ? 1 : 0.08,
  };
}

const narrativeKeys = <T,>(keys: readonly Keyframe<T>[]) =>
  keys.map((key) => ({ ...key, p: narrativeProgressFromLegacy(key.p) }));

export const CHOREOGRAPHY_KEYS = {
  camera: narrativeKeys(DEFAULT_PATH.camera),
  target: narrativeKeys(DEFAULT_PATH.target),
  sampleCamera: narrativeKeys(DEFAULT_PATH.sampleCamera),
  sampleTarget: narrativeKeys(DEFAULT_PATH.sampleTarget),
  fov: narrativeKeys(DEFAULT_PATH.fov),
} as const;
