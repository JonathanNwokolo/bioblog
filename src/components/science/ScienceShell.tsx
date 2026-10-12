import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./Science.module.css";

export type ScienceSection = "atlas" | "laboratorio" | "mapa" | "hub";

const SECTIONS: Array<{ id: ScienceSection; href: string; label: string }> = [
  { id: "atlas", href: "/atlas", label: "Atlas do Invisível" },
  { id: "laboratorio", href: "/laboratorio", label: "Laboratório Interativo" },
  { id: "mapa", href: "/onde-vivem", label: "Onde vivem?" },
];

interface ShellProps {
  active: ScienceSection;
  title?: ReactNode;
  lede?: ReactNode;
  children: ReactNode;
  /** `id` do h1, para `aria-labelledby` das regiões. */
  titleId?: string;
  /** Hero cinematográfico de largura completa (Fase 2.2.1) */
  hero?: ReactNode;
}

/** Estrutura comum das experiências científicas: sub-navegação, título e área de conteúdo. */
export function ScienceShell({ active, title, lede, children, titleId = "ciencia-titulo", hero }: ShellProps) {
  if (hero) {
    return (
      <div className={styles.pageCinematic}>
        <div className={styles.subnavBar}>
          <div className="container">
            <nav aria-label="Experiências científicas" className={styles.subnavClean}>
              <ul>
                <li>
                  <Link href="/ciencia" aria-current={active === "hub" ? "page" : undefined}>
                    Visão geral
                  </Link>
                </li>
                {SECTIONS.map((section) => (
                  <li key={section.id}>
                    <Link href={section.href} aria-current={active === section.id ? "page" : undefined}>
                      {section.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>

        {hero}

        <div className={`container ${styles.cinematicContent}`}>{children}</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={`container ${styles.top}`}>
        <nav aria-label="Experiências científicas" className={styles.subnav}>
          <ul>
            <li>
              <Link href="/ciencia" aria-current={active === "hub" ? "page" : undefined}>
                Visão geral
              </Link>
            </li>
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <Link href={section.href} aria-current={active === section.id ? "page" : undefined}>
                  {section.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <header className={styles.heading}>
          <h1 id={titleId} className={styles.title}>
            {title}
          </h1>
          <p className={styles.lede}>{lede}</p>
        </header>
      </div>

      <div className="container">{children}</div>
    </div>
  );
}
