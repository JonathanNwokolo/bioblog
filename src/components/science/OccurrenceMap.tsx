"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { WORLD_MAP } from "@/content/world-map";
import { basisLabel, formatMeters, issueLabel } from "@/lib/science/present";
import styles from "./Map.module.css";

export interface MapPoint {
  gbifId: string;
  lat: number;
  lon: number;
  uncertaintyMeters: number | null;
  basisOfRecord: string | null;
  year: number | null;
  eventDate: string | null;
  country: string | null;
  datasetName: string | null;
  datasetTitle: string | null;
  institutionCode: string | null;
  rightsHolder: string | null;
  licenceLabel: string | null;
  issues: string[];
  url: string;
}

interface View {
  z: number;
  cx: number;
  cy: number;
}

const { width: W, height: H } = WORLD_MAP;
const MAX_ZOOM = 64;
const CLUSTER_PX = 26;
const PAGE_SIZE = 10;

const project = (lon: number, lat: number) => ({ x: ((lon + 180) / 360) * W, y: ((90 - lat) / 180) * H });
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function minZoomFor(aspect: number) {
  return Math.max(1, W / (H * aspect));
}

function constrain(view: View, aspect: number): View {
  const z = clamp(view.z, minZoomFor(aspect), MAX_ZOOM);
  const vw = W / z;
  const vh = vw / aspect;
  return {
    z,
    cx: clamp(view.cx, vw / 2, W - vw / 2),
    cy: clamp(view.cy, Math.min(vh / 2, H / 2), Math.max(H - vh / 2, H / 2)),
  };
}

function fitView(points: MapPoint[], aspect: number): View {
  if (points.length === 0) return constrain({ z: 1, cx: W / 2, cy: H / 2 }, aspect);
  const xs: number[] = [];
  const ys: number[] = [];
  for (const p of points) {
    const { x, y } = project(p.lon, p.lat);
    xs.push(x);
    ys.push(y);
  }
  xs.sort((a, b) => a - b);
  ys.sort((a, b) => a - b);
  // Com muitos pontos, a vista ignora os 5% mais distantes de cada lado: um ponto isolado (ex.: um
  // registro na Oceania) não pode empurrar a maioria para fora do quadro. "Mundo todo" mostra tudo.
  const trim = points.length >= 20 ? Math.floor(points.length * 0.05) : 0;
  const minX = xs[trim];
  const maxX = xs[xs.length - 1 - trim];
  const minY = ys[trim];
  const maxY = ys[ys.length - 1 - trim];
  const padX = Math.max((maxX - minX) * 0.15, 40);
  const padY = Math.max((maxY - minY) * 0.15, 40);
  const bw = maxX - minX + 2 * padX;
  const bh = maxY - minY + 2 * padY;
  // A caixa cabe se a largura da vista (W / z) cobre bw e a altura (largura / proporção) cobre bh.
  const z = Math.min(12, W / Math.max(bw, bh * aspect));
  return constrain({ z, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 }, aspect);
}

interface Cluster {
  key: string;
  x: number;
  y: number;
  members: MapPoint[];
}

function clusterPoints(points: MapPoint[], cell: number): Cluster[] {
  const cells = new Map<string, Cluster>();
  for (const p of points) {
    const { x, y } = project(p.lon, p.lat);
    const key = `${Math.floor(x / cell)}:${Math.floor(y / cell)}`;
    const existing = cells.get(key);
    if (existing) {
      existing.members.push(p);
      existing.x += (x - existing.x) / existing.members.length;
      existing.y += (y - existing.y) / existing.members.length;
    } else {
      cells.set(key, { key, x, y, members: [p] });
    }
  }
  return [...cells.values()];
}

function getYearColor(year: number | null): string {
  if (year === null) return "#94a3b8";
  if (year >= 2020) return "#fb923c";
  if (year >= 2010) return "#facc15";
  if (year >= 2000) return "#f43f5e";
  if (year >= 1980) return "#c084fc";
  return "#60a5fa";
}

export function OccurrenceMap({
  points,
  taxonName,
  showRecordList = true,
}: {
  points: MapPoint[];
  taxonName: string;
  showRecordList?: boolean;
}) {
  const uid = useId();
  const frameRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 900, h: 450 });
  const aspect = size.w / size.h;
  // `null` = ainda não houve interação: a vista é derivada do ajuste aos pontos.
  const [userView, setView] = useState<View | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const pinch = useRef<{ d: number; z: number } | null>(null);
  const active = useRef(new Map<number, { x: number; y: number }>());

  // Mede o quadro e ajusta a vista aos pontos uma vez.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) setSize({ w: rect.width, h: rect.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const view = useMemo(() => constrain(userView ?? fitView(points, aspect), aspect), [userView, points, aspect]);

  const vw = W / view.z;
  const vh = vw / aspect;
  const x0 = view.cx - vw / 2;
  const y0 = view.cy - vh / 2;
  const unitsPerPx = vw / size.w;

  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  });

  const zoomBy = useCallback(
    (factor: number, anchor?: { x: number; y: number }) => {
      setView(() => {
        const v = viewRef.current;
        const nextZ = clamp(v.z * factor, minZoomFor(aspect), MAX_ZOOM);
        if (!anchor) return constrain({ ...v, z: nextZ }, aspect);
        // Mantém o ponto sob o cursor fixo.
        const ratio = v.z / nextZ;
        return constrain({ z: nextZ, cx: anchor.x - (anchor.x - v.cx) * ratio, cy: anchor.y - (anchor.y - v.cy) * ratio }, aspect);
      });
    },
    [aspect],
  );

  const panBy = useCallback(
    (dxUnits: number, dyUnits: number) => {
      const v = viewRef.current;
      setView(constrain({ ...v, cx: v.cx + dxUnits, cy: v.cy + dyUnits }, aspect));
    },
    [aspect],
  );

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      setView(() => {
        const v = viewRef.current;
        const curVw = W / v.z;
        const curVh = curVw / aspect;
        const anchor = { x: v.cx - curVw / 2 + px * curVw, y: v.cy - curVh / 2 + py * curVh };
        const factor = event.deltaY < 0 ? 1.4 : 1 / 1.4;
        const nextZ = clamp(v.z * factor, minZoomFor(aspect), MAX_ZOOM);
        const ratio = v.z / nextZ;
        return constrain({ z: nextZ, cx: anchor.x - (anchor.x - v.cx) * ratio, cy: anchor.y - (anchor.y - v.cy) * ratio }, aspect);
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [aspect]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    const step = vw * 0.15;
    switch (event.key) {
      case "+":
      case "=":
        zoomBy(1.5);
        break;
      case "-":
      case "_":
        zoomBy(1 / 1.5);
        break;
      case "0":
        setView(fitView(points, aspect));
        break;
      case "ArrowLeft":
        panBy(-step, 0);
        break;
      case "ArrowRight":
        panBy(step, 0);
        break;
      case "ArrowUp":
        panBy(0, -step);
        break;
      case "ArrowDown":
        panBy(0, step);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  const onPointerDown = (event: React.PointerEvent) => {
    active.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    if (active.current.size === 2) {
      const [a, b] = [...active.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), z: view.z };
      drag.current = null;
    } else {
      drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    }
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!active.current.has(event.pointerId)) return;
    active.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (active.current.size === 2 && pinch.current) {
      const [a, b] = [...active.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const target = clamp((pinch.current.z * d) / pinch.current.d, minZoomFor(aspect), MAX_ZOOM);
      setView(constrain({ ...viewRef.current, z: target }, aspect));
      return;
    }
    const g = drag.current;
    if (g && g.id === event.pointerId) {
      const dx = event.clientX - g.x;
      const dy = event.clientY - g.y;
      if (Math.abs(dx) + Math.abs(dy) < 2) return;
      g.x = event.clientX;
      g.y = event.clientY;
      panBy(-dx * unitsPerPx, -dy * unitsPerPx);
    }
  };

  const onPointerUp = (event: React.PointerEvent) => {
    active.current.delete(event.pointerId);
    pinch.current = null;
    drag.current = null;
  };

  const clusters = useMemo(() => clusterPoints(points, CLUSTER_PX * unitsPerPx), [points, unitsPerPx]);
  const selectedPoint = points.find((p) => p.gbifId === selected) ?? null;
  const pageCount = Math.max(1, Math.ceil(points.length / PAGE_SIZE));
  const pageItems = points.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const px = (n: number) => n * unitsPerPx;

  const focusOnCluster = (cluster: Cluster) => {
    if (cluster.members.length === 1) {
      setSelected(cluster.members[0].gbifId);
      return;
    }
    const sub = fitView(cluster.members, aspect);
    setView({ ...sub, z: Math.max(sub.z, view.z * 1.8) });
  };

  const showOnMap = (point: MapPoint) => {
    setSelected(point.gbifId);
    const { x, y } = project(point.lon, point.lat);
    setView(constrain({ z: Math.max(viewRef.current.z, 6), cx: x, cy: y }, aspect));
    frameRef.current?.scrollIntoView({ block: "nearest", behavior: "auto" });
  };

  const summaryId = `${uid}-summary`;

  return (
    <div className={styles.wrap}>
      {/* Widget personalizado: foco único com teclas próprias (setas, +, −, 0). A lista de registros é o equivalente em texto. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
      <div tabIndex={0}
        ref={frameRef}
        className={styles.frame}
        role="application"
        aria-roledescription="mapa interativo"
        aria-label={`Mapa de registros de ocorrência de ${taxonName}`}
        aria-describedby={summaryId}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const ax = x0 + ((event.clientX - rect.left) / rect.width) * vw;
          const ay = y0 + ((event.clientY - rect.top) / rect.height) * vh;
          zoomBy(2, { x: ax, y: ay });
        }}
      >
        <svg
          viewBox={`${x0} ${y0} ${vw} ${vh}`}
          className={styles.svg}
          role="presentation"
          focusable="false"
          preserveAspectRatio="xMidYMid meet"
        >
          <rect x="0" y="0" width={W} height={H} className={styles.ocean} />
          <g className={styles.graticule}>
            {[-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150].map((lon) => {
              const x = project(lon, 0).x;
              return <line key={`lo${lon}`} x1={x} y1="0" x2={x} y2={H} />;
            })}
            {[-60, -30, 0, 30, 60].map((lat) => {
              const y = project(0, lat).y;
              return <line key={`la${lat}`} x1="0" y1={y} x2={W} y2={y} />;
            })}
          </g>
          <path d={WORLD_MAP.land} className={styles.land} />
          <path d={WORLD_MAP.borders} className={styles.borders} />

          {selectedPoint && selectedPoint.uncertaintyMeters !== null && (
            <circle
              cx={project(selectedPoint.lon, selectedPoint.lat).x}
              cy={project(selectedPoint.lon, selectedPoint.lat).y}
              r={Math.max((selectedPoint.uncertaintyMeters / 111_320) * (W / 360), px(3))}
              className={styles.uncertainty}
            />
          )}


          {clusters.map((cluster) => {
            const count = cluster.members.length;
            const isSelected = count === 1 && cluster.members[0].gbifId === selected;
            const r = px(count === 1 ? 5.5 : 8.5 + Math.min(10, Math.sqrt(count) * 2.2));
            const dotColor = count === 1 ? getYearColor(cluster.members[0].year) : undefined;
            return (
              // O mapa é complemento visual: a lista de registros abaixo é o equivalente por teclado.
              <g
                key={cluster.key}
                className={styles.marker}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  focusOnCluster(cluster);
                }}
              >
                <circle
                  cx={cluster.x}
                  cy={cluster.y}
                  r={r}
                  className={count === 1 ? (isSelected ? styles.dotSelected : styles.dot) : styles.cluster}
                  style={count === 1 && !isSelected ? { fill: dotColor } : undefined}
                />
                {count > 1 && (
                  <text x={cluster.x} y={cluster.y} className={styles.clusterText} style={{ fontSize: px(11) }} textAnchor="middle" dominantBaseline="central">
                    {count}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Overlays Flutuantes no Mapa — Referência Fase 2.2.1 */}
        <div className={styles.mapControlsOverlay} role="group" aria-label="Controles rápidos do mapa">
          <button type="button" className={styles.mapCtrlBtn} onClick={() => zoomBy(1.5)} aria-label="Aproximar o mapa" title="Aproximar (+)">
            +
          </button>
          <button type="button" className={styles.mapCtrlBtn} onClick={() => zoomBy(1 / 1.5)} aria-label="Afastar o mapa" title="Afastar (−)">
            −
          </button>
          <button
            type="button"
            className={styles.mapCtrlBtn}
            onClick={() => setView(fitView(points, aspect))}
            aria-label="Ajustar aos pontos"
            title="Centralizar pontos"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="7" />
              <line x1="12" y1="2" x2="12" y2="5" />
              <line x1="12" y1="19" x2="12" y2="22" />
              <line x1="2" y1="12" x2="5" y2="12" />
              <line x1="19" y1="12" x2="22" y2="12" />
            </svg>
          </button>
        </div>

        <div className={styles.mapLayerBadge} aria-hidden="true">
          <span>Satélite</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>

        <div className={styles.mapLegendOverlay} aria-label="Legenda de anos de registro">
          <div className={styles.legendTitle}>Ano do registro</div>
          <ul className={styles.legendList}>
            <li className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: "#fb923c" }} />
              <span>≥ 2020</span>
            </li>
            <li className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: "#facc15" }} />
              <span>2010 – 2019</span>
            </li>
            <li className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: "#f43f5e" }} />
              <span>2000 – 2009</span>
            </li>
            <li className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: "#c084fc" }} />
              <span>1980 – 1999</span>
            </li>
            <li className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: "#60a5fa" }} />
              <span>&lt; 1980</span>
            </li>
          </ul>
        </div>

        <div className={styles.mapScaleOverlay} aria-hidden="true">
          <span>2.000 km</span>
          <div className={styles.scaleLine} />
        </div>

        <div className={styles.attribution}>{WORLD_MAP.attribution}</div>
      </div>

      <div className={styles.toolbar} role="group" aria-label="Controles do mapa">
        <button type="button" className={styles.btn} onClick={() => zoomBy(1.5)} aria-label="Aproximar o mapa">
          +
        </button>
        <button type="button" className={styles.btn} onClick={() => zoomBy(1 / 1.5)} aria-label="Afastar o mapa">
          −
        </button>
        <button type="button" className={styles.btnText} onClick={() => setView(fitView(points, aspect))}>
          Ajustar aos pontos
        </button>
        <button type="button" className={styles.btnText} onClick={() => setView(constrain({ z: 1, cx: W / 2, cy: H / 2 }, aspect))}>
          Mundo todo
        </button>
        <output className={styles.zoomValue} aria-live="polite">
          Aproximação {view.z.toFixed(1).replace(".", ",")}×
        </output>
      </div>

      <p id={summaryId} className={styles.hint}>
        {points.length} registros no mapa. Arraste para mover; mova pelo teclado com as setas, + e − aproximam, 0 ajusta. Toque: pinça e
        arraste. Mouse: duplo clique ou Ctrl + roda. Números indicam registros agrupados; toque neles para aproximar.
      </p>

      {selectedPoint && (
        <section className={styles.detail} aria-labelledby={`${uid}-detail`} aria-live="polite">
          <div className={styles.detailHead}>
            <h3 id={`${uid}-detail`}>Registro {selectedPoint.gbifId}</h3>
            <button type="button" className={styles.btnText} onClick={() => setSelected(null)}>
              Fechar detalhe
            </button>
          </div>
          <RecordFacts point={selectedPoint} />
        </section>
      )}

      {showRecordList && (
        <section className={styles.records} aria-labelledby={`${uid}-list`}>
          <h3 id={`${uid}-list`} className={styles.recordsTitle}>
            Lista de registros no mapa
          </h3>
          <p className={styles.hint} style={{ textAlign: "left" }}>
            Equivalente em texto do mapa. Cada linha pode ser mostrada no mapa.
          </p>
          <ol className={styles.recordList} start={page * PAGE_SIZE + 1}>
            {pageItems.map((point) => (
              <li key={point.gbifId} className={point.gbifId === selected ? styles.recordActive : undefined}>
                <span>
                  <strong>{point.country ?? "País não informado"}</strong>
                  <span className={styles.recordMeta}>
                    {[point.year ? String(point.year) : "ano não informado", basisLabel(point.basisOfRecord) ?? "tipo não informado"].join(" · ")}
                  </span>
                  <span className={styles.recordMeta}>
                    {point.lat.toFixed(3)}°, {point.lon.toFixed(3)}°
                    {point.uncertaintyMeters !== null ? ` · incerteza ${formatMeters(point.uncertaintyMeters)}` : " · incerteza não informada"}
                  </span>
                </span>
                <button type="button" className={styles.btnText} onClick={() => showOnMap(point)}>
                  Mostrar no mapa<span className="visually-hidden"> o registro {point.gbifId}</span>
                </button>
              </li>
            ))}
          </ol>
          <div className={styles.pager}>
            <button type="button" className={styles.btnText} disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              Anteriores
            </button>
            <span aria-live="polite">
              Página {page + 1} de {pageCount}
            </span>
            <button type="button" className={styles.btnText} disabled={page >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}>
              Próximos
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function RecordFacts({ point }: { point: MapPoint }) {
  const countryName = point.country ?? null;
  return (
    <dl className={styles.facts}>
      <div>
        <dt>Local</dt>
        <dd>
          {countryName ?? <span className={styles.missing}>País não informado</span>} · {point.lat.toFixed(4)}°, {point.lon.toFixed(4)}°
        </dd>
      </div>
      <div>
        <dt>Incerteza da coordenada</dt>
        <dd>{point.uncertaintyMeters !== null ? formatMeters(point.uncertaintyMeters) : <span className={styles.missing}>Não informada pela fonte</span>}</dd>
      </div>
      <div>
        <dt>Data</dt>
        <dd>{point.eventDate ?? (point.year ? String(point.year) : <span className={styles.missing}>Não informada</span>)}</dd>
      </div>
      <div>
        <dt>Tipo de registro</dt>
        <dd>{basisLabel(point.basisOfRecord) ?? <span className={styles.missing}>Não informado</span>}</dd>
      </div>
      <div>
        <dt>Conjunto de dados</dt>
        <dd>{point.datasetTitle ?? point.datasetName ?? <span className={styles.missing}>Não informado</span>}</dd>
      </div>
      <div>
        <dt>Instituição / detentor</dt>
        <dd>{[point.institutionCode, point.rightsHolder].filter(Boolean).join(" · ") || <span className={styles.missing}>Não informado</span>}</dd>
      </div>
      <div>
        <dt>Licença do registro</dt>
        <dd>{point.licenceLabel ?? <span className={styles.missing}>Não informada</span>}</dd>
      </div>
      {point.issues.length > 0 && (
        <div>
          <dt>Sinalizações da GBIF</dt>
          <dd>
            <ul className={styles.issues}>
              {point.issues.map((code) => (
                <li key={code}>{issueLabel(code)}</li>
              ))}
            </ul>
          </dd>
        </div>
      )}
      <div>
        <dt>Registro original</dt>
        <dd>
          <a href={point.url} target="_blank" rel="noopener noreferrer">
            Abrir no gbif.org<span className="visually-hidden"> (abre em nova aba)</span>
          </a>
        </dd>
      </div>
    </dl>
  );
}

