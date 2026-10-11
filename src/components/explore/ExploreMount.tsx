import { CINEMATIC_ROOT_ID, CINEMATIC_STATUS_ATTRIBUTE } from "@/cinematic/contract";
import styles from "./Explore.module.css";

/** Posições das partículas estáticas do campo de visão (percentuais). */
const PARTICLES = [
  [12, 30, 6, 0.55],
  [24, 64, 10, 0.4],
  [34, 18, 4, 0.7],
  [46, 78, 7, 0.5],
  [58, 26, 12, 0.35],
  [70, 58, 5, 0.65],
  [78, 22, 8, 0.45],
  [84, 72, 4, 0.7],
  [20, 82, 5, 0.5],
  [64, 84, 9, 0.35],
  [88, 40, 6, 0.55],
  [40, 46, 3, 0.8],
  [52, 60, 3, 0.7],
  [30, 38, 2.4, 0.8],
] as const;

/**
 * Ponto de montagem do futuro runtime 3D.
 *
 * Renderiza no servidor um campo de visão de microscópio estático (anel,
 * retículo, partículas), que é também o fallback definitivo para
 * movimento reduzido e falhas de WebGL. Ver `src/cinematic/contract.ts`.
 */
export function ExploreMount() {
  const mountAttributes = {
    id: CINEMATIC_ROOT_ID,
    [CINEMATIC_STATUS_ATTRIBUTE]: "pending",
  };

  return (
    <div
      className={styles.aperture}
      role="img"
      aria-label="Campo de visão de um microscópio. A cena cinematográfica ainda está em preparação."
      {...mountAttributes}
    >
      <svg className={styles.graticule} viewBox="0 0 400 400" aria-hidden="true" focusable="false">
        <g fill="none" stroke="currentColor" strokeLinecap="round">
          <circle cx="200" cy="200" r="168" strokeOpacity="0.28" strokeDasharray="1 7" strokeWidth="1.5" />
          <circle cx="200" cy="200" r="110" strokeOpacity="0.16" />
          <path d="M200 36v34M200 330v34M36 200h34M330 200h34" strokeOpacity="0.5" strokeWidth="1.5" />
          <path d="M184 200h32M200 184v32" strokeOpacity="0.55" strokeWidth="1.5" />
          {Array.from({ length: 36 }, (_, i) => {
            const a = (i * 10 * Math.PI) / 180;
            const r1 = 186;
            const r2 = i % 3 === 0 ? 176 : 181;
            const f = (n: number) => Math.round(n * 100) / 100;
            return (
              <path
                key={i}
                d={`M${f(200 + Math.cos(a) * r1)} ${f(200 + Math.sin(a) * r1)}L${f(200 + Math.cos(a) * r2)} ${f(200 + Math.sin(a) * r2)}`}
                strokeOpacity="0.55"
              />
            );
          })}
        </g>
      </svg>

      {PARTICLES.map(([x, y, size, opacity], i) => (
        <span
          key={i}
          className={styles.particle}
          style={{ left: `${x}%`, top: `${y}%`, width: `${size}%`, opacity }}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
