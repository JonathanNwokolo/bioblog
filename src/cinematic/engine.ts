import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  DEFAULT_PATH,
  WORLD_OFFSET as WORLD_OFFSET_AUTHORED,
  buildJourneyPath,
  sampleJourney,
  type JourneyPath,
  type JourneySample,
} from "./choreography";
import { nominalEntry, type OpticalEntry } from "./opticalEntry";
import type { OpticalPhase } from "./opticalTransition";
import {
  createHotspotMarker,
  createMicroscopicDust,
  createMicroscopicWorld,
  getSpecimenWorldWeights,
  updateMicroscopicWorld,
} from "./sceneBuilder";
import { createCompleteMicroscope } from "./microscopeAsset";
import { createOpticsDebugOverlay, type OpticsDebugOverlay } from "./opticsDebug";
import { CINEMATIC_HOTSPOTS, type GraphicsQualityTier } from "./types";
import { OrganismSystem, DEFAULT_INSPECTION, type InspectionState, type OrganismScreenState } from "./organisms";
import { shouldRunMotion, type HubTarget, type OrganismId } from "./organismMotion";

export interface CinematicMetrics {
  renders: number;
  averageRenderCpuMs: number;
  p95RenderCpuMs: number;
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
  pixelRatio: number;
  qualityTier: GraphicsQualityTier;
}

export interface CinematicEngineOptions {
  canvas: HTMLCanvasElement;
  qualityTier: Exclude<GraphicsQualityTier, "fallback">;
  onContextStatus?: (status: "lost" | "restored") => void;
  /** Chamado depois de cada quadro de movimento local (a camada DOM reposiciona marcadores e rótulos). */
  onMotionFrame?: () => void;
}

function summarize(values: number[]): { average: number; p95: number } {
  if (!values.length) return { average: 0, p95: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const average = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  return { average: Number(average.toFixed(2)), p95: Number(p95.toFixed(2)) };
}

export interface HotspotScreenPoint {
  id: string;
  /** px relativos ao canvas */
  x: number;
  y: number;
  visible: boolean;
}

export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

/** Referencial óptico: a objetiva e o mundo vivem aqui; a câmera percorre o eixo. */
const FRAME_POSITION = new THREE.Vector3(2.4, 2.7, 0);
const FRAME_ROTATION = new THREE.Euler(Math.PI / 2, 0, 0);
const WORLD_OFFSET = new THREE.Vector3(...WORLD_OFFSET_AUTHORED);

interface FadeEntry {
  material: THREE.Material;
  baseOpacity: number;
  baseDepthWrite: boolean;
}

/** Estado exposto à depuração/QA: o que a cena realmente desenha neste instante. */
export interface OpticalDiagnostics {
  progress: number;
  phase: OpticalPhase;
  instrumentVisible: boolean;
  worldVisible: boolean;
  backdropExposure: number;
  organisms3d: Record<string, { visible: boolean; scale: number }>;
  hotspotsVisible: string[];
  specimenWorlds: Record<"giardia" | "blood" | "stool", number>;
  specimenDebugHidden: boolean;
}

/** Estado do relógio local dos organismos e do agendador de quadros (QA e interface). */
export interface MotionDiagnostics {
  motionTime: number;
  running: boolean;
  userPaused: boolean;
  reducedMotion: boolean;
  frozen: boolean;
  motionFrames: number;
  sceneRenders: number;
  observable: boolean;
  /** Custo de CPU (submissão) por quadro de movimento; NÃO inclui o tempo de GPU. */
  frameCpuMs: { average: number; p95: number };
  /** Intervalo real entre quadros de movimento consecutivos (ms). */
  frameIntervalMs: { average: number; p95: number };
}

interface LightEntry {
  light: THREE.Light;
  baseIntensity: number;
}

const FOG_OPTICAL = new THREE.Color(0xe8e5dd);
const FOG_BIOLOGICAL = new THREE.Color(0x0a1c1b);
const BG_OPTICAL = new THREE.Color(0xe8e5dd);
const BG_BIOLOGICAL = new THREE.Color(0x061312);

/**
 * Motor de cena guiado por rolagem.
 *
 * Não há laço de animação, relógio nem integração incremental. A única operação
 * que altera a imagem é `renderSceneAt(progress)`, uma função determinística do
 * progresso: chamar com 0,42 produz o mesmo frame venha-se de 0,2 ou de 0,9.
 * Entre chamadas, a GPU permanece ociosa.
 */
export class CinematicEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly qualityTier: Exclude<GraphicsQualityTier, "fallback">;
  private readonly frame = new THREE.Group();
  private readonly objective: THREE.Group;
  private readonly world: THREE.Group;
  /** Campo de observação (micromundo + partículas), alinhado ao eixo óptico da ocular. */
  private readonly observation = new THREE.Group();
  private path: JourneyPath = DEFAULT_PATH;
  private debugOverlay: OpticsDebugOverlay | null = null;
  private debugView: { position: [number, number, number]; target: [number, number, number] } | null = null;
  private readonly dust: THREE.Points;
  private readonly environment: THREE.WebGLRenderTarget;
  private readonly pmrem: THREE.PMREMGenerator;
  private readonly hotspots = new Map<string, THREE.Group>();
  private readonly hotspotMaterials = new Map<string, FadeEntry[]>();
  private readonly worldFade: FadeEntry[] = [];
  private readonly lights: LightEntry[] = [];
  private readonly renderCosts: number[] = [];
  private readonly scratch = new THREE.Vector3();
  private readonly scratchTarget = new THREE.Vector3();
  private readonly onContextStatus?: (status: "lost" | "restored") => void;
  private readonly baseFov: number;
  private highlightedId: string | null = null;
  private lastProgress = 0;
  private lastSample: JourneySample | null = null;
  private renderCount = 0;
  private readonly organisms: OrganismSystem;
  private readonly onMotionFrame?: () => void;
  private readonly organismWorldPoint = new THREE.Vector3();
  private readonly hubMarkerPoint = new THREE.Vector3();
  private inspection: InspectionState = { ...DEFAULT_INSPECTION };
  private hubTargets: Partial<Record<OrganismId, HubTarget>> = {};
  /** Relógio local dos organismos (s). Só avança enquanto o laço de movimento corre. */
  private motionTime = 0;
  private motionFrameCount = 0;
  private readonly motionCosts: number[] = [];
  private readonly motionIntervals: number[] = [];
  private motionRaf = 0;
  private motionLast = 0;
  private motionUserPaused = false;
  private motionReduced = false;
  private motionFrozen = false;
  private motionStateObservable = false;
  private contextLost = false;
  private specimenDebugHidden = false;
  private readonly boundOnVisibility: () => void;
  private pixelRatioCap: number;
  private disposed = false;

  private readonly boundOnContextLost: (event: Event) => void;
  private readonly boundOnContextRestored: () => void;

  constructor(options: CinematicEngineOptions) {
    this.canvas = options.canvas;
    this.qualityTier = options.qualityTier;
    this.onContextStatus = options.onContextStatus;
    this.onMotionFrame = options.onMotionFrame;
    this.organisms = new OrganismSystem(options.qualityTier);

    this.pixelRatioCap =
      this.qualityTier === "high" ? 1.75 : this.qualityTier === "medium" ? 1.35 : 1;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: false,
      antialias: this.qualityTier !== "low",
      powerPreference: "high-performance",
      stencil: false,
    });
    this.applyPixelRatio();
    this.renderer.setSize(this.canvas.clientWidth || 800, this.canvas.clientHeight || 600, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = this.qualityTier !== "low";
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene.background = BG_OPTICAL.clone();
    this.scene.fog = new THREE.FogExp2(FOG_OPTICAL.getHex(), 0.028);

    // Ambiente de estúdio procedural: reflexos reais nos metais e no vidro (sem HDRI externo).
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.environment = this.pmrem.fromScene(room, 0.04);
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = 0.7;
    room.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      materials.forEach((material) => material.dispose());
    });

    const aspect = this.canvas.clientWidth / (this.canvas.clientHeight || 1);
    this.baseFov = 39;
    this.camera = new THREE.PerspectiveCamera(this.baseFov, aspect || 1.6, 0.08, 70);

    this.frame.name = "optical-frame";
    this.frame.position.copy(FRAME_POSITION);
    this.frame.rotation.copy(FRAME_ROTATION);
    this.scene.add(this.frame);

    const buildTier = this.qualityTier;
    this.objective = createCompleteMicroscope(buildTier);
    this.frame.add(this.objective);

    // A trajetória deriva da ocular real: mede centro e normal do vidro nos transforms efetivos.
    this.frame.updateMatrixWorld(true);
    this.path = buildJourneyPath(this.measureEntry());
    this.observation.name = "observation-frame";
    this.observation.position.set(...this.path.observation.position);
    this.observation.quaternion.set(...this.path.observation.quaternion);
    this.frame.add(this.observation);

    this.world = createMicroscopicWorld(buildTier);
    this.world.position.copy(WORLD_OFFSET);
    this.world.visible = false;
    this.observation.add(this.world);
    this.world.traverse((object) => {
      // O plano de fundo do campo tem controle próprio (exposição), não participa do fade da formação.
      if (object.userData.noFade) return;
      const renderable = object as THREE.Mesh;
      const materials = Array.isArray(renderable.material)
        ? renderable.material
        : renderable.material
          ? [renderable.material]
          : [];
      materials.forEach((material) => {
        if (this.worldFade.some((entry) => entry.material === material)) return;
        this.worldFade.push({
          material,
          baseOpacity: material.opacity,
          baseDepthWrite: material.depthWrite,
        });
        material.transparent = true;
        material.opacity = 0;
      });
    });

    const dustCount = this.qualityTier === "high" ? 520 : this.qualityTier === "medium" ? 360 : 220;
    this.dust = createMicroscopicDust(dustCount);
    this.dust.visible = false;
    this.observation.add(this.dust);
    this.worldFade.push({
      material: this.dust.material as THREE.Material,
      baseOpacity: (this.dust.material as THREE.Material).opacity,
      baseDepthWrite: false,
    });
    (this.dust.material as THREE.Material).opacity = 0;

    this.setupLighting();
    this.setupHotspots();
    this.scene.add(this.organisms.group);

    this.boundOnContextLost = (event) => {
      event.preventDefault();
      this.contextLost = true;
      this.syncMotionLoop();
      this.onContextStatus?.("lost");
    };
    this.boundOnContextRestored = () => {
      this.contextLost = false;
      this.onContextStatus?.("restored");
      this.renderSceneAt(this.lastProgress);
    };
    this.boundOnVisibility = () => this.syncMotionLoop();
    document.addEventListener("visibilitychange", this.boundOnVisibility);
    this.canvas.addEventListener("webglcontextlost", this.boundOnContextLost);
    this.canvas.addEventListener("webglcontextrestored", this.boundOnContextRestored);

    this.frame.updateMatrixWorld(true);
    this.renderSceneAt(0);
  }

  /**
   * Centro e normal externa do vidro da ocular escolhida, medidos nos transforms
   * efetivos da malha (`matrixWorld`) e expressos no referencial do microscópio.
   */
  private measureEntry(): OpticalEntry {
    const nominal = nominalEntry();
    const glass = this.objective
      .getObjectByName(`eyepiece-${nominal.eyepiece}`)
      ?.getObjectByName("ocular-glass");
    if (!glass) return nominal;
    glass.updateWorldMatrix(true, false);
    const toFrame = this.frame.matrixWorld.clone().invert().multiply(glass.matrixWorld);
    const center = new THREE.Vector3(0, 0, 0).applyMatrix4(toFrame);
    const normal = new THREE.Vector3(0, 0, 1).transformDirection(toFrame);
    return { eyepiece: nominal.eyepiece, center: center.toArray(), normal: normal.toArray() };
  }

  /** Entrada óptica medida e trajetória derivada dela (QA espacial). */
  public getOpticalPath() {
    return this.path;
  }

  /** Depuração espacial: nunca é ativada na experiência pública. */
  public enableOpticsDebug() {
    if (this.debugOverlay || process.env.NODE_ENV === "production") return;
    this.debugOverlay = createOpticsDebugOverlay(this.path);
    this.frame.add(this.debugOverlay.group);
    this.renderSceneAt(this.lastProgress);
  }

  /** Vista de inspeção externa (QA espacial). Só funciona com a depuração habilitada. */
  public setDebugView(view: { position: [number, number, number]; target: [number, number, number] } | null) {
    this.debugView = this.debugOverlay ? view : null;
    this.renderSceneAt(this.lastProgress);
  }

  /**
   * Interseção de cada passo da câmera com a malha do instrumento (segmentos entre amostras
   * consecutivas). Ignora o vidro, que é a abertura atravessada de propósito.
   */
  public auditCameraCollisions(from = 0.2, to = 0.56, steps = 240) {
    this.frame.updateMatrixWorld(true);
    const meshes: THREE.Object3D[] = [];
    this.objective.traverse((object) => {
      if ((object as THREE.Mesh).isMesh && object.name !== "ocular-glass" && object.name !== "studio-shadow-plane") {
        meshes.push(object);
      }
    });
    const raycaster = new THREE.Raycaster();
    const hits: Array<{ progress: number; object: string; distance: number }> = [];
    const point = (p: number) => {
      const sample = sampleJourney(p, this.path);
      return new THREE.Vector3(...sample.camera).applyMatrix4(this.frame.matrixWorld);
    };
    const materials = meshes.map((mesh) => (mesh as THREE.Mesh).material as THREE.Material);
    const sides = materials.map((material) => material.side);
    materials.forEach((material) => { material.side = THREE.DoubleSide; });
    let previous = point(from);
    for (let i = 1; i <= steps; i += 1) {
      const p = from + ((to - from) * i) / steps;
      const next = point(p);
      const direction = next.clone().sub(previous);
      const length = direction.length();
      if (length > 1e-6) {
        raycaster.set(previous, direction.normalize());
        raycaster.far = length;
        raycaster.near = 0;
        raycaster.intersectObjects(meshes, false).forEach((hit) => {
          hits.push({ progress: Number(p.toFixed(4)), object: hit.object.name || hit.object.parent?.name || hit.object.type, distance: Number(hit.distance.toFixed(3)) });
        });
      }
      previous = next;
    }
    materials.forEach((material, index) => { material.side = sides[index]; });
    return hits;
  }

  /** Inventário espacial das peças relevantes (coordenadas no referencial do microscópio). */
  public describeOptics() {
    this.frame.updateMatrixWorld(true);
    const inverse = this.frame.matrixWorld.clone().invert();
    const parts: Record<string, { center: number[]; size: number[] }> = {};
    const names = [
      "eyepiece-left", "eyepiece-right", "binocular-head", "prism-housing", "objective-turret",
      "selected-objective-100x", "mechanical-stage-left", "mechanical-stage-right", "weighted-base",
    ];
    names.forEach((name) => {
      const object = this.objective.getObjectByName(name);
      if (!object) return;
      const box = new THREE.Box3().setFromObject(object).applyMatrix4(inverse);
      parts[name] = { center: box.getCenter(new THREE.Vector3()).toArray(), size: box.getSize(new THREE.Vector3()).toArray() };
    });
    const nominal = nominalEntry();
    return { entry: this.path.entry, nominal, parts, observation: this.path.observation, waypoints: this.path.waypoints };
  }

  private setupLighting() {
    const register = <T extends THREE.Light>(light: T) => {
      this.lights.push({ light, baseIntensity: light.intensity });
      return light;
    };
    this.scene.add(register(new THREE.AmbientLight(0xd8d9d3, 1.08)));
    this.scene.add(register(new THREE.HemisphereLight(0xffffff, 0x56605d, 1.25)));
    const key = register(new THREE.SpotLight(0xfff7e8, 105, 34, Math.PI / 6, 0.5, 1.2));
    key.position.set(-6.5, 11.2, 8.5);
    key.target.position.set(1.3, 0, 0);
    key.castShadow = this.qualityTier !== "low";
    key.shadow.mapSize.set(this.qualityTier === "high" ? 2048 : 1024, this.qualityTier === "high" ? 2048 : 1024);
    key.shadow.bias = -0.0002;
    this.scene.add(key, key.target);

    const rim = register(new THREE.SpotLight(0xcfc3dd, 48, 28, Math.PI / 5, 0.72, 1.35));
    rim.position.set(7.2, 4.8, -6.8);
    rim.target.position.set(1.6, 0, 0);
    this.scene.add(rim, rim.target);

    // Luzes do micromundo vivem no referencial do mundo.
    const bioKey = new THREE.PointLight(0x7fc5af, 18, 15, 1.6);
    bioKey.position.set(-2.6, 2.4, 2.6);
    const bioFill = new THREE.PointLight(0xb49ac6, 13, 13, 1.8);
    bioFill.position.set(3.2, -1.4, 4.2);
    this.world.add(bioKey, bioFill);
  }

  private setupHotspots() {
    CINEMATIC_HOTSPOTS.forEach((spot) => {
      const marker = createHotspotMarker(spot.id);
      marker.position.set(spot.position[0], spot.position[1], spot.position[2]);
      marker.visible = false;
      this.hotspots.set(spot.id, marker);
      this.world.add(marker);
      const entries: FadeEntry[] = [];
      marker.traverse((object) => {
        const mesh = object as THREE.Mesh;
        const material = mesh.material as THREE.Material | undefined;
        if (!material) return;
        entries.push({ material, baseOpacity: material.opacity, baseDepthWrite: false });
        material.opacity = 0;
      });
      this.hotspotMaterials.set(spot.id, entries);
    });
  }

  private applyPixelRatio() {
    const ratio = Math.min(window.devicePixelRatio || 1, this.pixelRatioCap);
    this.renderer.setPixelRatio(ratio);
  }

  /** Reduz a resolução interna quando a rolagem não acompanha a taxa de quadros. */
  public setPixelRatioCap(cap: number) {
    const next = Math.max(0.75, Math.min(cap, 2));
    if (next === this.pixelRatioCap) return;
    this.pixelRatioCap = next;
    this.applyPixelRatio();
    this.resize();
  }

  public getPixelRatioCap() {
    return this.pixelRatioCap;
  }

  /** Destaque de UI (hover/foco de um link). Não participa da coreografia. */
  public setHighlight(id: string | null) {
    if (this.highlightedId === id) return;
    this.highlightedId = id;
    this.renderSceneAt(this.lastProgress);
  }

  /**
   * Estado COMPLETO da cena como função pura do progresso.
   * Câmera, FOV, mundo, partículas, luzes, névoa, exposição e marcadores.
   */
  public renderSceneAt(progressInput: number) {
    if (this.disposed) return;
    const started = performance.now();
    const sample = sampleJourney(progressInput, this.path);
    this.lastProgress = sample.progress;
    this.lastSample = sample;
    this.applySample(sample);
    this.renderer.render(this.scene, this.camera);
    this.renderCount += 1;
    this.renderCosts.push(performance.now() - started);
    if (this.renderCosts.length > 240) this.renderCosts.shift();
    this.syncMotionLoop();
  }

  // ------------------------------------------------------------------ organismos e movimento local

  /** Carrega texturas e malhas dos organismos (a visibilidade segue o progresso, não a carga). */
  public async loadOrganisms() {
    await this.organisms.load(Math.min(8, this.renderer.capabilities.getMaxAnisotropy()));
    if (!this.disposed) this.renderSceneAt(this.lastProgress);
  }

  /** Seleciona e rotaciona o organismo inspecionado; renderiza até a suavização assentar. */
  public setInspection(next: Partial<InspectionState>) {
    this.inspection = { ...this.inspection, ...next };
    if (this.motionReduced) this.organisms.snapInspection(this.inspection);
    this.renderOrganismFrame();
    this.syncMotionLoop();
  }

  public getInspection(): InspectionState {
    return { ...this.inspection };
  }

  /** Depuração local `?debug=specimen`: oculta os protagonistas, não o ambiente. */
  public setSpecimenDebugHidden(hidden: boolean) {
    if (process.env.NODE_ENV === "production") return;
    this.specimenDebugHidden = hidden;
    this.renderSceneAt(this.lastProgress);
  }

  /** Alvos medidos na camada DOM (lista de descoberta) para a composição final. */
  public setHubTargets(targets: Partial<Record<OrganismId, HubTarget>>) {
    this.hubTargets = targets;
  }

  /** Pausa do visitante: a pose congela e o laço de quadros contínuos para. */
  public setMotionPaused(paused: boolean) {
    if (this.motionUserPaused === paused) return;
    this.motionUserPaused = paused;
    this.syncMotionLoop();
  }

  public setReducedMotion(reduced: boolean) {
    if (this.motionReduced === reduced) return;
    this.motionReduced = reduced;
    this.syncMotionLoop();
  }

  /**
   * QA: congela o relógio local numa fase fixa (para comparar pixels). Passar `null` libera.
   * Enquanto congelado o laço contínuo não corre, e o quadro é função de (progresso, fase).
   */
  public freezeMotionAt(time: number | null) {
    if (time === null) {
      this.motionFrozen = false;
    } else {
      this.motionFrozen = true;
      this.motionTime = time;
    }
    this.renderOrganismFrame();
    this.syncMotionLoop();
  }

  public getMotionDiagnostics(): MotionDiagnostics {
    return {
      motionTime: Number(this.motionTime.toFixed(4)),
      running: this.motionRaf !== 0,
      userPaused: this.motionUserPaused,
      reducedMotion: this.motionReduced,
      frozen: this.motionFrozen,
      motionFrames: this.motionFrameCount,
      sceneRenders: this.renderCount,
      observable: this.motionStateObservable,
      frameCpuMs: summarize(this.motionCosts),
      frameIntervalMs: summarize(this.motionIntervals),
    };
  }

  public getOrganismDiagnostics() {
    return this.organisms.getDiagnostics();
  }

  /** Projeções (px relativos ao canvas) para marcadores, rótulos e QA. */
  public getOrganismScreenStates(): OrganismScreenState[] {
    return this.organisms.getScreenStates(this.camera, this.canvas.clientWidth, this.canvas.clientHeight);
  }

  private updateOrganisms() {
    const sample = this.lastSample;
    if (!sample) return;
    const highlightMap: Record<string, OrganismId> = {
      "hotspot-atlas": "giardia",
      "hotspot-laboratorio": "t-cruzi",
      "hotspot-onde-vivem": "trichuris",
    };
    this.organisms.update({
      highlight: this.highlightedId ? (highlightMap[this.highlightedId] ?? null) : null,
      progress: sample.progress,
      sampleVisible: sample.optics.sampleVisible,
      camera: this.camera,
      viewportWidth: this.canvas.clientWidth || 1,
      viewportHeight: this.canvas.clientHeight || 1,
      motionTime: this.motionTime,
      inspection: this.inspection,
      hub: this.hubTargets,
    });
    this.organisms.group.visible = !this.specimenDebugHidden;
    // Anéis do hub acompanham os organismos (a linha-guia sai do próprio espécime).
    const mapping: Array<[string, OrganismId]> = [
      ["hotspot-atlas", "giardia"],
      ["hotspot-laboratorio", "t-cruzi"],
      ["hotspot-onde-vivem", "trichuris"],
    ];
    mapping.forEach(([hotspotId, organismId]) => {
      const marker = this.hotspots.get(hotspotId);
      if (!marker || !marker.visible) return;
      const size = this.organisms.getWorldAnchor(organismId, this.organismWorldPoint);
      if (!size) {
        marker.visible = false;
        return;
      }
      this.world.updateMatrixWorld(true);
      this.hubMarkerPoint.copy(this.organismWorldPoint);
      this.world.worldToLocal(this.hubMarkerPoint);
      marker.position.copy(this.hubMarkerPoint);
      marker.scale.setScalar(Math.max(0.05, Math.max(size.widthWorld, size.heightWorld)));
    });
  }

  /** Reaplica só os organismos e redesenha (sem recalcular câmera nem mundo). */
  private renderOrganismFrame() {
    if (this.disposed || !this.lastSample) return;
    const started = performance.now();
    this.updateOrganisms();
    this.renderer.render(this.scene, this.camera);
    this.motionFrameCount += 1;
    this.motionCosts.push(performance.now() - started);
    if (this.motionCosts.length > 240) this.motionCosts.shift();
    this.onMotionFrame?.();
  }

  private computeObservable() {
    const sample = this.lastSample;
    return Boolean(sample && this.organisms.isMotileObservable(sample.progress, sample.optics.sampleVisible));
  }

  /**
   * Agendador: renderização contínua SOMENTE com motilidade visível e ativa, ou enquanto a
   * inspeção assenta. Fora disso, nenhum `requestAnimationFrame` fica pendente.
   */
  private syncMotionLoop() {
    this.motionStateObservable = this.computeObservable();
    const settling = this.organisms.isReady() && this.organisms.isSettling(this.inspection);
    const run = shouldRunMotion({
      organismObservable: this.motionStateObservable && !this.motionFrozen,
      userPaused: this.motionUserPaused,
      reducedMotion: this.motionReduced,
      documentHidden: typeof document !== "undefined" && document.visibilityState === "hidden",
      interacting: settling,
      disposed: this.disposed,
      contextLost: this.contextLost,
    });
    if (run) {
      if (!this.motionRaf) this.motionRaf = requestAnimationFrame(this.tickMotion);
    } else {
      if (this.motionRaf) cancelAnimationFrame(this.motionRaf);
      this.motionRaf = 0;
      // Ao retomar, o primeiro quadro não pode somar o tempo em que o laço esteve parado.
      this.motionLast = 0;
    }
  }

  private readonly tickMotion = (now: number) => {
    this.motionRaf = 0;
    if (this.disposed) return;
    // ~30 quadros/s bastam para um movimento discreto e reduzem custo de CPU/GPU.
    if (this.motionLast && now - this.motionLast < 30) {
      this.motionRaf = requestAnimationFrame(this.tickMotion);
      return;
    }
    const dt = this.motionLast ? Math.min(0.05, Math.max(0, (now - this.motionLast) / 1000)) : 0;
    if (this.motionLast) {
      this.motionIntervals.push(now - this.motionLast);
      if (this.motionIntervals.length > 240) this.motionIntervals.shift();
    }
    this.motionLast = now;
    if (this.organisms.isSettling(this.inspection)) this.organisms.stepInspection(this.inspection, dt || 1 / 60);
    const animate = this.computeObservable() && !this.motionUserPaused && !this.motionReduced && !this.motionFrozen;
    if (animate) this.motionTime += dt;
    this.renderOrganismFrame();
    this.syncMotionLoop();
  };

  private applySample(sample: JourneySample) {
    // Câmera: referencial óptico → mundo.
    this.frame.updateMatrixWorld(true);
    this.scratch.set(sample.camera[0], sample.camera[1], sample.camera[2]).applyMatrix4(this.frame.matrixWorld);
    this.scratchTarget.set(sample.target[0], sample.target[1], sample.target[2]).applyMatrix4(this.frame.matrixWorld);
    if (this.debugView) {
      this.scratch.set(...this.debugView.position).applyMatrix4(this.frame.matrixWorld);
      this.scratchTarget.set(...this.debugView.target).applyMatrix4(this.frame.matrixWorld);
    }
    this.camera.position.copy(this.scratch);
    this.camera.up.set(...sample.up).normalize().applyQuaternion(this.frame.quaternion);
    this.camera.lookAt(this.scratchTarget);
    if (sample.roll !== 0) this.camera.rotateZ(sample.roll);
    if (this.camera.fov !== sample.fov) {
      this.camera.fov = sample.fov;
      this.camera.updateProjectionMatrix();
    }

    // Contrato de visibilidade por fase (ver opticalTransition.ts): o instrumento e a cena da
    // amostra NUNCA são desenhados juntos; a troca ocorre no corte, com o campo totalmente
    // luminoso. Não há fade de materiais do instrumento (transparências acumuladas = cinza lavado).
    const optics = sample.optics;
    this.objective.visible = optics.instrumentVisible;
    const detail = optics.detail;
    const worldVisible = optics.sampleVisible;
    this.world.visible = worldVisible;
    this.dust.visible = worldVisible && detail > 0.002;
    // O estado da amostra é recalculado a cada quadro, inclusive enquanto ela está oculta:
    // assim ele é função pura do progresso, e não do caminho percorrido até ali.
    this.worldFade.forEach((entry) => {
      entry.material.opacity = entry.baseOpacity * detail;
      entry.material.depthWrite = entry.baseDepthWrite && detail > 0.995;
    });
    updateMicroscopicWorld(this.world, sample.progress, detail, optics.exposure);
    // Parallax das partículas ligado ao progresso (determinístico).
    this.dust.position.z = -(sample.progress - 0.7) * 1.1;
    this.dust.rotation.z = Math.sin(sample.progress * 5.2) * 0.02;

    // Atmosfera: estúdio claro até o corte; depois, o meio biológico escuro (sem mistura intermediária).
    const fog = this.scene.fog as THREE.FogExp2;
    const studio = optics.instrumentVisible;
    fog.color.copy(studio ? FOG_OPTICAL : FOG_BIOLOGICAL);
    fog.density = studio ? 0.028 : 0.034;
    (this.scene.background as THREE.Color).copy(studio ? BG_OPTICAL : BG_BIOLOGICAL);
    this.scene.environmentIntensity = studio ? 0.92 : 0.44;
    this.renderer.toneMappingExposure = studio ? 1.12 : 1.1;

    this.lights.forEach(({ light, baseIntensity }) => {
      light.intensity = baseIntensity * sample.instrumentLight;
    });

    // Destinos: marcadores aparecem na revelação final e voltam a sumir no scroll reverso.
    const discovery = sample.discoveryReveal;
    this.hotspots.forEach((marker, id) => {
      marker.visible = discovery > 0.002;
      if (!marker.visible) return;
      const highlighted = this.highlightedId === id;
      const boost = highlighted ? 1.45 : 1;
      marker.scale.setScalar(highlighted ? 1.3 : 1);
      marker.lookAt(this.camera.position);
      this.hotspotMaterials.get(id)?.forEach((entry) => {
        entry.material.opacity = Math.min(1, entry.baseOpacity * discovery * boost);
      });
    });
    this.world.updateMatrixWorld(true);
    this.updateOrganisms();
    this.debugOverlay?.update(sample);
  }

  /** O que a cena desenha neste instante (QA de reversibilidade e de contrato de visibilidade). */
  public getOpticalDiagnostics(): OpticalDiagnostics {
    const optics = sampleJourney(this.lastProgress, this.path).optics;
    const names: Record<string, string> = {
      giardia: "giardia-duodenalis",
      "t-cruzi": "trypanosoma-cruzi",
      trichuris: "trichuris-trichiura-egg",
    };
    const organisms3d: OpticalDiagnostics["organisms3d"] = {};
    Object.entries(names).forEach(([id, name]) => {
      const object = this.organisms.group.getObjectByName(name);
      organisms3d[id] = {
        visible: Boolean(object?.visible && this.world.visible),
        scale: Number((object?.scale.x ?? 0).toFixed(4)),
      };
    });
    return {
      progress: this.lastProgress,
      phase: optics.phase,
      instrumentVisible: this.objective.visible,
      worldVisible: this.world.visible,
      backdropExposure: Number(optics.exposure.toFixed(4)),
      organisms3d,
      hotspotsVisible: [...this.hotspots.entries()].filter(([, marker]) => marker.visible).map(([id]) => id),
      specimenWorlds: getSpecimenWorldWeights(this.world),
      specimenDebugHidden: this.specimenDebugHidden,
    };
  }

  /** Posições dos marcadores na tela, para ancorar linhas-guia aos links HTML. */
  public getHotspotScreenPoints(): HotspotScreenPoint[] {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    const point = new THREE.Vector3();
    return CINEMATIC_HOTSPOTS.map((spot) => {
      const marker = this.hotspots.get(spot.id);
      if (!marker || !marker.visible) return { id: spot.id, x: 0, y: 0, visible: false };
      marker.getWorldPosition(point).project(this.camera);
      return {
        id: spot.id,
        x: (point.x * 0.5 + 0.5) * width,
        y: (-point.y * 0.5 + 0.5) * height,
        visible: point.z > -1 && point.z < 1 && Math.abs(point.x) < 1.2 && Math.abs(point.y) < 1.2,
      };
    });
  }

  /**
   * Compila de antemão todos os programas de shader (mundo, partículas e marcadores),
   * para que revelar o micromundo durante a rolagem não gere engasgos de compilação.
   * Usa compilação paralela assíncrona quando o navegador oferece.
   */
  public async warmUp() {
    if (this.disposed) return;
    try {
      await this.loadOrganisms();
    } catch (error) {
      // Sem os ativos dos organismos a jornada continua (campo e instrumento); o erro é registrado.
      console.warn("Os organismos não puderam ser carregados.", error);
    }
    if (this.disposed) return;
    const worldVisible = this.world.visible;
    const dustVisible = this.dust.visible;
    this.organisms.setWarmUp(true);
    const markerVisibility = new Map<string, boolean>();
    this.world.visible = true;
    this.dust.visible = true;
    this.hotspots.forEach((marker, id) => {
      markerVisibility.set(id, marker.visible);
      marker.visible = true;
    });
    try {
      await this.renderer.compileAsync(this.scene, this.camera);
    } finally {
      if (!this.disposed) {
        this.organisms.setWarmUp(false);
        this.world.visible = worldVisible;
        this.dust.visible = dustVisible;
        this.hotspots.forEach((marker, id) => {
          marker.visible = markerVisibility.get(id) ?? false;
        });
        this.renderSceneAt(this.lastProgress);
      }
    }
  }

  public getProgress() {
    return this.lastProgress;
  }

  public getRenderCount() {
    return this.renderCount;
  }

  /** Pose atual da câmera no referencial do mundo (verificação numérica de determinismo). */
  public getPose(): CameraPose {
    const target = this.scratchTarget;
    return {
      position: this.camera.position.toArray() as [number, number, number],
      target: target.toArray() as [number, number, number],
      fov: this.camera.fov,
    };
  }

  public getMetrics(): CinematicMetrics {
    const sorted = [...this.renderCosts].sort((a, b) => a - b);
    const average = sorted.length ? sorted.reduce((sum, value) => sum + value, 0) / sorted.length : 0;
    const p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : 0;
    return {
      renders: this.renderCount,
      averageRenderCpuMs: Number(average.toFixed(2)),
      p95RenderCpuMs: Number(p95.toFixed(2)),
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      pixelRatio: this.renderer.getPixelRatio(),
      qualityTier: this.qualityTier,
    };
  }

  /** Recalcula o tamanho do canvas e redesenha o MESMO progresso. */
  public resize() {
    if (this.disposed) return;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (!width || !height) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.renderSceneAt(this.lastProgress);
  }

  public dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.motionRaf) cancelAnimationFrame(this.motionRaf);
    this.motionRaf = 0;
    document.removeEventListener("visibilitychange", this.boundOnVisibility);
    this.organisms.dispose();
    this.canvas.removeEventListener("webglcontextlost", this.boundOnContextLost);
    this.canvas.removeEventListener("webglcontextrestored", this.boundOnContextRestored);
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    this.scene.traverse((object) => {
      const renderable = object as THREE.Mesh;
      if (renderable.geometry) geometries.add(renderable.geometry);
      const renderMaterials = Array.isArray(renderable.material)
        ? renderable.material
        : renderable.material
          ? [renderable.material]
          : [];
      renderMaterials.forEach((material) => {
        materials.add(material);
        Object.values(material).forEach((value) => {
          if (value instanceof THREE.Texture) textures.add(value);
        });
      });
    });
    textures.forEach((texture) => texture.dispose());
    materials.forEach((material) => material.dispose());
    geometries.forEach((geometry) => geometry.dispose());
    this.environment.dispose();
    this.pmrem.dispose();
    this.scene.environment = null;
    this.renderer.dispose();
    // Libera o contexto WebGL imediatamente (o navegador limita contextos simultâneos).
    this.renderer.forceContextLoss();
  }
}
