/**
 * Microscópio em traço: desenho original e esquemático (não é foto nem modelo
 * de um aparelho específico). Integra o palco do hero e ancora a escala humana.
 */
export function MicroscopeLine({ className }: { className?: string }) {
  const stroke = "var(--ink)";
  return (
    <svg
      className={className}
      viewBox="0 0 420 520"
      fill="none"
      stroke={stroke}
      strokeWidth="4.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* braço */}
      <path
        d="M298 466 C 376 438, 398 336, 366 258 C 348 214, 304 188, 246 182"
        strokeWidth="34"
      />
      <path
        d="M298 466 C 376 438, 398 336, 366 258 C 348 214, 304 188, 246 182"
        stroke="var(--white)"
        strokeWidth="25"
      />
      {/* base */}
      <rect x="62" y="462" width="296" height="34" rx="17" fill="var(--white)" />
      {/* luminária sob a platina */}
      <rect x="196" y="392" width="92" height="52" rx="12" fill="var(--white)" />
      <path d="M214 418h56" stroke="var(--mint)" strokeWidth="8" />
      {/* platina */}
      <rect x="140" y="346" width="206" height="18" rx="7" fill="var(--white)" />
      {/* lâmina */}
      <rect x="178" y="332" width="124" height="14" rx="4" fill="var(--mint)" />
      {/* tubo inclinado */}
      <g transform="translate(206 118) rotate(-23)">
        <rect x="-18" y="-84" width="36" height="58" rx="9" fill="var(--white)" />
        <rect x="-24" y="-96" width="48" height="16" rx="8" fill="var(--white)" />
        <rect x="-30" y="-28" width="60" height="152" rx="14" fill="var(--white)" />
        <rect x="-40" y="116" width="80" height="18" rx="7" fill="var(--white)" />
        <rect x="-15" y="132" width="30" height="44" rx="7" fill="var(--white)" />
        <rect x="-10" y="174" width="20" height="12" rx="4" fill="var(--mint)" />
      </g>
      {/* parafuso micrométrico */}
      <circle cx="376" cy="318" r="22" fill="var(--white)" />
      <circle cx="376" cy="318" r="8" fill={stroke} stroke="none" />
    </svg>
  );
}
