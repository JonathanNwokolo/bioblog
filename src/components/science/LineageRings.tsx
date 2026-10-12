import Link from "next/link";
import { rankLabel } from "@/lib/science/present";
import styles from "./Atlas.module.css";

export interface RingNode {
  taxId: string;
  name: string;
  rank: string | null;
  current: boolean;
}

const MAJOR = new Set(["superkingdom", "domain", "kingdom", "phylum", "class", "order", "family", "genus", "species"]);

/**
 * Hierarquia como "zoom de lente": do táxon mais amplo (anel externo) ao registro atual (disco
 * central). É ilustração do mesmo dado que a lista ordenada ao lado: o SVG é aria-hidden e os
 * anéis só respondem ao mouse/toque; teclado e leitor de tela usam a lista.
 */
export function LineageRings({ nodes }: { nodes: RingNode[] }) {
  const count = nodes.length;
  const R_MAX = 188;
  const R_MIN = 30;
  const step = count > 1 ? (R_MAX - R_MIN) / (count - 1) : 0;
  const showAllNumbers = step >= 11;

  return (
    <div className={styles.rings} aria-hidden="true">
      <svg viewBox="0 0 400 400" role="presentation" focusable="false">
        {nodes.map((node, index) => {
          const r = count === 1 ? R_MIN + 60 : R_MAX - index * step;
          const major = node.rank ? MAJOR.has(node.rank.toLowerCase()) : false;
          const isLast = index === count - 1;
          const label = `${rankLabel(node.rank).text}: ${node.name}`;
          const ring = (
            <g key={node.taxId} className={`${styles.ring} ${node.current ? styles.ringCurrent : ""}`}>
              <title>{label}</title>
              <circle
                cx="200"
                cy="200"
                r={r}
                className={major || isLast ? styles.ringMajor : styles.ringMinor}
                fill={isLast ? "var(--mint)" : "transparent"}
              />
              {(showAllNumbers || major || isLast) && (
                <text
                  x="200"
                  y={isLast ? 200 : 200 - r + 11}
                  className={styles.ringNumber}
                  textAnchor="middle"
                  dominantBaseline={isLast ? "central" : undefined}
                >
                  {index + 1}
                </text>
              )}
            </g>
          );
          return node.current ? (
            ring
          ) : (
            <Link key={node.taxId} href={`/atlas/${node.taxId}`} tabIndex={-1} aria-hidden="true">
              {ring}
            </Link>
          );
        })}
      </svg>
    </div>
  );
}
