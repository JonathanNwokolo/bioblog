"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { CinematicEngine } from "@/cinematic/engine";
import {
  BEAT_VISIBILITY,
  JOURNEY_STAGES,
  JOURNEY_TRACK_VH,
  PROGRESS_EPSILON,
  adjacentStageStart,
  computeScrollProgress,
  scrollOffsetForProgress,
  smoothstep,
  stageIndexAt,
} from "@/cinematic/scrollProgress";
import {
  FIELD_STOP_RADIUS,
  HOTSPOT_MIN_REVEAL,
  organismReveal,
  sampleOptics,
} from "@/cinematic/opticalTransition";
import { INSPECTION_LIMITS } from "@/cinematic/organisms";
import { ORGANISM_ASPECT, type HubTarget } from "@/cinematic/organismMotion";
import {
  PREPARATION_CONTEXTS,
  type SpecimenWorldId,
} from "@/cinematic/specimenTimeline";
import {
  CINEMATIC_HOTSPOTS,
  ORGANISM_ANNOTATIONS,
  ORGANISM_MOTION_NOTES,
  PARASITE_OBSERVATIONS,
  type GraphicsQualityTier,
  type ParasiteObservationId,
} from "@/cinematic/types";
import styles from "./explorar.module.css";

type EngineTier = Exclude<GraphicsQualityTier, "fallback">;

interface DebugHandle {
  getProgress: () => number;
  getStageId: () => string;
  getRenderCount: () => number;
  getPose: () => ReturnType<CinematicEngine["getPose"]>;
  getMetrics: () => ReturnType<CinematicEngine["getMetrics"]>;
  /** Estado óptico (fase, visibilidade do instrumento/amostra, organismos) para QA. */
  getOptical: () => ReturnType<typeof sampleOptics> &
    ReturnType<CinematicEngine["getOpticalDiagnostics"]> & {
      reveals: Record<string, number>;
      hotspots: Record<string, boolean>;
    };
  /** Movimento local dos organismos (QA): relógio próprio, separado do progresso narrativo. */
  motion: {
    diagnostics: () => ReturnType<CinematicEngine["getMotionDiagnostics"]>;
    freezeAt: (time: number | null) => void;
    pause: () => void;
    resume: () => void;
  };
  organisms: () => ReturnType<CinematicEngine["getOrganismDiagnostics"]>;
  screen: () => ReturnType<CinematicEngine["getOrganismScreenStates"]>;
  inspect: (state: { active?: ParasiteObservationId | null; yaw?: number; pitch?: number; zoom?: number }) => void;
  /** Somente desenvolvimento, com `?debug=optics`. */
  optics?: {
    describe: () => ReturnType<CinematicEngine["describeOptics"]>;
    audit: (from?: number, to?: number) => ReturnType<CinematicEngine["auditCameraCollisions"]>;
    setView: CinematicEngine["setDebugView"];
  };
}

declare global {
  interface Window {
    __MICROCOSMOS_CINEMATIC__?: DebugHandle;
  }
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const HUB_ORGANISM_BY_HOTSPOT: Record<string, ParasiteObservationId> = {
  "hotspot-atlas": "giardia",
  "hotspot-laboratorio": "t-cruzi",
  "hotspot-onde-vivem": "trichuris",
};
const ROTATION_STEP = 0.26;
const ZOOM_STEP = 0.15;
const clampTo = (value: number, [min, max]: readonly [number, number]) => Math.min(max, Math.max(min, value));
const WORLD_BY_STAGE: Partial<Record<(typeof JOURNEY_STAGES)[number]["id"], SpecimenWorldId>> = {
  giardia: "giardia",
  "t-cruzi": "blood",
  trichuris: "stool",
};

function subscribeReducedMotion(onChange: () => void) {
  const media = window.matchMedia(REDUCED_MOTION_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

const getReducedMotion = () => window.matchMedia(REDUCED_MOTION_QUERY).matches;
const getServerReducedMotion = () => false;

/** Nível gráfico inicial. `?quality=high|medium|low` força o nível e desliga a adaptação. */
function detectQualityTier(): { tier: EngineTier; forced: boolean } {
  const forced = new URLSearchParams(window.location.search).get("quality");
  if (forced === "high" || forced === "medium" || forced === "low") return { tier: forced, forced: true };
  const nav = navigator as Navigator & { deviceMemory?: number; hardwareConcurrency?: number };
  if ((nav.deviceMemory && nav.deviceMemory < 4) || (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4)) {
    return { tier: "low", forced: false };
  }
  if ((nav.deviceMemory && nav.deviceMemory < 8) || (nav.hardwareConcurrency && nav.hardwareConcurrency <= 8)) {
    return { tier: "medium", forced: false };
  }
  return { tier: "high", forced: false };
}

interface DiscoveryPathsProps {
  compact?: boolean;
  onHighlight?: (id: string | null) => void;
  onFocusLink?: () => void;
}

function DiscoveryPaths({ compact = false, onHighlight, onFocusLink }: DiscoveryPathsProps) {
  return (
    <ol className={styles.discoveryPaths} aria-label="Destinos científicos">
      {CINEMATIC_HOTSPOTS.map((hotspot, index) => (
        <li key={hotspot.id} className={styles.discoveryPath}>
          <Link
            href={hotspot.targetRoute}
            className={styles.pathLink}
            data-hotspot-id={hotspot.id}
            onMouseEnter={() => onHighlight?.(hotspot.id)}
            onMouseLeave={() => onHighlight?.(null)}
            onFocus={() => {
              onFocusLink?.();
              onHighlight?.(hotspot.id);
            }}
            onBlur={() => onHighlight?.(null)}
          >
            <span className={styles.pathIndex} aria-hidden="true" data-leader-anchor>
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className={styles.pathCopy}>
              <span className={styles.pathCategory}>{hotspot.category}</span>
              <strong className={styles.pathTitle}>{hotspot.title}</strong>
              {!compact && <span className={styles.pathSubtitle}>{hotspot.subtitle}</span>}
              <span className={styles.pathProvenance}>{hotspot.badge}</span>
            </span>
            <span className={styles.pathArrow} aria-hidden="true">↗</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

function StaticView({
  reducedMotion,
  failed,
  onResume,
}: {
  reducedMotion: boolean;
  failed: boolean;
  onResume: () => void;
}) {
  return (
    <div className={styles.staticView} data-static-view>
      <header className={styles.topBar}>
        <Link href="/" className={styles.brandLink}>
          <span className={styles.brandLabel}>Microcosmos</span>
          <span className={styles.signature}>Além das Lentes</span>
        </Link>
        <div className={styles.navControls}>
          <span className={styles.techPill}>
            {reducedMotion ? "Movimento reduzido" : failed ? "Modo estático" : "Sem movimento"}
          </span>
          {!reducedMotion && !failed && (
            <button type="button" className={styles.controlButton} onClick={onResume}>
              Ativar travessia
            </button>
          )}
          <Link href="/" className={styles.exitButton}>Voltar ao site</Link>
        </div>
      </header>

      <div className={styles.staticBody}>
        <div className={styles.staticMicroscope} aria-hidden="true" />
        <div className={styles.discoveryIntro}>
          <span className={styles.sectionMarker}>Além das lentes</span>
          <h1 className={styles.discoveryTitle}>Observe sem movimento.</h1>
          <p className={styles.discoveryLead}>
            O microscópio e a travessia visual são interpretações artísticas. Os
            destinos ao lado continuam acessíveis sem depender de WebGL ou animação.
          </p>
          <ol className={styles.staticMovements} aria-label="Preparações microscópicas ilustradas">
            {(Object.entries(PREPARATION_CONTEXTS) as Array<[SpecimenWorldId, (typeof PREPARATION_CONTEXTS)[SpecimenWorldId]]>).map(([id, context]) => (
              <li key={id}>
                <strong>{context.title}</strong>
                {context.note}
              </li>
            ))}
          </ol>
          <p className={styles.artisticNote}>Morfologia parasitológica editorial · não diagnóstica</p>
        </div>
        <DiscoveryPaths />
      </div>
    </div>
  );
}

export function CinematicExperience() {
  const trackRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const invitationRef = useRef<HTMLDivElement | null>(null);
  const hintRef = useRef<HTMLParagraphElement | null>(null);
  const discoveryRef = useRef<HTMLDivElement | null>(null);
  const leadersRef = useRef<SVGSVGElement | null>(null);
  const progressFillRef = useRef<HTMLSpanElement | null>(null);
  const progressTrackRef = useRef<HTMLDivElement | null>(null);
  const parasiteLayerRef = useRef<HTMLDivElement | null>(null);
  const panelCloseRef = useRef<HTMLButtonElement | null>(null);
  const observationPanelRef = useRef<HTMLElement | null>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const motionDockRef = useRef<HTMLDivElement | null>(null);
  const annotationLayerRef = useRef<HTMLDivElement | null>(null);
  const specimenHandleRef = useRef<HTMLDivElement | null>(null);
  const pausedBeforePanelRef = useRef(false);
  const motionPausedRef = useRef(false);
  const dragRef = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);
  const activeIdRef = useRef<ParasiteObservationId | null>(null);
  const annotationsOnRef = useRef(true);
  const panelProgressRef = useRef<number | null>(null);
  const restoreProgressRef = useRef<number | null>(null);
  const engineRef = useRef<CinematicEngine | null>(null);
  const progressRef = useRef(0);
  const tierRef = useRef<EngineTier>("high");

  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, getServerReducedMotion);
  const [engineFailed, setEngineFailed] = useState(false);
  const [userStatic, setUserStatic] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [tierLabel, setTierLabel] = useState<EngineTier | null>(null);
  const [activeObservationId, setActiveObservationId] = useState<ParasiteObservationId | null>(null);
  const [motionPaused, setMotionPaused] = useState(false);
  const [annotationsOn, setAnnotationsOn] = useState(true);
  const [motionToggled, setMotionToggled] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  const activeObservation = useMemo(
    () => PARASITE_OBSERVATIONS.find((entry) => entry.id === activeObservationId) ?? null,
    [activeObservationId],
  );

  const mode: "journey" | "static" = reducedMotion || engineFailed || userStatic ? "static" : "journey";

  useEffect(() => {
    motionPausedRef.current = motionPaused;
    engineRef.current?.setMotionPaused(motionPaused);
  }, [motionPaused]);

  useEffect(() => {
    activeIdRef.current = activeObservationId;
    annotationsOnRef.current = annotationsOn;
    window.dispatchEvent(new Event("resize"));
  }, [activeObservationId, annotationsOn]);

  const scrollToProgress = useCallback((progress: number) => {
    const track = trackRef.current;
    const stage = stageRef.current;
    if (!track || !stage) return;
    const top = scrollOffsetForProgress(
      {
        trackDocumentTop: track.getBoundingClientRect().top + window.scrollY,
        trackHeight: track.offsetHeight,
        viewportHeight: stage.clientHeight,
      },
      progress,
    );
    // Altera a posição real de rolagem; o progresso continua derivado dela.
    window.scrollTo({ top, behavior: "auto" });
  }, []);

  useEffect(() => {
    if (mode !== "journey") return;
    const track = trackRef.current;
    const stage = stageRef.current;
    const host = canvasHostRef.current;
    if (!track || !stage || !host) return;

    let cancelled = false;
    let rafId = 0;
    let lastPainted = -1;
    let paintedStage = -1;
    let lastFrameAt = 0;
    let contextTimer: ReturnType<typeof setTimeout> | undefined;
    const intervals: number[] = [];
    const quality = detectQualityTier();
    const specimenDebug =
      process.env.NODE_ENV !== "production" &&
      new URLSearchParams(window.location.search).get("debug") === "specimen";
    tierRef.current = quality.tier;

    // O canvas é criado por sessão: um contexto perdido/liberado não pode ser reutilizado.
    const canvas = document.createElement("canvas");
    canvas.className = styles.canvas;
    host.appendChild(canvas);

    const readProgress = () =>
      computeScrollProgress({
        trackTop: track.getBoundingClientRect().top,
        trackHeight: track.offsetHeight,
        viewportHeight: stage.clientHeight,
      });

    const paintLeaders = (discovery: number) => {
      const svg = leadersRef.current;
      const engine = engineRef.current;
      if (!svg) return;
      svg.style.opacity = String(discovery);
      if (!engine || discovery < 0.02 || window.innerWidth <= 980) return;
      const stageRect = stage.getBoundingClientRect();
      const points = engine.getHotspotScreenPoints();
      const organismStates = new Map(
        engine.getOrganismScreenStates().map((state) => {
          const hotspotId = Object.entries(HUB_ORGANISM_BY_HOTSPOT).find(([, organism]) => organism === state.id)?.[0] ?? state.id;
          return [hotspotId, state] as const;
        }),
      );
      points.forEach((point) => {
        const path = svg.querySelector<SVGPathElement>(`[data-leader-for="${point.id}"]`);
        const anchor = discoveryRef.current?.querySelector<HTMLElement>(
          `[data-hotspot-id="${point.id}"] [data-leader-anchor]`,
        );
        if (!path || !anchor || !point.visible) {
          path?.setAttribute("d", "");
          return;
        }
        const rect = anchor.getBoundingClientRect();
        const ax = rect.left - stageRect.left - 10;
        const ay = rect.top - stageRect.top + rect.height / 2;
        // A linha parte da borda direita do espécime (não atravessa a anatomia).
        const organism = organismStates.get(point.id);
        const startX = point.x + (organism ? organism.widthPx * 0.5 + 8 : 0);
        const elbow = startX + (ax - startX) * 0.55;
        path.setAttribute("d", `M${startX.toFixed(1)} ${point.y.toFixed(1)} L${elbow.toFixed(1)} ${ay.toFixed(1)} L${ax.toFixed(1)} ${ay.toFixed(1)}`);
      });
    };

    /**
     * Passagem óptica (Fase 2.3.8): limitador de campo (o exterior do instrumento escurece até a
     * ocular), campo luminoso que cobre o corte entre as cenas, vinheta e foco. Tudo é função
     * pura do progresso (`sampleOptics`); nada aqui anima por tempo.
     */
    const paintOptics = (progress: number) => {
      const optics = sampleOptics(progress);
      const width = stage.clientWidth || 1;
      const height = stage.clientHeight || 1;
      const hold = FIELD_STOP_RADIUS * Math.min(width, height);
      const far = 0.5 * Math.hypot(width, height) + 48;
      const radius = hold + (far - hold) * optics.fieldStop;
      const feather = Math.max(1.5, radius * (0.01 + 0.22 * optics.fieldStop * optics.fieldStop));
      const style = stage.style;
      style.setProperty("--optic-hold", `${hold.toFixed(1)}px`);
      style.setProperty("--optic-r", `${radius.toFixed(1)}px`);
      style.setProperty("--optic-f", `${feather.toFixed(1)}px`);
      style.setProperty("--optic-iris", optics.fieldStop >= 0.999 ? "0" : "1");
      // O campo luminoso nasce como um núcleo brilhante que cresce dentro da lente escurecida
      // (a luz entra pela ocular) e termina cobrindo todo o limitador de campo.
      // Opacidade: a lente escurece quase de imediato (sem estado intermediário acinzentado);
      // depois o campo inteiro se apaga, sem o núcleo encolher sobre o campo já formado.
      const dim = smoothstep(0.47, 0.505, progress) * (1 - smoothstep(0.58, 0.63, progress));
      style.setProperty("--optic-glow", dim.toFixed(3));
      style.setProperty("--optic-g", `${(hold * (0.2 + 0.95 * optics.glowCore)).toFixed(1)}px`);
      style.setProperty("--optic-wash", (1 - smoothstep(0.4, 0.5, progress)).toFixed(3));
      style.setProperty("--optic-field-vignette", smoothstep(0.58, 0.68, progress).toFixed(3));
      const blur = optics.blurPx * Math.min(1, width / 1440);
      host.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : "";
      stage.dataset.optical = optics.phase;
    };

    const paintHud = (progress: number) => {
      if (progressFillRef.current) progressFillRef.current.style.transform = `scaleX(${progress.toFixed(4)})`;
      progressTrackRef.current?.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
      const invitation = invitationRef.current;
      if (invitation) invitation.style.opacity = BEAT_VISIBILITY.invitation(progress).toFixed(3);
      const hint = hintRef.current;
      if (hint) hint.style.opacity = BEAT_VISIBILITY.scrollHint(progress).toFixed(3);
      const discovery = discoveryRef.current;
      const reveal = BEAT_VISIBILITY.discovery(progress);
      if (discovery) {
        discovery.style.opacity = reveal.toFixed(3);
        discovery.dataset.active = reveal > 0.55 ? "true" : "false";
      }
      paintLeaders(reveal);
      const index = stageIndexAt(progress);
      if (index !== paintedStage) {
        paintedStage = index;
        setStageIndex(index);
      }
    };

    const adapt = (now: number) => {
      if (quality.forced) return;
      if (lastFrameAt && now - lastFrameAt < 140) {
        intervals.push(now - lastFrameAt);
        if (intervals.length >= 30) {
          const average = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
          intervals.length = 0;
          const engine = engineRef.current;
          if (engine && average > 48) {
            const cap = engine.getPixelRatioCap();
            if (cap > 1) engine.setPixelRatioCap(1);
            else if (average > 80 && cap > 0.8) engine.setPixelRatioCap(0.8);
          }
        }
      }
      lastFrameAt = now;
    };

    /**
     * Alvos dos organismos na composição final: cada espécime fica ao lado da própria linha da
     * lista de descoberta (desktop) ou em uma faixa acima do texto (mobile). Medido no DOM.
     */
    const measureHubTargets = () => {
      const engine = engineRef.current;
      const root = discoveryRef.current;
      if (!engine || !root) return;
      const stageRect = stage.getBoundingClientRect();
      const width = stage.clientWidth;
      const height = stage.clientHeight;
      const intro = root.querySelector<HTMLElement>("[data-discovery-intro]");
      const introRect = intro?.getBoundingClientRect();
      const targets: Partial<Record<ParasiteObservationId, HubTarget>> = {};
      const sizes: Record<ParasiteObservationId, number> = { giardia: 0.1, "t-cruzi": 0.15, trichuris: 0.11 };
      if (width > 980) {
        const introRight = introRect ? introRect.right - stageRect.left : width * 0.34;
        Object.entries(HUB_ORGANISM_BY_HOTSPOT).forEach(([hotspotId, organismId]) => {
          const anchor = root.querySelector<HTMLElement>(`[data-hotspot-id="${hotspotId}"] [data-leader-anchor]`);
          if (!anchor) return;
          const rect = anchor.getBoundingClientRect();
          const left = rect.left - stageRect.left;
          const available = Math.max(70, left - 28 - (introRight + 20));
          const size = Math.max(70, Math.min(width * sizes[organismId], available));
          targets[organismId] = {
            x: left - 28 - size / 2,
            y: rect.top - stageRect.top + rect.height / 2,
            widthPx: size,
          };
        });
      } else {
        const top = 74;
        const bottom = introRect ? introRect.top - stageRect.top - 18 : height * 0.4;
        const band = bottom - top;
        const y = top + band / 2;
        (["giardia", "t-cruzi", "trichuris"] as const).forEach((organismId, index) => {
          const maxByHeight = (band * 0.9) / ORGANISM_ASPECT[organismId];
          // Em telas muito curtas não há faixa livre: o espécime decorativo some em vez de cobrir o texto.
          targets[organismId] = {
            x: width * (0.2 + index * 0.3),
            y,
            widthPx: band < 64 ? 0 : Math.min(width * (organismId === "t-cruzi" ? 0.36 : 0.26), maxByHeight),
          };
        });
      }
      engine.setHubTargets(targets);
    };

    const paintParasiteMarkers = (progress: number) => {
      const layer = parasiteLayerRef.current;
      const engine = engineRef.current;
      if (!layer || !engine) return;
      const states = new Map(engine.getOrganismScreenStates().map((state) => [state.id, state]));
      const inspecting = activeIdRef.current;
      let motileVisible = 0;
      PARASITE_OBSERVATIONS.forEach((observation) => {
        const button = layer.querySelector<HTMLButtonElement>(`[data-parasite-id="${observation.id}"]`);
        const state = states.get(observation.id);
        if (!button || !state) return;
        // O marcador só é visível e acionável quando o organismo está suficientemente revelado.
        const reveal = specimenDebug ? 0 : organismReveal(observation.id, progress);
        if (observation.id !== "trichuris" && state.visible && reveal > motileVisible) motileVisible = reveal;
        const visible = state.visible && reveal >= HOTSPOT_MIN_REVEAL && panelProgressRef.current === null;
        button.dataset.visible = visible ? "true" : "false";
        button.tabIndex = visible ? 0 : -1;
        button.style.left = `${state.marker.x.toFixed(1)}px`;
        button.style.top = `${state.marker.y.toFixed(1)}px`;
      });

      const dock = motionDockRef.current;
      if (dock) {
        const show = motileVisible >= 0.35 && panelProgressRef.current === null;
        dock.dataset.visible = show ? "true" : "false";
        dock.toggleAttribute("inert", !show);
      }

      // Anotações científicas (inspeção): seguem os pontos do próprio organismo.
      const annotationLayer = annotationLayerRef.current;
      if (annotationLayer) {
        const state = inspecting ? states.get(inspecting) : undefined;
        const show = Boolean(state?.visible && annotationsOnRef.current);
        annotationLayer.dataset.visible = show ? "true" : "false";
        if (state && show) {
          const stageWidth = stage.clientWidth;
          state.labels.forEach((label) => {
            const element = annotationLayer.querySelector<HTMLElement>(`[data-annotation="${label.key}"]`);
            if (!element) return;
            element.style.left = `${label.x.toFixed(1)}px`;
            element.style.top = `${label.y.toFixed(1)}px`;
            // O rótulo nunca sai do palco: inverte o lado e, se ainda não couber, desloca só o texto.
            const reach = element.offsetWidth + 6;
            let side: "left" | "right" = label.x >= state.x ? "right" : "left";
            if (side === "right" && label.x + reach > stageWidth - 8) side = "left";
            if (side === "left" && label.x - reach < 8) side = "right";
            let shift = 0;
            if (side === "right" && label.x + reach > stageWidth - 8) shift = stageWidth - 8 - (label.x + reach);
            if (side === "left" && label.x - reach < 8) shift = 8 - (label.x - reach);
            element.dataset.side = side;
            element.style.setProperty("--label-shift", `${shift.toFixed(1)}px`);
          });
        }
      }

      // Alça de arraste (somente com o painel aberto): cobre o espécime.
      const handle = specimenHandleRef.current;
      if (handle && inspecting) {
        const state = states.get(inspecting);
        if (state?.visible) {
          const w = Math.max(60, state.widthPx);
          const h = Math.max(60, w * ORGANISM_ASPECT[inspecting] * 1.05);
          handle.style.left = `${(state.x - w / 2).toFixed(1)}px`;
          handle.style.top = `${(state.y - h / 2).toFixed(1)}px`;
          handle.style.width = `${w.toFixed(1)}px`;
          handle.style.height = `${h.toFixed(1)}px`;
        }
      }
    };

    const paint = (force: boolean, now = performance.now()) => {
      rafId = 0;
      const progress = panelProgressRef.current ?? readProgress();
      if (!force && Math.abs(progress - lastPainted) < PROGRESS_EPSILON) return;
      lastPainted = progress;
      progressRef.current = progress;
      if (progress >= 0.92) measureHubTargets();
      engineRef.current?.renderSceneAt(progress);
      paintOptics(progress);
      paintHud(progress);
      paintParasiteMarkers(progress);
      adapt(now);
    };

    // Um único RAF por quadro agrupa qualquer quantidade de eventos de rolagem.
    const schedule = () => {
      if (rafId || cancelled) return;
      rafId = requestAnimationFrame((now) => paint(false, now));
    };

    const onResize = () => {
      engineRef.current?.resize();
      lastPainted = -1;
      schedule();
    };

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("pageshow", schedule);
    const observer = new ResizeObserver(onResize);
    observer.observe(stage);

    (async () => {
      try {
        const { CinematicEngine: Engine } = await import("@/cinematic/engine");
        if (cancelled) return;
        const engine = new Engine({
          canvas,
          qualityTier: quality.tier,
          onMotionFrame: () => paintParasiteMarkers(progressRef.current),
          onContextStatus: (status) => {
            if (status === "lost") {
              contextTimer = setTimeout(() => setEngineFailed(true), 4000);
            } else if (contextTimer) {
              clearTimeout(contextTimer);
              contextTimer = undefined;
            }
          },
        });
        engineRef.current = engine;
        engine.setSpecimenDebugHidden(specimenDebug);
        engine.setMotionPaused(motionPausedRef.current);
        setTierLabel(quality.tier);
        // Compila todos os shaders antes de a rolagem revelar o micromundo.
        await engine.warmUp();
        if (cancelled) return;
        window.__MICROCOSMOS_CINEMATIC__ = {
          getProgress: () => progressRef.current,
          getStageId: () => JOURNEY_STAGES[stageIndexAt(progressRef.current)].id,
          getRenderCount: () => engine.getRenderCount(),
          getPose: () => engine.getPose(),
          getMetrics: () => engine.getMetrics(),
          getOptical: () => {
            const progress = progressRef.current;
            const reveals: Record<string, number> = {};
            const hotspots: Record<string, boolean> = {};
            PARASITE_OBSERVATIONS.forEach((observation) => {
              const reveal = organismReveal(observation.id, progress);
              reveals[observation.id] = Number(reveal.toFixed(4));
              hotspots[observation.id] = reveal >= HOTSPOT_MIN_REVEAL;
            });
            return { ...sampleOptics(progress), ...engine.getOpticalDiagnostics(), reveals, hotspots };
          },
          motion: {
            diagnostics: () => engine.getMotionDiagnostics(),
            freezeAt: (time) => engine.freezeMotionAt(time),
            pause: () => setMotionPaused(true),
            resume: () => setMotionPaused(false),
          },
          organisms: () => engine.getOrganismDiagnostics(),
          screen: () => engine.getOrganismScreenStates(),
          inspect: (state) => {
            engine.setInspection({
              active: state.active === undefined ? engine.getInspection().active : state.active,
              ...(state.yaw !== undefined ? { yaw: state.yaw } : {}),
              ...(state.pitch !== undefined ? { pitch: state.pitch } : {}),
              ...(state.zoom !== undefined ? { zoom: state.zoom } : {}),
            });
          },
        };
        if (
          process.env.NODE_ENV !== "production" &&
          new URLSearchParams(window.location.search).get("debug") === "optics"
        ) {
          engine.enableOpticsDebug();
          window.__MICROCOSMOS_CINEMATIC__.optics = {
            describe: () => engine.describeOptics(),
            audit: (from, to) => engine.auditCameraCollisions(from, to),
            setView: (view) => engine.setDebugView(view),
          };
        }
        // Recupera a posição (back/forward, recarga) a partir da rolagem real.
        lastPainted = -1;
        paint(true);
      } catch (error) {
        console.warn("A renderização WebGL falhou; exibindo a versão estática.", error);
        if (!cancelled) setEngineFailed(true);
      }
    })();

    // Reavalia a posição inicial mesmo antes de o motor carregar (HUD correto).
    paint(true);

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (contextTimer) clearTimeout(contextTimer);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pageshow", schedule);
      observer.disconnect();
      engineRef.current?.dispose();
      engineRef.current = null;
      canvas.remove();
      delete window.__MICROCOSMOS_CINEMATIC__;
    };
  }, [mode]);

  const handleHighlight = useCallback((id: string | null) => {
    engineRef.current?.setHighlight(id);
  }, []);

  const preserveHotspotFocusPosition = useCallback(() => {
    // Elementos dentro de um ancestral sticky podem fazer o navegador tentar
    // revelar sua posição no fluxo ao receber foco pelo teclado.
    scrollToProgress(progressRef.current);
  }, [scrollToProgress]);

  const openObservation = useCallback((id: ParasiteObservationId, trigger: HTMLButtonElement) => {
    lastTriggerRef.current = trigger;
    panelProgressRef.current = progressRef.current;
    // Leitura calma: o movimento local pausa ao abrir a anotação e volta ao estado anterior ao fechar.
    pausedBeforePanelRef.current = motionPausedRef.current;
    setMotionPaused(true);
    setAnnotationsOn(true);
    setZoomLevel(1);
    engineRef.current?.setInspection({ active: id, yaw: 0, pitch: 0, zoom: 1 });
    setActiveObservationId(id);
  }, []);

  const rotateSpecimen = useCallback((deltaYaw: number, deltaPitch: number) => {
    const engine = engineRef.current;
    if (!engine) return;
    const current = engine.getInspection();
    engine.setInspection({
      yaw: clampTo(current.yaw + deltaYaw, INSPECTION_LIMITS.yaw),
      pitch: clampTo(current.pitch + deltaPitch, INSPECTION_LIMITS.pitch),
    });
  }, []);

  const resetSpecimen = useCallback(() => {
    setZoomLevel(1);
    engineRef.current?.setInspection({ yaw: 0, pitch: 0, zoom: 1 });
  }, []);

  const changeZoom = useCallback((delta: number) => {
    const engine = engineRef.current;
    if (!engine) return;
    const next = clampTo(engine.getInspection().zoom + delta, INSPECTION_LIMITS.zoom);
    setZoomLevel(next);
    engine.setInspection({ zoom: next });
  }, []);

  const toggleMotion = useCallback(() => {
    setMotionToggled(true);
    setMotionPaused((paused) => !paused);
  }, []);

  // Anúncio para leitores de tela somente quando o visitante alterna o movimento.
  const announcement = !motionToggled
    ? ""
    : motionPaused
      ? "Movimento dos organismos pausado."
      : "Movimento dos organismos em exibição.";

  const handleSpecimenPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const engine = engineRef.current;
    if (!engine) return;
    const current = engine.getInspection();
    dragRef.current = { x: event.clientX, y: event.clientY, yaw: current.yaw, pitch: current.pitch };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const handleSpecimenPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const engine = engineRef.current;
    if (!drag || !engine) return;
    engine.setInspection({
      yaw: clampTo(drag.yaw + (event.clientX - drag.x) * 0.009, INSPECTION_LIMITS.yaw),
      pitch: clampTo(drag.pitch + (event.clientY - drag.y) * 0.007, INSPECTION_LIMITS.pitch),
    });
  }, []);

  const handleSpecimenPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  const closeObservation = useCallback(() => {
    const savedProgress = panelProgressRef.current;
    restoreProgressRef.current = savedProgress;
    panelProgressRef.current = null;
    setMotionPaused(pausedBeforePanelRef.current);
    engineRef.current?.setInspection({ active: null, yaw: 0, pitch: 0, zoom: 1 });
    setActiveObservationId(null);
  }, []);

  useLayoutEffect(() => {
    if (activeObservation) return;
    const savedProgress = restoreProgressRef.current;
    if (savedProgress === null) return;
    restoreProgressRef.current = null;
    // Restaura antes do próximo paint: remover o diálogo não pode deslocar o capítulo.
    scrollToProgress(savedProgress);
    lastTriggerRef.current?.focus({ preventScroll: true });
    scrollToProgress(savedProgress);
    requestAnimationFrame(() => {
      scrollToProgress(savedProgress);
      requestAnimationFrame(() => scrollToProgress(savedProgress));
    });
  }, [activeObservation, scrollToProgress]);

  useEffect(() => {
    if (!activeObservation) return;
    panelCloseRef.current?.focus({ preventScroll: true });
    const preventJourneyScroll = (event: WheelEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || !observationPanelRef.current?.contains(target)) {
        event.preventDefault();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeObservation();
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        rotateSpecimen(event.key === "ArrowLeft" ? -ROTATION_STEP : ROTATION_STEP, 0);
      }
      if (["PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown", " "].includes(event.key)) {
        const target = event.target;
        if (!(target instanceof Node) || !observationPanelRef.current?.contains(target)) event.preventDefault();
      }
      if (event.key === "Tab") {
        const focusable = observationPanelRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("wheel", preventJourneyScroll, { passive: false });
    window.addEventListener("touchmove", preventJourneyScroll, { passive: false });
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("wheel", preventJourneyScroll);
      window.removeEventListener("touchmove", preventJourneyScroll);
    };
  }, [activeObservation, closeObservation, rotateSpecimen]);


  /** Foco por teclado em um destino ainda não revelado: leva a rolagem à descoberta. */
  const handleFocusLink = useCallback(() => {
    if (progressRef.current < 0.92) scrollToProgress(0.97);
  }, [scrollToProgress]);

  const current = JOURNEY_STAGES[stageIndex];
  const stageNumber = String(stageIndex + 1).padStart(2, "0");
  const preparationId = WORLD_BY_STAGE[current.id];
  const preparation = preparationId ? PREPARATION_CONTEXTS[preparationId] : null;

  return (
    <div className={styles.root} data-mode={mode} data-stage={current.id} data-panel-open={activeObservation ? "true" : "false"}>
      <noscript>
        <style>{`[data-explorar-journey]{display:none!important}[data-static-view]{display:block!important}`}</style>
      </noscript>

      <StaticView reducedMotion={reducedMotion} failed={engineFailed} onResume={() => setUserStatic(false)} />

      <section
        ref={trackRef}
        className={styles.journey}
        style={{ height: `${JOURNEY_TRACK_VH}vh` }}
        aria-label="Travessia óptica guiada pela rolagem"
        data-explorar-journey
      >
        <div ref={stageRef} className={styles.stage}>
          <div className={styles.canvasWrapper} aria-hidden="true">
            <div ref={canvasHostRef} className={styles.canvas} />
            <div className={styles.opticalVignette} />
            <div className={styles.fieldVignette} />
            <div className={styles.opticalGlow} />
            <div className={styles.opticalIris} />
            <div className={styles.filmGrain} />
          </div>

          <header className={styles.topBar}>
            <Link href="/" className={styles.brandLink}>
              <span className={styles.brandLabel}>Microcosmos</span>
              <span className={styles.signature}>Além das Lentes</span>
            </Link>
            <div className={styles.navControls}>
              {tierLabel && (
                <span className={styles.techPill}>
                  <span className={styles.statusDot} aria-hidden="true" />
                  Gráficos: {tierLabel === "high" ? "alta" : tierLabel === "medium" ? "média" : "baixa"}
                </span>
              )}
              <button
                type="button"
                className={styles.controlButton}
                aria-label="Ativar a versão sem movimento"
                onClick={() => setUserStatic(true)}
              >
                <span className={styles.longLabel}>Versão sem movimento</span>
                <span className={styles.shortLabel} aria-hidden="true">Sem movimento</span>
              </button>
              <Link href="/" className={styles.exitButton} aria-label="Sair da experiência e voltar para a página inicial">
                Voltar ao site
              </Link>
            </div>
          </header>

          <div ref={invitationRef} className={styles.invitation}>
            <div className={styles.invitationCopy}>
              <span className={styles.sectionMarker}>Uma travessia guiada pela rolagem</span>
              <h1 className={styles.heroTitle}>O instrumento abre outra escala.</h1>
              <p className={styles.heroLead}>
                Role a página para aproximar a câmera, entrar pela ocular e chegar ao
                micromundo. Role de volta e a cena retrocede.
              </p>
              <div className={styles.heroMetadata} aria-label="Detalhes da experiência">
                <span>Controlada pela rolagem</span>
                <span>Sem som</span>
                <span>Reversível</span>
              </div>
            </div>
            <p className={styles.instrumentCaption}>
              <span>OCULAR SELECIONADA</span>
              Caminho óptico · interpretação tridimensional
            </p>
          </div>

          <p ref={hintRef} className={styles.scrollHint}>Role para explorar</p>

          <div className={styles.specimenContext} data-visible={preparation ? "true" : "false"} aria-live="polite">
            {preparation && (
              <>
                <span>{preparation.eyebrow}</span>
                <strong>{preparation.title}</strong>
                <p>{preparation.note}</p>
              </>
            )}
          </div>

          <div ref={parasiteLayerRef} className={styles.parasiteMarkers} aria-label="Anotações dos organismos">
            {PARASITE_OBSERVATIONS.map((observation) => (
              <button
                key={observation.id}
                type="button"
                className={styles.parasiteMarker}
                data-parasite-id={observation.id}
                data-visible="false"
                tabIndex={-1}
                aria-label={`Abrir anotação de ${observation.scientificName}, ${observation.stage}`}
                onFocus={preserveHotspotFocusPosition}
                onClick={(event) => openObservation(observation.id, event.currentTarget)}
              >
                <span aria-hidden="true">+</span>
              </button>
            ))}
          </div>

          <div
            ref={motionDockRef}
            className={styles.motionDock}
            data-visible="false"
            role="group"
            aria-label="Movimento dos organismos"
          >
            <button
              type="button"
              className={styles.motionButton}
              aria-pressed={motionPaused}
              onClick={toggleMotion}
            >
              <span className={styles.motionGlyph} data-state={motionPaused ? "play" : "pause"} aria-hidden="true" />
              {motionPaused ? "Retomar movimento" : "Pausar movimento"}
            </button>
          </div>

          <div
            ref={annotationLayerRef}
            className={styles.annotationLayer}
            data-visible="false"
            aria-hidden="true"
          >
            {activeObservation &&
              ORGANISM_ANNOTATIONS[activeObservation.id].map((annotation) => (
                <span key={annotation.key} className={styles.annotation} data-annotation={annotation.key} data-side="right">
                  <i className={styles.annotationDot} />
                  <span className={styles.annotationText}>{annotation.label}</span>
                </span>
              ))}
          </div>

          {activeObservation && (
            <div
              ref={specimenHandleRef}
              className={styles.specimenHandle}
              aria-hidden="true"
              onPointerDown={handleSpecimenPointerDown}
              onPointerMove={handleSpecimenPointerMove}
              onPointerUp={handleSpecimenPointerUp}
              onPointerCancel={handleSpecimenPointerUp}
            />
          )}

          {activeObservation && (
            <aside
              ref={observationPanelRef}
              className={styles.observationPanel}
              role="dialog"
              aria-modal="true"
              aria-labelledby="observation-title"
              aria-describedby="observation-description"
            >
              <div className={styles.panelHeader}>
                <p className={styles.panelKicker}>Anotação morfológica</p>
                <button
                  ref={panelCloseRef}
                  type="button"
                  className={styles.panelClose}
                  onClick={closeObservation}
                  aria-label="Fechar anotação e retomar a exploração"
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
              <div className={styles.panelScroll}>
                <p className={styles.panelStage}>{activeObservation.stage}</p>
                <h2 id="observation-title" className={styles.panelTitle}>
                  <i>{activeObservation.scientificName}</i>
                </h2>
                <p id="observation-description" className={styles.panelDescription}>
                  {activeObservation.shortDescription}
                </p>
                <h3 className={styles.panelSubheading}>O que reconhecer</h3>
                <ul className={styles.morphologyList}>
                  {activeObservation.morphology.map((feature) => <li key={feature}>{feature}</li>)}
                </ul>
                <h3 className={styles.panelSubheading}>Observar organismo</h3>
                <div className={styles.inspectControls} role="group" aria-label="Controles de inspeção do espécime">
                  {activeObservation.id !== "trichuris" && (
                    <button
                      type="button"
                      className={styles.inspectButton}
                      aria-pressed={motionPaused}
                      onClick={toggleMotion}
                    >
                      {motionPaused ? "Retomar movimento" : "Pausar movimento"}
                    </button>
                  )}
                  <div className={styles.rotatePad} role="group" aria-label="Girar o espécime">
                    <button type="button" className={styles.inspectButton} onClick={() => rotateSpecimen(-ROTATION_STEP, 0)} aria-label="Girar para a esquerda">←</button>
                    <button type="button" className={styles.inspectButton} onClick={() => rotateSpecimen(0, -ROTATION_STEP)} aria-label="Inclinar para cima">↑</button>
                    <button type="button" className={styles.inspectButton} onClick={() => rotateSpecimen(0, ROTATION_STEP)} aria-label="Inclinar para baixo">↓</button>
                    <button type="button" className={styles.inspectButton} onClick={() => rotateSpecimen(ROTATION_STEP, 0)} aria-label="Girar para a direita">→</button>
                  </div>
                  <div className={styles.zoomPad} role="group" aria-label="Aproximação">
                    <button type="button" className={styles.inspectButton} onClick={() => changeZoom(-ZOOM_STEP)} disabled={zoomLevel <= INSPECTION_LIMITS.zoom[0] + 0.001} aria-label="Reduzir aproximação">−</button>
                    <button type="button" className={styles.inspectButton} onClick={() => changeZoom(ZOOM_STEP)} disabled={zoomLevel >= INSPECTION_LIMITS.zoom[1] - 0.001} aria-label="Aumentar aproximação">+</button>
                  </div>
                  <button type="button" className={styles.inspectButton} onClick={resetSpecimen}>Restaurar orientação</button>
                  <button
                    type="button"
                    className={styles.inspectButton}
                    aria-pressed={annotationsOn}
                    onClick={() => setAnnotationsOn((on) => !on)}
                  >
                    {annotationsOn ? "Ocultar anotações" : "Mostrar anotações"}
                  </button>
                </div>
                <p className={styles.panelHint}>
                  Arraste o espécime ou use as setas ← → do teclado para girar. A rolagem da jornada fica
                  parada enquanto a anotação está aberta.
                </p>
                <p className={styles.panelMotionNote}>{ORGANISM_MOTION_NOTES[activeObservation.id]}</p>
                <p className={styles.panelCaveat}>
                  Reconstrução educacional artística, não diagnóstica e pendente de revisão especializada.
                </p>
                <div className={styles.panelLinks}>
                  <a href={activeObservation.sourceUrl} target="_blank" rel="noopener noreferrer">
                    {activeObservation.sourceLabel} <span aria-hidden="true">↗</span>
                  </a>
                  <Link href={activeObservation.relatedRoute}>{activeObservation.relatedLabel}</Link>
                </div>
              </div>
            </aside>
          )}

          <p className={styles.caption}>
            <span>{current.subtitle}</span>
          </p>

          <div ref={discoveryRef} className={styles.discoveryOverlay} data-active="false">
            <div className={styles.discoveryIntro} data-discovery-intro>
              <span className={styles.sectionMarker}>Campo de descoberta</span>
              <h2 className={styles.discoveryTitle}>O invisível agora tem caminhos.</h2>
              <p className={styles.discoveryLead}>
                Escolha a pergunta que deseja investigar. Cada caminho permanece
                acessível em HTML e leva a dados com proveniência explícita.
              </p>
              <p className={styles.artisticNote}>Giardia, T. cruzi e ovo de Trichuris · interpretação morfológica não diagnóstica</p>
            </div>
            <DiscoveryPaths onHighlight={handleHighlight} onFocusLink={handleFocusLink} />
          </div>

          <svg ref={leadersRef} className={styles.leaders} aria-hidden="true" focusable="false">
            {CINEMATIC_HOTSPOTS.map((hotspot) => (
              <path key={hotspot.id} data-leader-for={hotspot.id} className={styles.leader} d="" />
            ))}
          </svg>

          <footer className={styles.bottomBar}>
            <div className={styles.timelineStatus}>
              <span className={styles.stageNumber} aria-hidden="true">{stageNumber} / {String(JOURNEY_STAGES.length).padStart(2, "0")}</span>
              <span className={styles.stageLabel} id="stage-label">{current.label}</span>
              <div
                ref={progressTrackRef}
                className={styles.progressTrack}
                role="progressbar"
                aria-valuenow={0}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-labelledby="stage-label"
              >
                <span ref={progressFillRef} className={styles.progressFill} />
              </div>
            </div>
            <div className={styles.stepActions} role="group" aria-label="Navegar pelas etapas (altera a posição de rolagem)">
              <button
                type="button"
                className={styles.controlButton}
                aria-label="Etapa anterior"
                onClick={() => scrollToProgress(adjacentStageStart(progressRef.current, -1))}
              >
                <span aria-hidden="true">←</span>
                <span className={styles.stepLabel}> Anterior</span>
              </button>
              <button
                type="button"
                className={styles.controlButton}
                aria-label="Próxima etapa"
                onClick={() => scrollToProgress(adjacentStageStart(progressRef.current, 1))}
              >
                <span className={styles.stepLabel}>Próxima </span>
                <span aria-hidden="true">→</span>
              </button>
              <button type="button" className={styles.controlButton} onClick={() => scrollToProgress(0.97)}>
                Ir à descoberta
              </button>
            </div>
          </footer>

          <div className={styles.srOnly} role="status" aria-live="polite">
            Etapa {stageIndex + 1} de {JOURNEY_STAGES.length}: {current.label}.
          </div>
          <div className={styles.srOnly} role="status" aria-live="polite" data-motion-status>
            {announcement}
          </div>
        </div>
      </section>
    </div>
  );
}
