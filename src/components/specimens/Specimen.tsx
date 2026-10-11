import { useId } from "react";
import type { SpecimenKind } from "@/content/types";

/**
 * Ilustrações de campo microscópico geradas em código.
 *
 * São placeholders honestos: vetoriais, rotulados como ilustração, nunca
 * apresentados como registro de laboratório. Por serem vetoriais, a lente do
 * hero amplia sem perder nitidez, e a prop `detail` acrescenta estruturas
 * finas (estrias, grânulos) que só aparecem sob a lente.
 *
 * Quando houver fotografias reais, trocar o `MediaRef` do conteúdo por
 * `kind: "photo"`; estes componentes deixam de ser usados sem mudar o layout.
 */

interface SpecimenProps {
  kind: SpecimenKind;
  /** Camada extra de detalhe fino (usada pela lente). */
  detail?: boolean;
  className?: string;
  /** Texto alternativo. Vazio = decorativo (ex.: camada ampliada). */
  title?: string;
}

const W = 600;
const H = 420;

/** Arredonda para 2 casas: Math.cos/sin diferem no último dígito entre servidor e cliente. */
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Pseudo-aleatório determinístico: mesmo resultado no servidor e no cliente. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function scatter(seed: number, count: number, rMin: number, rMax: number) {
  const next = rng(seed);
  return Array.from({ length: count }, () => ({
    x: Math.round(next() * W),
    y: Math.round(next() * H),
    r: +(rMin + next() * (rMax - rMin)).toFixed(1),
    o: +(0.25 + next() * 0.45).toFixed(2),
  }));
}

const DEBRIS = {
  cysts: scatter(11, 26, 3, 9),
  nematode: scatter(23, 18, 2, 6),
  giardia: scatter(37, 30, 2.5, 8),
  egg: scatter(53, 22, 2, 6),
} satisfies Record<SpecimenKind, ReturnType<typeof scatter>>;

const PALETTE = {
  cysts: { a: "#EBDDFB", b: "#CDA9F0", stain: "#7E4BC4", deep: "#3E1F66" },
  nematode: { a: "#E4ECF2", b: "#B7C7D6", stain: "#60758A", deep: "#2B3A4A" },
  giardia: { a: "#EEDFFC", b: "#D2B0F2", stain: "#7A45C2", deep: "#3E1F66" },
  egg: { a: "#EFEADB", b: "#D6CDB4", stain: "#9C7A2E", deep: "#4A3A12" },
} as const;

export function Specimen({ kind, detail = false, className, title }: SpecimenProps) {
  const rawId = useId().replace(/:/g, "");
  const id = `sp-${kind}-${rawId}`;
  const p = PALETTE[kind];
  const decorative = !title;

  return (
    <svg
      className={className}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : title}
      focusable="false"
    >
      <defs>
        <radialGradient id={`${id}-bg`} cx="50%" cy="46%" r="75%">
          <stop offset="0" stopColor={p.a} />
          <stop offset="1" stopColor={p.b} />
        </radialGradient>
        <filter id={`${id}-mottle`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.011 0.016" numOctaves="3" seed={kind.length * 7} result="n" />
          <feColorMatrix
            in="n"
            type="matrix"
            values="0 0 0 0 0.35  0 0 0 0 0.2  0 0 0 0 0.6  0 0 0 1.35 -0.52"
          />
        </filter>
        <filter id={`${id}-grain`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="4" result="g" />
          <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.35 -0.1" />
        </filter>
        <radialGradient id={`${id}-vig`} cx="50%" cy="50%" r="72%">
          <stop offset="0.62" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor={p.deep} stopOpacity="0.28" />
        </radialGradient>
        <radialGradient id={`${id}-body`} cx="42%" cy="36%" r="70%">
          <stop offset="0" stopColor="#F6EEFF" />
          <stop offset="0.55" stopColor={p.b} />
          <stop offset="1" stopColor={p.stain} />
        </radialGradient>
        <linearGradient id={`${id}-shell`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F8E5A6" />
          <stop offset="0.5" stopColor="#D5A945" />
          <stop offset="1" stopColor="#8E6718" />
        </linearGradient>
        <radialGradient id={`${id}-worm`} cx="50%" cy="35%" r="80%">
          <stop offset="0" stopColor="#F6FAFC" />
          <stop offset="1" stopColor="#B4C6D5" />
        </radialGradient>
      </defs>

      <rect width={W} height={H} fill={`url(#${id}-bg)`} />
      <rect width={W} height={H} filter={`url(#${id}-mottle)`} />

      {/* detritos e células pequenas do fundo */}
      <g>
        {DEBRIS[kind].map((d, i) => (
          <circle
            key={i}
            cx={d.x}
            cy={d.y}
            r={d.r}
            fill={p.a}
            fillOpacity={d.o}
            stroke={p.stain}
            strokeOpacity={d.o + 0.15}
            strokeWidth="1.4"
          />
        ))}
      </g>

      {kind === "cysts" && <Cysts id={id} detail={detail} deep={p.deep} stain={p.stain} />}
      {kind === "nematode" && <Nematode id={id} detail={detail} deep={p.deep} stain={p.stain} />}
      {kind === "giardia" && <Giardia id={id} detail={detail} deep={p.deep} stain={p.stain} />}
      {kind === "egg" && <Egg id={id} detail={detail} deep={p.deep} />}

      <rect width={W} height={H} filter={`url(#${id}-grain)`} opacity="0.5" />
      <rect width={W} height={H} fill={`url(#${id}-vig)`} />
    </svg>
  );
}

interface PartProps {
  id: string;
  detail: boolean;
  deep: string;
  stain?: string;
}

/** Aglomerado de corpos arredondados (cistos/ovos pequenos) com grânulos internos. */
function Cysts({ id, detail, deep, stain }: PartProps) {
  const bodies = [
    { x: 190, y: 150, r: 74 },
    { x: 360, y: 120, r: 58 },
    { x: 420, y: 275, r: 78 },
    { x: 215, y: 305, r: 52 },
    { x: 95, y: 260, r: 36 },
  ];
  const granuleRng = rng(91);
  return (
    <g>
      {bodies.map((b, i) => (
        <g key={i}>
          <circle cx={b.x} cy={b.y} r={b.r} fill={`url(#${id}-body)`} stroke={deep} strokeWidth="3.5" />
          <circle cx={b.x} cy={b.y} r={b.r - 9} fill="none" stroke={stain} strokeOpacity="0.55" strokeWidth="2" />
          {Array.from({ length: 4 }, (_, k) => {
            const a = granuleRng() * Math.PI * 2;
            const d = granuleRng() * b.r * 0.5;
            return (
              <circle
                key={k}
                cx={r2(b.x + Math.cos(a) * d)}
                cy={r2(b.y + Math.sin(a) * d)}
                r={r2(b.r * (0.08 + granuleRng() * 0.07))}
                fill={deep}
                fillOpacity="0.85"
              />
            );
          })}
          {detail &&
            Array.from({ length: 22 }, (_, k) => {
              const a = granuleRng() * Math.PI * 2;
              const d = Math.sqrt(granuleRng()) * (b.r - 12);
              return (
                <circle
                  key={`d${k}`}
                  cx={r2(b.x + Math.cos(a) * d)}
                  cy={r2(b.y + Math.sin(a) * d)}
                  r={r2(1.6 + granuleRng() * 2.2)}
                  fill={stain}
                  fillOpacity="0.8"
                />
              );
            })}
        </g>
      ))}
    </g>
  );
}

/** Larva alongada, afilando para a cauda, com trato digestivo e estrias sob a lente. */
function Nematode({ id, detail, deep }: PartProps) {
  // Curva dividida em trechos para afinar o corpo até a cauda.
  const segments = [
    { d: "M-20 322 C 70 190, 150 200, 215 262", w: 54 },
    { d: "M215 262 C 270 312, 330 330, 390 250", w: 46 },
    { d: "M390 250 C 440 184, 500 150, 548 168", w: 36 },
    { d: "M548 168 C 575 178, 590 196, 612 190", w: 22 },
  ];
  return (
    <g strokeLinecap="round" strokeLinejoin="round" fill="none">
      <g transform="translate(0 6)" opacity="0.25">
        {segments.map((s, i) => (
          <path key={i} d={s.d} stroke={deep} strokeWidth={s.w + 8} />
        ))}
      </g>
      {segments.map((s, i) => (
        <path key={`o${i}`} d={s.d} stroke="#4C5E70" strokeWidth={s.w + 6} />
      ))}
      {segments.map((s, i) => (
        <path key={`f${i}`} d={s.d} stroke={`url(#${id}-worm)`} strokeWidth={s.w} />
      ))}
      {segments.map((s, i) => (
        <path key={`g${i}`} d={s.d} stroke="#6F8296" strokeWidth={Math.max(3, s.w * 0.14)} strokeOpacity="0.8" />
      ))}
      {segments.slice(0, 3).map((s, i) => (
        <path key={`h${i}`} d={s.d} stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth={s.w * 0.22} transform="translate(0 -9)" />
      ))}
      {detail &&
        segments.map((s, i) => (
          <path
            key={`s${i}`}
            d={s.d}
            stroke="#4C5E70"
            strokeOpacity="0.6"
            strokeWidth={s.w - 4}
            strokeDasharray="1.6 7"
            strokeLinecap="butt"
          />
        ))}
    </g>
  );
}

/** Trofozoíto de Giardia: corpo em pera, dois núcleos, disco adesivo e flagelos (esquema simplificado). */
function Giardia({ id, detail, deep, stain }: PartProps) {
  // Quatro pares: ventral, posterolateral e caudal, saindo da metade posterior.
  const flagella = [
    "M262 352 C 244 372, 270 386, 250 404 C 242 412, 246 416, 244 420",
    "M338 352 C 356 372, 330 386, 350 404 C 358 412, 354 416, 356 420",
    "M232 322 C 204 346, 214 366, 186 380 C 170 388, 160 396, 148 396",
    "M368 322 C 396 346, 386 366, 414 380 C 430 388, 440 396, 452 396",
    "M290 370 C 284 392, 300 402, 292 420",
    "M310 370 C 316 392, 300 402, 308 420",
    "M246 338 C 232 360, 244 372, 226 392",
    "M354 338 C 368 360, 356 372, 374 392",
  ];
  return (
    <g strokeLinecap="round" strokeLinejoin="round" transform="translate(52 34) scale(0.83)">
      <g fill="none" stroke={stain} strokeWidth="3.6" strokeOpacity="0.9">
        {flagella.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <path
        d="M300 62 C 392 62, 436 146, 418 238 C 404 308, 346 352, 300 372 C 254 352, 196 308, 182 238 C 164 146, 208 62, 300 62 Z"
        fill={`url(#${id}-body)`}
        stroke={deep}
        strokeWidth="3.2"
      />
      {/* disco adesivo */}
      <circle cx="300" cy="190" r="104" fill="none" stroke={deep} strokeOpacity="0.28" strokeWidth="3" strokeDasharray="2 9" />
      {/* axonemas */}
      <path d="M300 150 L300 360" stroke={deep} strokeOpacity="0.55" strokeWidth="3" fill="none" />
      <path d="M278 160 C 262 230, 280 300, 300 352" stroke={deep} strokeOpacity="0.35" strokeWidth="2.5" fill="none" />
      <path d="M322 160 C 338 230, 320 300, 300 352" stroke={deep} strokeOpacity="0.35" strokeWidth="2.5" fill="none" />
      {/* núcleos */}
      {[
        [254, 148],
        [346, 148],
      ].map(([x, y], i) => (
        <g key={i}>
          <ellipse cx={x} cy={y} rx="28" ry="34" fill={stain} fillOpacity="0.38" stroke={deep} strokeWidth="2.4" />
          <circle cx={x + (x < 300 ? 4 : -4)} cy={y + 3} r="6.5" fill={deep} fillOpacity="0.9" />
          {detail && <circle cx={x - 11} cy={y - 14} r="3.2" fill={stain} />}
        </g>
      ))}
      {/* corpos medianos */}
      <ellipse cx="278" cy="296" rx="6.5" ry="17" fill={deep} fillOpacity="0.75" transform="rotate(24 278 296)" />
      <ellipse cx="322" cy="300" rx="6.5" ry="17" fill={deep} fillOpacity="0.75" transform="rotate(-24 322 300)" />
      {detail &&
        Array.from({ length: 36 }, (_, k) => {
          const r = rng(7 + k);
          return (
            <circle
              key={k}
              cx={r2(228 + r() * 144)}
              cy={r2(92 + r() * 250)}
              r={r2(1.4 + r() * 2)}
              fill={deep}
              fillOpacity="0.5"
            />
          );
        })}
    </g>
  );
}

/** Ovo de casca espessa, com camadas e conteúdo granular. */
function Egg({ id, detail, deep }: PartProps) {
  const granules = rng(5);
  return (
    <g transform="rotate(-18 300 210)">
      <ellipse cx="300" cy="214" rx="188" ry="112" fill="#000" opacity="0.14" transform="translate(0 8)" />
      <ellipse cx="300" cy="210" rx="188" ry="112" fill={`url(#${id}-shell)`} stroke={deep} strokeWidth="4" />
      <ellipse cx="300" cy="210" rx="170" ry="94" fill="none" stroke="#FFF3C8" strokeOpacity="0.8" strokeWidth="3" />
      <ellipse cx="300" cy="210" rx="150" ry="76" fill="#E7C46A" stroke="#8E6718" strokeOpacity="0.8" strokeWidth="2.5" />
      <ellipse cx="300" cy="210" rx="150" ry="76" fill="none" />
      {Array.from({ length: detail ? 70 : 34 }, (_, k) => {
        const a = granules() * Math.PI * 2;
        const d = Math.sqrt(granules());
        return (
          <circle
            key={k}
            cx={r2(300 + Math.cos(a) * d * 134)}
            cy={r2(210 + Math.sin(a) * d * 62)}
            r={r2(3 + granules() * 8)}
            fill="#8E6718"
            fillOpacity={r2(0.28 + granules() * 0.35)}
          />
        );
      })}
      <path d="M206 168 C 250 140, 360 140, 396 170" fill="none" stroke="#FFF7DA" strokeOpacity="0.8" strokeWidth="5" strokeLinecap="round" />
    </g>
  );
}
