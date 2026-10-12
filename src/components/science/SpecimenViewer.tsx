"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ShownDpdxImage } from "@/lib/science/dpdx/registry";
import styles from "./Lab.module.css";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const STEP = 0.5;

interface ViewerProps {
  organismName: string;
  images: ShownDpdxImage[];
  initialId?: string;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Visualizador de microscopia. Zoom e deslocamento acontecem só no navegador, sobre a imagem
 * original sem recorte nem filtro (a política do CDC pede conteúdo inalterado). Teclado: com o
 * visualizador focado, + e − ampliam, setas deslocam, 0 restaura. Gestos: arrastar, pinça e
 * duplo toque; a roda só amplia com Ctrl/⌘ para não sequestrar a rolagem da página.
 */
export function SpecimenViewer({ organismName, images, initialId }: ViewerProps) {
  const uid = useId();
  const startIndex = Math.max(0, images.findIndex((image) => image.id === initialId));
  const [index, setIndex] = useState(startIndex);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const zoomRef = useRef(1);
  const stageRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ startDistance: number; startZoom: number; lastX: number; lastY: number } | null>(null);

  const image = images[index];

  const bounds = useCallback((z: number) => {
    const size = stageRef.current?.clientWidth ?? 0;
    return (size * (z - 1)) / 2;
  }, []);

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
    [bounds],
  );

  const reset = useCallback(() => {
    zoomRef.current = 1;
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const select = (next: number) => {
    setIndex(next);
    reset();
  };

  // A roda do mouse com Ctrl/⌘ amplia (listener não-passivo para poder impedir o zoom da página).
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
        reset();
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

  const zoomLabel = useMemo(() => `${String(zoom).replace(".", ",")}×`, [zoom]);
  const rights = image.rights;
  const hasFailed = failed[image.id] === true;
  const captionId = `${uid}-caption`;
  const hintId = `${uid}-hint`;

  return (
    <div className={styles.viewer}>
      <div className={styles.stageColumn}>
        {/* Widget personalizado: foco único com teclas próprias (+, −, setas, 0); os botões ao lado são o equivalente. */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
        <div tabIndex={0}
          ref={stageRef}
          className={`${styles.stage} ${zoom > 1 ? styles.stageZoomed : ""}`}
          role="application"
          aria-roledescription="visualizador de imagem"
          aria-label={`${image.stage.pt} de ${organismName}. Imagem ${index + 1} de ${images.length}`}
          aria-describedby={`${hintId} ${captionId}`}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={() => (zoom > 1 ? reset() : applyZoom(2.5))}
        >
          {hasFailed ? (
            <div className={styles.fallback}>
              <p>
                <strong>A imagem não carregou.</strong>
              </p>
              <p>
                O original continua disponível na fonte:{" "}
                <a href={image.sourcePageUrl} target="_blank" rel="noopener noreferrer">
                  página do CDC DPDx<span className="visually-hidden"> (abre em nova aba)</span>
                </a>
              </p>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={image.id}
              // Se a imagem já falhou antes da hidratação, o onError do React não dispara: confere aqui.
              ref={(el) => {
                if (el && el.complete && el.naturalWidth === 0 && !failed[image.id]) {
                  setFailed((f) => ({ ...f, [image.id]: true }));
                }
              }}
              className={styles.image}
              src={image.imageUrl}
              alt={image.alt}
              width={image.width}
              height={image.height}
              decoding="async"
              draggable={false}
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
              onError={() => setFailed((f) => ({ ...f, [image.id]: true }))}
            />
          )}
        </div>

        <div className={styles.controls} role="group" aria-label="Controles de ampliação">
          <button type="button" className={styles.ctl} onClick={() => applyZoom(zoom - STEP)} disabled={zoom <= MIN_ZOOM} aria-label="Reduzir ampliação">
            −
          </button>
          <output className={styles.zoomValue} aria-live="polite" aria-label="Ampliação atual">
            {zoomLabel}
          </output>
          <button type="button" className={styles.ctl} onClick={() => applyZoom(zoom + STEP)} disabled={zoom >= MAX_ZOOM} aria-label="Aumentar ampliação">
            +
          </button>
          <button type="button" className={styles.ctlText} onClick={reset} disabled={zoom === 1 && pan.x === 0 && pan.y === 0}>
            Restaurar
          </button>
        </div>
        <p id={hintId} className={styles.hint}>
          Resolução nativa da fonte: {image.width} × {image.height} px. Ampliar aumenta o tamanho, não o detalhe. Teclado: + e −
          ampliam, setas deslocam, 0 restaura. Toque: pinça e arraste. Mouse: arraste, duplo clique ou Ctrl + roda.
        </p>
      </div>

      <div className={styles.infoColumn}>
        <div role="group" aria-label="Imagens deste organismo" className={styles.thumbs}>
          {images.map((item, i) => (
            <button
              key={item.id}
              type="button"
              className={`${styles.thumb} ${i === index ? styles.thumbActive : ""}`}
              aria-pressed={i === index}
              onClick={() => select(i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.imageUrl} alt="" width={64} height={64} loading="lazy" decoding="async" />
              <span>
                <span className={styles.thumbStage}>{item.stage.pt}</span>
                <span className={styles.thumbPrep}>{item.preparation.pt}</span>
              </span>
            </button>
          ))}
        </div>

        <dl className={styles.labels}>
          <div>
            <dt>Espécie</dt>
            <dd>
              <i lang="la">{organismName}</i>
              {image.taxonLabelInCaption.includes("/") && (
                <span className={styles.sub}>
                  {" "}
                  (a legenda do CDC cita o complexo <i lang="la">{image.taxonLabelInCaption}</i>)
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt>Estágio diagnóstico</dt>
            <dd>
              {image.stage.pt} <span className={styles.sub}>(<span lang="en">{image.stage.en}</span>)</span>
            </dd>
          </div>
          <div>
            <dt>Preparação</dt>
            <dd>
              {image.preparation.pt} <span className={styles.sub}>(<span lang="en">{image.preparation.en}</span>)</span>
            </dd>
          </div>
        </dl>

        <figure className={styles.caption} id={captionId}>
          <figcaption>
            <p lang="en" className={styles.captionEn}>
              {image.captionEn}
            </p>
            <p className={styles.captionPt}>
              <span className={styles.tag}>Tradução livre, a revisar</span> {image.captionPt}
            </p>
          </figcaption>
          {image.notes.length > 0 && (
            <ul className={styles.notes}>
              {image.notes.map((note) => (
                <li key={note.fromCaption}>{note.pt}</li>
              ))}
            </ul>
          )}
        </figure>

        <details className={styles.sourceBox}>
          <summary>Fonte e limitações</summary>
          <div className={styles.sourceBody}>
            <p>
              <strong>Crédito:</strong> {rights.attributionText}{" "}
              <a href={image.sourcePageUrl} target="_blank" rel="noopener noreferrer">
                Página original no CDC DPDx<span className="visually-hidden"> (abre em nova aba)</span>
              </a>
              . Figura {image.figureLabel.replace("Figure ", "")}; página revisada pelo CDC em{" "}
              <time dateTime={image.sourcePageLastReviewed}>{formatDay(image.sourcePageLastReviewed)}</time>.
            </p>
            <p>
              <strong>Base de uso:</strong> {rights.basis} Verificado em{" "}
              <time dateTime={rights.verifiedAt}>{formatDay(rights.verifiedAt)}</time>. Esta imagem não é de autoria da Ynara nem da
              Microcosmos, e o uso não sugere endosso do CDC ou do governo dos EUA.
            </p>
            <p>
              <strong>Limitações:</strong> material educativo. Não é ferramenta de diagnóstico: o aspecto de um organismo varia com
              coloração, preparo e especimes, e a identificação clínica exige profissional e laboratório qualificados.
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}

function formatDay(iso: string) {
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(parsed);
}
