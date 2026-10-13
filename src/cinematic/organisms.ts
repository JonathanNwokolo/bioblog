import * as THREE from "three";
import { ORGANISM_MANIFEST } from "./organismManifest";
import {
  MOTION_PARAMS,
  ORGANISM_ASPECT,
  bodyPoseAt,
  combinedPresence,
  inspectionBounds,
  inspectionPlacement,
  motionAmount,
  organismPlacement,
  organismPresence,
  trypanosomaFlexOffset,
  type BodyPose,
  type HubTarget,
  type OrganismId,
} from "./organismMotion";
import type { GraphicsQualityTier } from "./types";

/**
 * Organismos da Fase 2.3.9: reconstruções editoriais (imagens aprovadas) convertidas em folhas de
 * relevo deformadas na GPU. Não há esqueleto 3D nem modelo volumétrico para *Giardia* e *T. cruzi*:
 * a malha é uma folha densa cujos vértices são deslocados por campos derivados do canal alfa
 * (ver `scripts/prepare-organism-assets.mjs`). O ovo de *Trichuris* é um sólido de revolução com a
 * silhueta medida e a textura da reconstrução projetada no plano, para permitir inspeção real.
 *
 * Deformação e pose são função de `(progresso, motionTime)`. Nenhuma geometria nem material é
 * criado em tempo de execução depois da carga: cada quadro só escreve uniforms e transformações.
 */

type Quality = Exclude<GraphicsQualityTier, "fallback">;

export const ORGANISM_IDS: readonly OrganismId[] = ["giardia", "t-cruzi", "trichuris"];

/** Profundidade (ao longo do eixo da câmera) em que as folhas são posicionadas. */
const PLANE_DEPTH = 1.5;

export interface InspectionState {
  /** Organismo em inspeção (painel aberto) ou `null`. */
  active: OrganismId | null;
  /** Rotação alvo escolhida pelo visitante (rad). */
  yaw: number;
  pitch: number;
  zoom: number;
}

export const INSPECTION_LIMITS = {
  yaw: [-1.05, 1.05] as const,
  pitch: [-0.7, 0.7] as const,
  zoom: [1, 1.45] as const,
};

export const DEFAULT_INSPECTION: InspectionState = { active: null, yaw: 0, pitch: 0, zoom: 1 };

export interface OrganismAnchor {
  key: string;
  x: number;
  y: number;
}

export interface OrganismScreenState {
  id: OrganismId;
  visible: boolean;
  /** Centro projetado, px CSS relativos ao canvas. */
  x: number;
  y: number;
  /** Largura projetada da folha, px. */
  widthPx: number;
  /** Alvo do marcador interativo (sobre a margem do corpo, fora da anatomia principal). */
  marker: { x: number; y: number };
  /** Pontos das anotações científicas. */
  labels: OrganismAnchor[];
}

export interface OrganismUpdateInput {
  progress: number;
  sampleVisible: boolean;
  camera: THREE.PerspectiveCamera;
  viewportWidth: number;
  viewportHeight: number;
  /** Segundos de movimento local (relógio próprio; nunca derivado do progresso). */
  motionTime: number;
  /** Rotação/zoom escolhidos pelo visitante para o organismo em inspeção. */
  inspection: InspectionState;
  hub?: Partial<Record<OrganismId, HubTarget>>;
  /** Organismo destacado por hover/foco do link correspondente (composição final). */
  highlight?: OrganismId | null;
}

// -------------------------------------------------------------------------------- âncoras

/** Pontos em frações da imagem (x → direita, y → baixo). Verificados sobre as próprias imagens. */
const ANCHORS: Record<OrganismId, { marker: [number, number]; labels: Array<{ key: string; at: [number, number] }> }> = {
  giardia: {
    marker: [0.735, 0.37],
    labels: [
      { key: "nuclei", at: [0.639, 0.272] },
      { key: "disc", at: [0.4, 0.34] },
      { key: "flagella", at: [0.545, 0.86] },
    ],
  },
  "t-cruzi": {
    marker: [0.5, 0.505],
    labels: [
      { key: "nucleus", at: [0.412, 0.634] },
      { key: "membrane", at: [0.524, 0.735] },
      { key: "flagellum", at: [0.958, 0.56] },
    ],
  },
  trichuris: {
    marker: [0.5, 0.045],
    labels: [
      { key: "plug-left", at: [0.035, 0.5] },
      { key: "plug-right", at: [0.965, 0.5] },
      { key: "shell", at: [0.7, 0.88] },
    ],
  },
};

// -------------------------------------------------------------------------------- shaders

const FRAGMENT_RELIEF = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec2 uTexel;
  uniform float uBias;
  uniform float uOpacity;
  uniform float uBright;
  uniform float uSat;
  uniform float uShade;
  uniform float uRim;
  uniform vec3 uRimColor;
  uniform vec3 uBackTint;
  varying vec2 vUv;
  varying vec3 vViewPos;
  varying float vDefocus;

  void main() {
    // Profundidade de campo leve: as pontas dos flagelos, mais afastadas do plano focal, suavizam.
    vec4 c = texture2D(uMap, vUv, uBias + vDefocus);
    if (c.a < 0.004) discard;
    vec3 col = c.rgb / c.a;
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(l), col, uSat) * uBright;

    vec3 N = normalize(cross(dFdx(vViewPos), dFdy(vViewPos)));
    if (dot(N, -vViewPos) < 0.0) N = -N;
    if (!gl_FrontFacing) {
      // Face dorsal: sem referência fotográfica; sombreamento neutro e translúcido.
      col = mix(col, uBackTint * (0.35 + l), 0.82);
    }
    float lambert = max(dot(N, normalize(vec3(-0.34, 0.52, 0.78))), 0.0);
    col *= mix(1.0, 0.7 + 0.55 * lambert, uShade);

    float aL = textureLod(uMap, vUv - vec2(uTexel.x, 0.0), 0.0).a;
    float aR = textureLod(uMap, vUv + vec2(uTexel.x, 0.0), 0.0).a;
    float aU = textureLod(uMap, vUv + vec2(0.0, uTexel.y), 0.0).a;
    float aD = textureLod(uMap, vUv - vec2(0.0, uTexel.y), 0.0).a;
    float edge = clamp(c.a - 0.25 * (aL + aR + aU + aD), 0.0, 1.0);
    col += uRimColor * edge * uRim;

    float a = c.a * uOpacity;
    gl_FragColor = vec4(col * a, a);
  }
`;

const VERTEX_GIARDIA = /* glsl */ `
  uniform sampler2D uFieldA;
  uniform sampler2D uFieldB;
  uniform float uPhase;
  uniform float uAmp;
  uniform float uAspect;
  uniform vec2 uCentroid;
  uniform float uDome;
  uniform float uAmpMax;
  uniform float uWaveK;
  varying vec2 vUv;
  varying vec3 vViewPos;
  varying float vDefocus;

  void main() {
    vUv = uv;
    vec4 fa = texture2D(uFieldA, uv);
    vec4 fb = texture2D(uFieldB, uv);
    float env = fa.r;
    float reach = fa.g;
    // As normais foram gravadas com y para baixo (imagem); o espaço uv tem y para cima.
    vec2 n = vec2(fa.b * 2.0 - 1.0, -(fa.a * 2.0 - 1.0));

    vec2 rel = (uv - uCentroid) * vec2(1.0, uAspect);
    float ang = atan(rel.y, rel.x);
    // Defasagem por setor angular: pares de flagelos não batem em sincronia (nem como hélices).
    float sector = 1.6 * sin(2.0 * ang + 0.6) + 0.9 * cos(3.0 * ang + 1.3);
    float arg = 6.28318 * uWaveK * reach - uPhase + sector;
    // Onda viajante da base para a ponta, com 2º harmônico (batimento assimétrico, semi-sigmoidal).
    float wave = sin(arg) + 0.26 * sin(2.0 * arg + 1.1);
    float amp = uAmpMax * env * uAmp;

    vec3 pos;
    pos.xy = vec2(uv.x - 0.5, (uv.y - 0.5) * uAspect) + n * wave * amp;
    pos.z = -uDome * fb.r + 0.5 * amp * cos(arg);

    vDefocus = 0.95 * env;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    vViewPos = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const VERTEX_TCRUZI = /* glsl */ `
  uniform sampler2D uFieldA;
  uniform sampler2D uFieldB;
  uniform float uPhase;
  uniform float uFlexPhase;
  uniform float uAmp;
  uniform float uAspect;
  uniform vec2 uP0;
  uniform vec2 uDir;
  uniform float uLen;
  uniform float uDome;
  uniform float uFlexAmp;
  uniform float uFlagAmp;
  uniform float uFlagK;
  uniform float uMemAmp;
  uniform float uMemK;
  varying vec2 vUv;
  varying vec3 vViewPos;
  varying float vDefocus;

  void main() {
    vUv = uv;
    vec4 fa = texture2D(uFieldA, uv);
    vec4 fb = texture2D(uFieldB, uv);

    vec2 q = (uv - uP0) * vec2(1.0, uAspect);
    float u = clamp(dot(q, uDir) / uLen, 0.0, 1.0);
    vec2 perp = vec2(-uDir.y, uDir.x);

    // Flexão sutil do corpo: parábola pinada nas extremidades (a raiz do flagelo não se move).
    float flex = uAmp * uFlexAmp * sin(uFlexPhase - 2.2 * u) * 4.0 * u * (1.0 - u);
    vec2 disp = perp * flex;

    // Flagelo livre: onda viajante da ponta para a base (s: 0 raiz → 1 ponta).
    float s = fa.r;
    float support = fa.g;
    vec2 nf = vec2(fa.b * 2.0 - 1.0, -(fa.a * 2.0 - 1.0));
    float envF = smoothstep(0.0, 0.3, s) * (0.4 + 0.6 * s);
    float argF = 6.28318 * uFlagK * s + uPhase;
    float waveF = sin(argF) + 0.22 * sin(2.0 * argF + 0.9);
    float ampF = uFlagAmp * uAmp * support * envF;
    disp += nf * waveF * ampF;

    // Membrana ondulante: onda acoplada, sobre a banda da margem inferior.
    float m = fb.r;
    vec2 nm = vec2(fb.g * 2.0 - 1.0, -(fb.b * 2.0 - 1.0));
    float envM = smoothstep(0.04, 0.22, u) * (1.0 - smoothstep(0.86, 1.0, u));
    float waveM = sin(6.28318 * uMemK * u + uPhase * 0.9 + 0.7);
    disp += nm * waveM * m * envM * uMemAmp * uAmp;

    vec3 pos;
    pos.xy = vec2(uv.x - 0.5, (uv.y - 0.5) * uAspect) + disp;
    pos.z = uDome * fb.a + 0.5 * ampF * cos(argF) + 0.4 * m * envM * uMemAmp * uAmp * cos(6.28318 * uMemK * u + uPhase * 0.9 + 0.7);

    vDefocus = 0.8 * support * s;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    vViewPos = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const VERTEX_EGG = /* glsl */ `
  varying vec3 vObj;
  varying vec3 vNormalView;
  varying vec3 vViewPos;
  void main() {
    vObj = position;
    vNormalView = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT_EGG = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uAspect;
  uniform float uBias;
  uniform float uOpacity;
  uniform float uBright;
  uniform float uSat;
  uniform vec3 uRimColor;
  varying vec3 vObj;
  varying vec3 vNormalView;
  varying vec3 vViewPos;

  void main() {
    // Projeção planar da reconstrução sobre o sólido de revolução (x ao longo do eixo longo).
    vec2 tuv = vec2(vObj.x + 0.5, 0.5 + vObj.y / uAspect);
    vec3 col = texture2D(uMap, clamp(tuv, 0.002, 0.998), uBias).rgb;
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(l), col, uSat) * uBright;

    vec3 N = normalize(vNormalView);
    vec3 V = normalize(-vViewPos);
    float ndv = clamp(dot(N, V), 0.0, 1.0);
    float fres = pow(1.0 - ndv, 2.4);
    vec3 L = normalize(vec3(-0.34, 0.52, 0.78));
    float lambert = max(dot(N, L), 0.0);
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 54.0);

    // Casca espessa: escurece e esquenta nas margens (percurso óptico maior), brilho especular fino.
    col *= 0.62 + 0.5 * lambert;
    col = mix(col, col * vec3(0.78, 0.6, 0.38), fres * 0.55);
    col += uRimColor * fres * 0.34 + vec3(1.0, 0.94, 0.82) * spec * 0.32;

    float a = uOpacity;
    gl_FragColor = vec4(col * a, a);
  }
`;

// -------------------------------------------------------------------------------- carga

async function loadBitmap(url: string, premultiply: boolean): Promise<ImageBitmap> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`organismo: falha ao carregar ${url} (${response.status})`);
  const blob = await response.blob();
  return createImageBitmap(blob, {
    imageOrientation: "flipY",
    premultiplyAlpha: premultiply ? "premultiply" : "none",
    colorSpaceConversion: "none",
  });
}

function textureFromBitmap(bitmap: ImageBitmap, options: { mipmaps: boolean; anisotropy?: number }) {
  const texture = new THREE.Texture(bitmap as unknown as HTMLImageElement);
  texture.colorSpace = THREE.NoColorSpace;
  texture.flipY = false;
  texture.generateMipmaps = options.mipmaps;
  texture.minFilter = options.mipmaps ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = options.anisotropy ?? 1;
  texture.needsUpdate = true;
  return texture;
}

function readPixels(bitmap: ImageBitmap, width: number, height: number): Uint8ClampedArray | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  // Os bitmaps são carregados com `flipY` (orientação das texturas); desfaz para ler a imagem de cima para baixo.
  context.translate(0, height);
  context.scale(1, -1);
  context.drawImage(bitmap, 0, 0, width, height);
  return context.getImageData(0, 0, width, height).data;
}

/** Folha plana com índices só nas células cobertas pela imagem (dilatadas em 1 célula). */
function buildSheetGeometry(cols: number, rows: number, aspect: number, coverage: Uint8Array) {
  const vertexCount = (cols + 1) * (rows + 1);
  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  for (let j = 0; j <= rows; j += 1) {
    for (let i = 0; i <= cols; i += 1) {
      const index = j * (cols + 1) + i;
      const u = i / cols;
      const v = 1 - j / rows; // linha 0 = topo da imagem
      positions[index * 3] = u - 0.5;
      positions[index * 3 + 1] = (v - 0.5) * aspect;
      uvs[index * 2] = u;
      uvs[index * 2 + 1] = v;
    }
  }
  const dilated = new Uint8Array(cols * rows);
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      if (!coverage[j * cols + i]) continue;
      for (let dj = -1; dj <= 1; dj += 1) {
        for (let di = -1; di <= 1; di += 1) {
          const ni = i + di;
          const nj = j + dj;
          if (ni >= 0 && nj >= 0 && ni < cols && nj < rows) dilated[nj * cols + ni] = 1;
        }
      }
    }
  }
  const indices: number[] = [];
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      if (!dilated[j * cols + i]) continue;
      const a = j * (cols + 1) + i;
      const b = a + 1;
      const c = a + (cols + 1);
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.2);
  return geometry;
}

function coverageFromBitmap(bitmap: ImageBitmap, cols: number, rows: number) {
  const pixels = readPixels(bitmap, cols * 2, rows * 2);
  const coverage = new Uint8Array(cols * rows);
  if (!pixels) {
    coverage.fill(1);
    return coverage;
  }
  const stride = cols * 2;
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      let any = 0;
      for (let dj = 0; dj < 2; dj += 1) {
        for (let di = 0; di < 2; di += 1) {
          if (pixels[((j * 2 + dj) * stride + i * 2 + di) * 4 + 3] > 6) any = 1;
        }
      }
      coverage[j * cols + i] = any;
    }
  }
  return coverage;
}

// -------------------------------------------------------------------------------- sistema

interface ReliefUniforms {
  [key: string]: THREE.IUniform;
}

interface OrganismEntry {
  id: OrganismId;
  /** Posição/rotação de composição (cara voltada para a câmera). */
  root: THREE.Group;
  /** Pose do corpo e inspeção do visitante. */
  pivot: THREE.Group;
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  uniforms: ReliefUniforms;
  aspect: number;
  /** Amostras de relevo para posicionar âncoras (CPU). */
  dome?: { data: Uint8ClampedArray; width: number; height: number; channel: number };
  worldWidth: number;
  presence: number;
  visible: boolean;
}

export interface OrganismDiagnostics {
  ready: boolean;
  triangles: number;
  geometries: number;
  textures: number;
  organisms: Record<string, { visible: boolean; presence: number; yaw: number; pitch: number; widthPx: number }>;
}

export class OrganismSystem {
  public readonly group = new THREE.Group();
  private readonly entries = new Map<OrganismId, OrganismEntry>();
  private readonly disposables: Array<{ dispose: () => void }> = [];
  private readonly quality: Quality;
  private ready = false;
  private disposed = false;
  private readonly tmp = new THREE.Vector3();
  private readonly tmpQuat = new THREE.Quaternion();
  private readonly rollQuat = new THREE.Quaternion();
  private readonly zAxis = new THREE.Vector3(0, 0, 1);
  /** Rotação suavizada da inspeção (visitante). */
  private currentYaw = 0;
  private currentPitch = 0;
  private currentZoom = 1;
  /** Mistura suavizada composição normal → área livre de inspeção (0 → 1). */
  private inspectMix = 0;
  private inspectId: OrganismId | null = null;
  private lastPoses = new Map<OrganismId, BodyPose>();
  private widthsPx = new Map<OrganismId, number>();

  constructor(quality: Quality) {
    this.quality = quality;
    this.group.name = "organisms";
  }

  public isReady() {
    return this.ready;
  }

  public async load(anisotropy = 4): Promise<void> {
    if (this.ready || this.disposed) return;
    const manifest = ORGANISM_MANIFEST;
    const cols = this.quality === "low" ? 0.7 : 1;

    const [gColor, gA, gB, tColor, tA, tB, eColor] = await Promise.all([
      loadBitmap(manifest.giardia.color, true),
      loadBitmap(manifest.giardia.fieldA, false),
      loadBitmap(manifest.giardia.fieldB, false),
      loadBitmap(manifest.tcruzi.color, true),
      loadBitmap(manifest.tcruzi.fieldA, false),
      loadBitmap(manifest.tcruzi.fieldB, false),
      loadBitmap(manifest.trichuris.color, false),
    ]);
    if (this.disposed) return;

    // --- Giardia
    {
      const gCols = Math.round(150 * cols);
      const gRows = Math.round(gCols * manifest.giardia.aspect);
      const geometry = buildSheetGeometry(gCols, gRows, manifest.giardia.aspect, coverageFromBitmap(gColor, gCols, gRows));
      const fieldB = textureFromBitmap(gB, { mipmaps: false });
      const [fw, fh] = manifest.giardia.fieldSize;
      const domePixels = readPixels(gB, fw, fh);
      const uniforms: ReliefUniforms = {
        uMap: { value: textureFromBitmap(gColor, { mipmaps: true, anisotropy }) },
        uFieldA: { value: textureFromBitmap(gA, { mipmaps: false }) },
        uFieldB: { value: fieldB },
        uTexel: { value: new THREE.Vector2(1 / manifest.giardia.colorSize[0], 1 / manifest.giardia.colorSize[1]) },
        uBias: { value: 0 },
        uOpacity: { value: 0 },
        uBright: { value: 0.94 },
        uSat: { value: 0.88 },
        uShade: { value: 0.55 },
        uRim: { value: 0.5 },
        uRimColor: { value: new THREE.Color(0.55, 0.9, 0.78) },
        uBackTint: { value: new THREE.Color(0.32, 0.5, 0.45) },
        uPhase: { value: 0 },
        uAmp: { value: 0 },
        uAspect: { value: manifest.giardia.aspect },
        uCentroid: { value: new THREE.Vector2(manifest.giardia.bodyCentroid[0], 1 - manifest.giardia.bodyCentroid[1]) },
        uDome: { value: 0.15 },
        uAmpMax: { value: MOTION_PARAMS.giardia.flagellumAmplitude },
        uWaveK: { value: MOTION_PARAMS.giardia.waveNumber },
      };
      this.addEntry("giardia", geometry, uniforms, VERTEX_GIARDIA, FRAGMENT_RELIEF, manifest.giardia.aspect, domePixels
        ? { data: domePixels, width: fw, height: fh, channel: 0 }
        : undefined);
    }

    // --- T. cruzi
    {
      const tCols = Math.round(210 * cols);
      const tRows = Math.round(tCols * manifest.tcruzi.aspect);
      const geometry = buildSheetGeometry(tCols, tRows, manifest.tcruzi.aspect, coverageFromBitmap(tColor, tCols, tRows));
      const [fw, fh] = manifest.tcruzi.fieldSize;
      const domePixels = readPixels(tB, fw, fh);
      const root = manifest.tcruzi.flagellumRoot;
      const post = manifest.tcruzi.bodyPosterior;
      const p0 = new THREE.Vector2(post[0], 1 - post[1]);
      const axis = new THREE.Vector2((root[0] - post[0]) , -(root[1] - post[1]) * manifest.tcruzi.aspect);
      const length = axis.length();
      axis.normalize();
      const uniforms: ReliefUniforms = {
        uMap: { value: textureFromBitmap(tColor, { mipmaps: true, anisotropy }) },
        uFieldA: { value: textureFromBitmap(tA, { mipmaps: false }) },
        uFieldB: { value: textureFromBitmap(tB, { mipmaps: false }) },
        uTexel: { value: new THREE.Vector2(1 / manifest.tcruzi.colorSize[0], 1 / manifest.tcruzi.colorSize[1]) },
        uBias: { value: 0 },
        uOpacity: { value: 0 },
        uBright: { value: 0.96 },
        uSat: { value: 0.9 },
        uShade: { value: 0.4 },
        uRim: { value: 0.42 },
        uRimColor: { value: new THREE.Color(0.74, 0.66, 0.92) },
        uBackTint: { value: new THREE.Color(0.38, 0.34, 0.5) },
        uPhase: { value: 0 },
        uFlexPhase: { value: 0 },
        uAmp: { value: 0 },
        uAspect: { value: manifest.tcruzi.aspect },
        uP0: { value: p0 },
        uDir: { value: axis },
        uLen: { value: length },
        uDome: { value: 0.045 },
        uFlexAmp: { value: MOTION_PARAMS["t-cruzi"].flexAmplitude },
        uFlagAmp: { value: MOTION_PARAMS["t-cruzi"].flagellumAmplitude },
        uFlagK: { value: MOTION_PARAMS["t-cruzi"].waveNumber },
        uMemAmp: { value: MOTION_PARAMS["t-cruzi"].membraneAmplitude },
        uMemK: { value: MOTION_PARAMS["t-cruzi"].membraneWaveNumber },
      };
      this.addEntry("t-cruzi", geometry, uniforms, VERTEX_TCRUZI, FRAGMENT_RELIEF, manifest.tcruzi.aspect, domePixels
        ? { data: domePixels, width: fw, height: fh, channel: 3 }
        : undefined);
    }

    // --- Trichuris: sólido de revolução com a silhueta medida.
    {
      const aspect = manifest.trichuris.aspect;
      const profile = manifest.trichuris.profile;
      const points: THREE.Vector2[] = [new THREE.Vector2(0, -0.5)];
      profile.forEach((radius, index) => {
        points.push(new THREE.Vector2(Math.max(0.0005, radius), index / (profile.length - 1) - 0.5));
      });
      points.push(new THREE.Vector2(0, 0.5));
      const radial = this.quality === "low" ? 40 : 72;
      const geometry = new THREE.LatheGeometry(points, radial);
      geometry.rotateZ(Math.PI / 2); // eixo longo ao longo de x
      geometry.computeVertexNormals();
      const uniforms: ReliefUniforms = {
        uMap: { value: textureFromBitmap(eColor, { mipmaps: true, anisotropy }) },
        uAspect: { value: aspect },
        uBias: { value: 0 },
        uOpacity: { value: 0 },
        uBright: { value: 0.9 },
        uSat: { value: 0.92 },
        uRimColor: { value: new THREE.Color(1.0, 0.72, 0.36) },
      };
      this.addEntry("trichuris", geometry, uniforms, VERTEX_EGG, FRAGMENT_EGG, aspect, undefined, true);
    }

    this.ready = true;
  }

  private addEntry(
    id: OrganismId,
    geometry: THREE.BufferGeometry,
    uniforms: ReliefUniforms,
    vertexShader: string,
    fragmentShader: string,
    aspect: number,
    dome?: OrganismEntry["dome"],
    solid = false,
  ) {
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      premultipliedAlpha: true,
      // Nunca escreve profundidade: um organismo quase transparente não pode recortar o vizinho.
      depthWrite: false,
      depthTest: true,
      side: solid ? THREE.FrontSide : THREE.DoubleSide,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.name = `organism-${id}`;
    mesh.renderOrder = 30 + this.entries.size;
    const pivot = new THREE.Group();
    pivot.add(mesh);
    const root = new THREE.Group();
    root.name = id === "giardia" ? "giardia-duodenalis" : id === "t-cruzi" ? "trypanosoma-cruzi" : "trichuris-trichiura-egg";
    root.add(pivot);
    root.visible = false;
    this.group.add(root);
    this.disposables.push(geometry, material);
    Object.values(uniforms).forEach((uniform) => {
      const value = uniform.value as { isTexture?: boolean; dispose?: () => void };
      if (value?.isTexture && value.dispose) this.disposables.push(value as { dispose: () => void });
    });
    this.entries.set(id, {
      id,
      root,
      pivot,
      mesh,
      material,
      uniforms,
      aspect,
      dome,
      worldWidth: 1,
      presence: 0,
      visible: false,
    });
  }

  /** Algum organismo móvel está suficientemente revelado (condição para o relógio local correr). */
  public isMotileObservable(progress: number, sampleVisible: boolean): boolean {
    if (!this.ready || !sampleVisible) return false;
    return (["giardia", "t-cruzi"] as const).some((id) => motionAmount(id, progress) > 0.04);
  }

  /** O suavizador da inspeção ainda não alcançou o alvo (renderiza até assentar). */
  public isSettling(target: InspectionState): boolean {
    return (
      Math.abs(this.currentYaw - target.yaw) > 0.0015 ||
      Math.abs(this.currentPitch - target.pitch) > 0.0015 ||
      Math.abs(this.currentZoom - target.zoom) > 0.002 ||
      Math.abs(this.inspectMix - (target.active ? 1 : 0)) > 0.002
    );
  }

  /** Avança o suavizador da inspeção (exponencial, independente de quadros: usa `dt`). */
  public stepInspection(target: InspectionState, dt: number) {
    const k = 1 - Math.exp(-dt * 12);
    this.currentYaw += (target.yaw - this.currentYaw) * k;
    this.currentPitch += (target.pitch - this.currentPitch) * k;
    this.currentZoom += (target.zoom - this.currentZoom) * k;
    if (target.active) this.inspectId = target.active;
    const mixTarget = target.active ? 1 : 0;
    this.inspectMix += (mixTarget - this.inspectMix) * k;
    if (Math.abs(mixTarget - this.inspectMix) < 0.002) this.inspectMix = mixTarget;
    if (Math.abs(target.yaw - this.currentYaw) < 0.0004) this.currentYaw = target.yaw;
    if (Math.abs(target.pitch - this.currentPitch) < 0.0004) this.currentPitch = target.pitch;
    if (Math.abs(target.zoom - this.currentZoom) < 0.0008) this.currentZoom = target.zoom;
  }

  public snapInspection(target: InspectionState) {
    this.currentYaw = target.yaw;
    this.currentPitch = target.pitch;
    this.currentZoom = target.zoom;
    if (target.active) this.inspectId = target.active;
    this.inspectMix = target.active ? 1 : 0;
  }

  public update(input: OrganismUpdateInput) {
    if (!this.ready || this.disposed) return;
    const { camera, viewportWidth: width, viewportHeight: height } = input;
    camera.updateMatrixWorld(true);
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const worldHeight = 2 * PLANE_DEPTH * tanHalf;
    const aspect = width / Math.max(1, height);

    this.entries.forEach((entry) => {
      const id = entry.id;
      const { reveal, hub, focus } = organismPresence(id, input.progress);
      const presence = combinedPresence(reveal, hub);
      const visible = input.sampleVisible && presence > 0.002;
      entry.presence = presence;
      entry.visible = visible;
      entry.root.visible = visible;
      if (!visible) return;

      let placement = organismPlacement(id, input.progress, width, height, input.hub?.[id]);
      // Durante a inspeção (e na volta suave) o espécime vai para a área livre ao lado do painel.
      const isActive = id === this.inspectId && (input.inspection.active === id || this.inspectMix > 0.001);
      let zoom = 1;
      if (isActive && reveal > 0) {
        const bounds = inspectionBounds(id, width, height);
        const target = inspectionPlacement(id, input.progress, width, height);
        const m = this.inspectMix;
        placement = {
          ndcX: placement.ndcX + (target.ndcX - placement.ndcX) * m,
          ndcY: placement.ndcY + (target.ndcY - placement.ndcY) * m,
          widthPx: placement.widthPx + (target.widthPx - placement.widthPx) * m,
          roll: placement.roll,
          scale: placement.scale + (target.scale - placement.scale) * m,
        };
        // A aproximação nunca ultrapassa a área livre.
        zoom = Math.max(1, Math.min(this.currentZoom, bounds.maxWidthPx / Math.max(1, placement.widthPx * placement.scale)));
      }
      const lift = input.highlight === id && hub > 0.5 ? 1.14 : 1;
      const widthPx = placement.widthPx * placement.scale * zoom * lift;
      if (widthPx < 8) {
        entry.visible = false;
        entry.root.visible = false;
        return;
      }
      this.widthsPx.set(id, widthPx);
      const worldWidth = (widthPx / height) * worldHeight;
      entry.worldWidth = worldWidth;

      // Composição: ponto no plano de profundidade fixo, voltado para a câmera.
      this.tmp.set(
        placement.ndcX * PLANE_DEPTH * tanHalf * aspect,
        placement.ndcY * PLANE_DEPTH * tanHalf,
        -PLANE_DEPTH,
      );
      camera.localToWorld(this.tmp);
      entry.root.position.copy(this.tmp);
      this.rollQuat.setFromAxisAngle(this.zAxis, placement.roll);
      entry.root.quaternion.copy(camera.quaternion).multiply(this.rollQuat);
      entry.root.scale.setScalar(worldWidth);

      // Pose local (relógio próprio). Na composição final e fora da janela a amplitude é 0.
      const amount = motionAmount(id, input.progress);
      const pose = bodyPoseAt(id, input.motionTime, amount);
      this.lastPoses.set(id, pose);
      const yaw = pose.yaw + (isActive ? this.currentYaw : 0);
      const pitch = isActive ? this.currentPitch : 0;
      entry.pivot.position.set(pose.shift[0], pose.shift[1] * entry.aspect, 0);
      entry.pivot.rotation.set(pitch, yaw, pose.roll, "YXZ");

      // Uniforms.
      const u = entry.uniforms;
      const blur = (1 - focus) * (1 - hub);
      u.uOpacity.value = presence * 0.9;
      u.uBias.value = blur * 4.6;
      if (id !== "trichuris") {
        u.uPhase.value = pose.flagellarPhase;
        u.uAmp.value = pose.amount;
      }
      if (id === "t-cruzi") u.uFlexPhase.value = pose.flexPhase;
    });
  }

  /** Posição projetada de um ponto da imagem (fração x→direita, y→baixo). */
  private project(entry: OrganismEntry, fx: number, fy: number, camera: THREE.PerspectiveCamera, width: number, height: number) {
    let x = fx - 0.5;
    let y = (0.5 - fy) * entry.aspect;
    let z = 0;
    const pose = this.lastPoses.get(entry.id);
    if (entry.id === "giardia") {
      z = -(entry.uniforms.uDome.value as number) * this.sampleDome(entry, fx, fy);
    } else if (entry.id === "t-cruzi") {
      z = (entry.uniforms.uDome.value as number) * this.sampleDome(entry, fx, fy);
      if (pose) {
        // Mesma função do vertex shader: o marcador acompanha a flexão do corpo.
        const p0 = entry.uniforms.uP0.value as THREE.Vector2;
        const dir = entry.uniforms.uDir.value as THREE.Vector2;
        const len = entry.uniforms.uLen.value as number;
        const qx = fx - p0.x;
        const qy = (1 - fy - p0.y) * entry.aspect;
        const u = Math.min(1, Math.max(0, (qx * dir.x + qy * dir.y) / len));
        const flex = trypanosomaFlexOffset(u, pose);
        x += -dir.y * flex;
        y += dir.x * flex;
      }
    }
    this.tmp.set(x, y, z);
    entry.pivot.updateWorldMatrix(true, false);
    this.tmp.applyMatrix4(entry.pivot.matrixWorld);
    this.tmp.project(camera);
    return {
      x: (this.tmp.x * 0.5 + 0.5) * width,
      y: (-this.tmp.y * 0.5 + 0.5) * height,
      inside: this.tmp.z > -1 && this.tmp.z < 1,
    };
  }

  private sampleDome(entry: OrganismEntry, fx: number, fy: number): number {
    const dome = entry.dome;
    if (!dome) return 0;
    const x = Math.min(dome.width - 1, Math.max(0, Math.round(fx * (dome.width - 1))));
    const y = Math.min(dome.height - 1, Math.max(0, Math.round(fy * (dome.height - 1))));
    return dome.data[(y * dome.width + x) * 4 + dome.channel] / 255;
  }

  /** Projeções do centro, do marcador e dos pontos de anotação (px CSS relativos ao canvas). */
  public getScreenStates(camera: THREE.PerspectiveCamera, width: number, height: number): OrganismScreenState[] {
    return ORGANISM_IDS.map((id) => {
      const entry = this.entries.get(id);
      if (!entry || !entry.visible || !this.ready) {
        return { id, visible: false, x: 0, y: 0, widthPx: 0, marker: { x: 0, y: 0 }, labels: [] };
      }
      entry.root.updateMatrixWorld(true);
      const center = this.project(entry, 0.5, 0.5, camera, width, height);
      const marker = this.project(entry, ANCHORS[id].marker[0], ANCHORS[id].marker[1], camera, width, height);
      const labels = ANCHORS[id].labels.map((label) => {
        const point = this.project(entry, label.at[0], label.at[1], camera, width, height);
        return { key: label.key, x: point.x, y: point.y };
      });
      return {
        id,
        visible: center.inside && marker.x > -50 && marker.x < width + 50 && marker.y > -50 && marker.y < height + 50,
        x: center.x,
        y: center.y,
        widthPx: this.widthsPx.get(id) ?? 0,
        marker: { x: marker.x, y: marker.y },
        labels,
      };
    });
  }

  /** Centro do organismo no mundo e tamanho (para ancorar o marcador 3D do hub). */
  public getWorldAnchor(id: OrganismId, target: THREE.Vector3): { widthWorld: number; heightWorld: number } | null {
    const entry = this.entries.get(id);
    if (!entry || !entry.visible) return null;
    entry.root.updateMatrixWorld(true);
    target.setFromMatrixPosition(entry.root.matrixWorld);
    return { widthWorld: entry.worldWidth, heightWorld: entry.worldWidth * entry.aspect };
  }

  public getDiagnostics(): OrganismDiagnostics {
    let triangles = 0;
    const geometries = new Set<THREE.BufferGeometry>();
    const textures = new Set<THREE.Texture>();
    const organisms: OrganismDiagnostics["organisms"] = {};
    this.entries.forEach((entry, id) => {
      const geometry = entry.mesh.geometry;
      geometries.add(geometry);
      const count = geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
      if (entry.visible) triangles += count;
      Object.values(entry.uniforms).forEach((uniform) => {
        const value = uniform.value as { isTexture?: boolean };
        if (value?.isTexture) textures.add(uniform.value as THREE.Texture);
      });
      organisms[id] = {
        visible: entry.visible,
        presence: Number(entry.presence.toFixed(4)),
        // Só organismos visíveis têm pose: o estado de um organismo oculto não pode depender do caminho.
        yaw: entry.visible ? Number(entry.pivot.rotation.y.toFixed(4)) : 0,
        pitch: entry.visible ? Number(entry.pivot.rotation.x.toFixed(4)) : 0,
        widthPx: entry.visible ? Number((this.widthsPx.get(id) ?? 0).toFixed(1)) : 0,
      };
    });
    return { ready: this.ready, triangles, geometries: geometries.size, textures: textures.size, organisms };
  }

  public getPose(id: OrganismId): BodyPose | undefined {
    return this.lastPoses.get(id);
  }

  /** Torna todos os organismos visíveis só para compilar os programas de shader de antemão. */
  public setWarmUp(on: boolean) {
    this.entries.forEach((entry) => {
      entry.root.visible = on || entry.visible;
    });
  }

  public dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.disposables.forEach((item) => item.dispose());
    this.disposables.length = 0;
    this.entries.clear();
    this.group.clear();
  }
}

export { ORGANISM_ASPECT };
