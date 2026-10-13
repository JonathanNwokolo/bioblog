"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ShownDpdxImage } from "@/lib/science/dpdx/registry";
import { getMorphologicalGuide } from "@/lib/science/dpdx/annotations";
import styles from "./Lab.module.css";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const STEP = 0.5;

interface InteractiveMicroscopeProps {
  organismName: string;
  images: ShownDpdxImage[];
  selectedImageId: string;
  onSelectImage: (id: string) => void;
  activePinId: string | null;
  onSelectPin: (pinId: string | null) => void;
  showPins: boolean;
  onTogglePins: () => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function InteractiveMicroscope({
  organismName,
  images,
  selectedImageId,
  onSelectImage,
  activePinId,
  onSelectPin,
  showPins,
  onTogglePins,
}: InteractiveMicroscopeProps) {
  const uid = useId();
  const currentIndex = Math.max(
    0,
    images.findIndex((img) => img.id === selectedImageId)
  );
  const currentImage = images[currentIndex] ?? images[0];

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [stageSize, setStageSize] = useState(0);
  const [failed, setFailed] = useState<Record<string, boolean>>({});

  const zoomRef = useRef(1);
  const stageRef = useRef<HTMLDivElement>(null);
  const stripTrackRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ startDistance: number; startZoom: number; lastX: number; lastY: number } | null>(null);

  const guide = useMemo(() => getMorphologicalGuide(currentImage.id), [currentImage.id]);
  const pins = guide?.pins ?? [];

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    setStageSize(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setStageSize(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const bounds = useCallback((z: number) => {
    return (stageSize * (z - 1)) / 2;
  }, [stageSize]);

  const applyZoom = useCallback(
    (next: number) => {
      const z = clamp(Math.round(next * 100) / 100, MIN_ZOOM, MAX_ZOOM);
      zoomRef.current = z;
      setZoom(z);
      setPan((p) => {
        const limit = bounds(z);
        return { x: clamp(p.x, -limit, limit), y: clamp(p.y, -limit, limit) };
      });
    },
    [bounds]
  );

  const resetView = useCallback(() => {
    zoomRef.current = 1;
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleSelectImage = (id: string) => {
    onSelectImage(id);
    resetView();
  };

  // Roda do mouse com Ctrl/Cmd amplia
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      applyZoom(zoomRef.current + (event.deltaY < 0 ? STEP : -STEP));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [applyZoom]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    const move = 40;
    const limit = bounds(zoom);
    switch (event.key) {
      case "+":
      case "=":
        applyZoom(zoom + STEP);
        break;
      case "-":
      case "_":
        applyZoom(zoom - STEP);
        break;
      case "0":
        resetView();
        break;
      case "ArrowLeft":
        if (zoom > 1) setPan((p) => ({ ...p, x: clamp(p.x + move, -limit, limit) }));
        else return;
        break;
      case "ArrowRight":
        if (zoom > 1) setPan((p) => ({ ...p, x: clamp(p.x - move, -limit, limit) }));
        else return;
        break;
      case "ArrowUp":
        if (zoom > 1) setPan((p) => ({ ...p, y: clamp(p.y + move, -limit, limit) }));
        else return;
        break;
      case "ArrowDown":
        if (zoom > 1) setPan((p) => ({ ...p, y: clamp(p.y - move, -limit, limit) }));
        else return;
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  const onPointerDown = (event: React.PointerEvent) => {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length === 2) {
      gesture.current = {
        startDistance: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        startZoom: zoom,
        lastX: 0,
        lastY: 0,
      };
    } else {
      gesture.current = { startDistance: 0, startZoom: zoom, lastX: event.clientX, lastY: event.clientY };
    }
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const g = gesture.current;
    if (!g) return;
    const pts = [...pointers.current.values()];
    if (pts.length === 2 && g.startDistance > 0) {
      const distance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      applyZoom((g.startZoom * distance) / g.startDistance);
    } else if (pts.length === 1 && zoom > 1) {
      const dx = event.clientX - g.lastX;
      const dy = event.clientY - g.lastY;
      g.lastX = event.clientX;
      g.lastY = event.clientY;
      const limit = bounds(zoom);
      setPan((p) => ({ x: clamp(p.x + dx, -limit, limit), y: clamp(p.y + dy, -limit, limit) }));
    }
  };

  const onPointerUp = (event: React.PointerEvent) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0) gesture.current = null;
    else {
      const [rest] = [...pointers.current.values()];
      gesture.current = { startDistance: 0, startZoom: zoom, lastX: rest.x, lastY: rest.y };
    }
  };

  const scrollStrip = (dir: "left" | "right") => {
    if (!stripTrackRef.current) return;
    const offset = dir === "left" ? -240 : 240;
    stripTrackRef.current.scrollBy({ left: offset, behavior: "smooth" });
  };

  // Cálculo da posição da caixa do minimapa
  const minimapBox = useMemo(() => {
    if (zoom <= 1) {
      return { width: 100, height: 100, left: 0, top: 0 };
    }
    const boxSize = 100 / zoom;
    const limit = bounds(zoom);
    const normX = limit > 0 ? pan.x / limit : 0;
    const normY = limit > 0 ? pan.y / limit : 0;

    const left = clamp(50 - boxSize / 2 - normX * (50 - boxSize / 2), 0, 100 - boxSize);
    const top = clamp(50 - boxSize / 2 - normY * (50 - boxSize / 2), 0, 100 - boxSize);

    return { width: boxSize, height: boxSize, left, top };
  }, [zoom, pan, bounds]);

  const hasFailed = failed[currentImage.id] === true;
  const captionId = `${uid}-caption`;
  const hintId = `${uid}-hint`;

  return (
    <div className={styles.viewerColumn}>
      <div className={styles.viewerCard}>
        {/* Barra Superior do Visualizador */}
        <header className={styles.viewerHeader}>
          <div className={styles.viewerIdentity}>
            <span className={styles.viewerEyebrow}>VISUALIZADOR DE MICROSCÓPIA</span>
            <h2 className={styles.viewerSpecimenTitle}>
              <i lang="la">{organismName}</i> · {currentImage.stage.pt} ({currentImage.preparation.pt})
            </h2>
          </div>

          <div className={styles.viewerControls}>
            {/* Seletor de Ampliação em Pílula */}
            <div className={styles.magGroup} role="group" aria-label="Seletor de ampliação óptica simulada">
              <button
                type="button"
                className={`${styles.magBtn} ${zoom === 1 ? styles.magBtnActive : ""}`}
                onClick={() => applyZoom(1)}
                aria-pressed={zoom === 1}
              >
                100×
              </button>
              <button
                type="button"
                className={`${styles.magBtn} ${zoom === 2 ? styles.magBtnActive : ""}`}
                onClick={() => applyZoom(2)}
                aria-pressed={zoom === 2}
              >
                400×
              </button>
              <button
                type="button"
                className={`${styles.magBtn} ${zoom >= 3.2 ? styles.magBtnActive : ""}`}
                onClick={() => applyZoom(3.5)}
                aria-pressed={zoom >= 3.2}
              >
                1000× (imersão)
              </button>
            </div>

            <button
              type="button"
              className={styles.resetBtn}
              onClick={resetView}
              disabled={zoom === 1 && pan.x === 0 && pan.y === 0}
              title="Redefinir visualização (tecla 0)"
              aria-label="Redefinir visualização"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
              <span>Redefinir</span>
            </button>
          </div>
        </header>

        {/* Palco do Microscópio */}
        <div className={styles.stageWrapper}>
          <div className={styles.stageApertureMask} aria-hidden="true" />

          {/* Barra Flutuante de Ferramentas (Esquerda) */}
          <div className={styles.floatingToolbar} role="toolbar" aria-label="Ferramentas do microscópio">
            <button
              type="button"
              className={styles.toolBtn}
              onClick={() => applyZoom(zoom + STEP)}
              disabled={zoom >= MAX_ZOOM}
              aria-label="Aumentar zoom (+)"
              title="Aumentar zoom (+)"
            >
              +
            </button>
            <button
              type="button"
              className={styles.toolBtn}
              onClick={() => applyZoom(zoom - STEP)}
              disabled={zoom <= MIN_ZOOM}
              aria-label="Diminuir zoom (−)"
              title="Diminuir zoom (−)"
            >
              −
            </button>
            <button
              type="button"
              className={styles.toolBtn}
              onClick={resetView}
              disabled={zoom === 1 && pan.x === 0 && pan.y === 0}
              aria-label="Centralizar visualização"
              title="Centralizar visualização"
            >
              ⌖
            </button>
            <button
              type="button"
              className={`${styles.toolBtn} ${showPins ? styles.toolBtnActive : ""}`}
              onClick={onTogglePins}
              aria-label={showPins ? "Ocultar marcadores morfológicos" : "Exibir marcadores morfológicos"}
              title={showPins ? "Ocultar marcadores" : "Exibir marcadores"}
            >
              👁
            </button>
          </div>

          {/* Minimapa / Visão Geral (Superior Direito) */}
          <div className={styles.minimap} aria-hidden="true">
            <div className={styles.minimapHeader}>
              <span className={styles.minimapLabel}>Visão geral</span>
              <span className={styles.minimapDot} />
            </div>
            <div className={styles.minimapStage}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentImage.imageUrl}
                alt=""
                className={styles.minimapThumb}
                width={currentImage.width}
                height={currentImage.height}
              />
              <div
                className={styles.minimapViewport}
                style={{
                  width: `${minimapBox.width}%`,
                  height: `${minimapBox.height}%`,
                  left: `${minimapBox.left}%`,
                  top: `${minimapBox.top}%`,
                }}
              />
            </div>
          </div>

          {/* Marcadores Morfológicos (Pins) sobrepostos à lâmina */}
          {showPins && pins.length > 0 && (
            <div className={styles.pinContainer}>
              {pins.map((pin) => {
                const isActive = activePinId === pin.id;
                return (
                  <button
                    key={pin.id}
                    type="button"
                    className={`${styles.pin} ${isActive ? styles.pinActive : ""}`}
                    style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                    onClick={() => onSelectPin(isActive ? null : pin.id)}
                    aria-label={`Estrutura ${pin.number}: ${pin.label}`}
                    aria-expanded={isActive}
                  >
                    <span className={styles.pinBadge}>{pin.number}</span>
                    {isActive && <span className={styles.pinPulse} aria-hidden="true" />}
                    <div className={styles.pinTooltip} role="tooltip">
                      <div className={styles.pinTooltipTitle}>{pin.label}</div>
                      <p className={styles.pinTooltipDesc}>{pin.descriptionPt}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Barra de Escala Micrométrica (Inferior Esquerdo) */}
          <div className={styles.scaleBar} aria-hidden="true">
            <span className={styles.scaleBarLabel}>10 µm</span>
            <div className={styles.scaleBarRuler} />
          </div>

          {/* Campo Interativo do Microscópio */}
          {/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
          <div
            tabIndex={0}
            ref={stageRef}
            className={`${styles.stage} ${zoom > 1 ? styles.stageZoomed : ""}`}
            role="region"
            aria-roledescription="visualizador de microscopia"
            aria-label={`${currentImage.stage.pt} de ${organismName}. Ampliação óptica simulada.`}
            aria-describedby={`${hintId} ${captionId}`}
            onKeyDown={onKeyDown}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDoubleClick={() => (zoom > 1 ? resetView() : applyZoom(2.5))}
          >
            {hasFailed ? (
              <div className={styles.fallback}>
                <p>
                  <strong>A imagem não pôde ser carregada.</strong>
                </p>
                <p>
                  O original permanece disponível na fonte:{" "}
                  <a href={currentImage.sourcePageUrl} target="_blank" rel="noopener noreferrer">
                    página do CDC DPDx<span className="visually-hidden"> (abre em nova aba)</span>
                  </a>
                </p>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={currentImage.id}
                ref={(el) => {
                  if (el && el.complete && el.naturalWidth === 0 && !failed[currentImage.id]) {
                    setFailed((f) => ({ ...f, [currentImage.id]: true }));
                  }
                }}
                className={styles.microscopeImage}
                src={currentImage.imageUrl}
                alt={currentImage.alt}
                width={currentImage.width}
                height={currentImage.height}
                decoding="async"
                draggable={false}
                style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
                onError={() => setFailed((f) => ({ ...f, [currentImage.id]: true }))}
              />
            )}
          </div>
        </div>

        {/* Rodapé do Visualizador */}
        <footer className={styles.viewerFooter}>
          <div className={styles.footerResolution}>
            <span className={styles.resolutionDot} aria-hidden="true" />
            <span>
              Resolução nativa da fonte: {currentImage.width} × {currentImage.height} px · Ampliação simulada{" "}
              {String(zoom).replace(".", ",")}×
            </span>
          </div>
          <span id={hintId}>Arraste para mover · Dê duplo clique para ampliar · Teclas + e −</span>
        </footer>
      </div>

      {/* Faixa de Lâminas / Carrossel Inferior */}
      <div className={styles.slideStrip} role="region" aria-label="Lâminas deste organismo">
        <div className={styles.stripHeader}>
          <h3 className={styles.stripTitle}>Lâminas da coleção ({images.length} disponíveis)</h3>
          <div className={styles.stripControls}>
            <button
              type="button"
              className={styles.stripArrowBtn}
              onClick={() => scrollStrip("left")}
              aria-label="Rolar lâminas para a esquerda"
            >
              ‹
            </button>
            <button
              type="button"
              className={styles.stripArrowBtn}
              onClick={() => scrollStrip("right")}
              aria-label="Rolar lâminas para a direita"
            >
              ›
            </button>
          </div>
        </div>

        <div ref={stripTrackRef} className={styles.stripTrack}>
          {images.map((item) => {
            const isSelected = item.id === currentImage.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`${styles.stripThumbBtn} ${isSelected ? styles.stripThumbActive : ""}`}
                aria-pressed={isSelected}
                onClick={() => handleSelectImage(item.id)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.imageUrl}
                  alt=""
                  width={48}
                  height={48}
                  className={styles.stripImg}
                  loading="lazy"
                  decoding="async"
                />
                <div className={styles.stripThumbInfo}>
                  <span className={styles.stripThumbStage}>{item.stage.pt}</span>
                  <span className={styles.stripThumbPrep}>{item.preparation.pt}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
