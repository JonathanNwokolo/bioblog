import Link from "next/link";
import { site } from "@/content/site";
import { LensField } from "./LensField";
import { PortraitSlot } from "./PortraitSlot";
import styles from "./Hero.module.css";

const CREDIT =
  "Microscopia ilustrativa de desenvolvimento. Passe o ponteiro ou toque para explorar com a lente.";

/**
 * Seção 01: Capa editorial Microcosmos — Além das Lentes.
 *
 * Composição reconstruída aproximando da referência aprovada:
 * - Centro: retrato editorial de cientista com microscópio de pesquisa (placeholder IA de alta fidelidade).
 * - Fundo: halo luminoso mint suave com reflexo lilás.
 * - Órbita: 3 cards microscópicos com lâminas reais e lente interativa.
 * - Selo circular giratório e anotação manuscrita editorial ("Pequenos organismos, grandes perguntas.").
 * - Lado esquerdo: tipografia editorial forte, CTAs claros, identificação da autora e métricas.
 */
export function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-titulo">
      <div className={`container ${styles.grid}`}>
        <div className={styles.copy}>
          <p className={`pill ${styles.eyebrow}`}>
            <span className={styles.dot} aria-hidden="true" />
            Parasitologia em foco
          </p>

          <h1 id="hero-titulo" className={styles.title}>
            <span className={styles.line}>Existe um</span>{" "}
            <span className={styles.line}>universo invisível</span>{" "}
            <span className={styles.line}>além das lentes.</span>
          </h1>

          <p className={styles.lede}>
            Aqui compartilho descobertas, histórias e curiosidades da parasitologia, mostrando como
            os pequenos organismos revelam grandes histórias sobre a vida.
          </p>

          <div className={styles.actions}>
            <Link href="/#diario" className="btn btn--mint">
              Explorar o universo
              <span className={styles.ctaArrow} aria-hidden="true">→</span>
            </Link>
            <Link href="/#trajetoria" className="btn btn--outline">
              Sobre mim
            </Link>
          </div>

          <div className={styles.metaRow}>
            <p className={styles.author}>
              <span className={styles.authorName}>{site.author.name}</span>
              <span className={styles.authorRole}>
                {site.author.role}, {site.author.field.toLowerCase()}
              </span>
            </p>

            <div className={styles.stats} aria-label="Métricas do projeto">
              <div className={styles.statItem}>
                <span className={styles.statNumber}>+100</span>
                <span className={styles.statLabel}>pessoas inspiradas</span>
              </div>
              <span className={styles.statDivider} aria-hidden="true" />
              <div className={styles.statItem}>
                <span className={styles.statNumber}>+50</span>
                <span className={styles.statLabel}>conteúdos publicados</span>
              </div>
              <span className={styles.statDivider} aria-hidden="true" />
              <div className={styles.statItem}>
                <span className={styles.statNumber}>1</span>
                <span className={styles.statLabel}>mesmo propósito</span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.stage} aria-label="Composição visual editorial com microscopia">
          {/* Halo luminoso mint suave de fundo */}
          <div className={styles.halo} aria-hidden="true" />

          {/* Esferas biológicas flutuantes sutis */}
          <span className={`${styles.orb} ${styles.orbA}`} aria-hidden="true" />
          <span className={`${styles.orb} ${styles.orbB}`} aria-hidden="true" />
          <span className={`${styles.orb} ${styles.orbC}`} aria-hidden="true" />
          <span className={`${styles.orb} ${styles.orbD}`} aria-hidden="true" />
          <span className={`${styles.orb} ${styles.orbE}`} aria-hidden="true" />

          {/* Retrato dominante da pesquisadora ao microscópio de pesquisa */}
          <div className={styles.portrait}>
            <PortraitSlot />
          </div>

          {/* Card A: Cistos / formas celulares coradas (topo esquerdo) */}
          <div className={`${styles.fragment} ${styles.fragA}`}>
            <LensField
              kind="cysts"
              imageSrc="/images/hero/microscopy-cysts.jpg"
              label="Campo microscópico: cistos e corpos celulares corados em violeta brilhante."
              credit={CREDIT}
              style={{ "--delay": "120ms" } as React.CSSProperties}
            />
          </div>

          {/* Selo circular giratório: Ciência • Curiosidade • Impacto • Saúde */}
          <div className={styles.badgeWrapper} aria-hidden="true">
            <svg className={styles.badge} viewBox="0 0 120 120" focusable="false">
              <defs>
                <path id="hero-badge-path" d="M60 60 m-46 0 a46 46 0 1 1 92 0 a46 46 0 1 1 -92 0" />
              </defs>
              <text>
                <textPath href="#hero-badge-path" startOffset="0" textLength="289" lengthAdjust="spacing">
                  CIÊNCIA • CURIOSIDADE • IMPACTO • SAÚDE •
                </textPath>
              </text>
            </svg>
          </div>

          {/* Card B: Larva de helminto / nematódeo (topo direito) */}
          <div className={`${styles.fragment} ${styles.fragB}`}>
            <LensField
              kind="nematode"
              imageSrc="/images/hero/microscopy-larva.jpg"
              label="Campo microscópico: larva alongada de helminto com anatomia interna."
              credit={CREDIT}
              style={{ "--delay": "260ms" } as React.CSSProperties}
            />
          </div>

          {/* Anotação manuscrita editorial com seta curva */}
          <div className={styles.noteBox} aria-hidden="true">
            <svg viewBox="0 0 76 44" className={styles.arrow} focusable="false">
              <path
                d="M68 6 C 48 2, 22 10, 8 36 M8 36 l2 -15 M8 36 l14 -6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className={styles.noteText}>Pequenos organismos, grandes perguntas.</p>
          </div>

          {/* Card C: Giardia lamblia trofozoíto (canto inferior direito) */}
          <div className={`${styles.fragment} ${styles.fragC}`}>
            <LensField
              kind="giardia"
              imageSrc="/images/hero/microscopy-giardia.jpg"
              label="Campo microscópico: Giardia lamblia trofozoíto corado em magenta com discos e flagelos."
              credit={CREDIT}
              style={{ "--delay": "400ms" } as React.CSSProperties}
            />
          </div>

          <p className={styles.caption}>
            Campos microscópicos ilustrativos de desenvolvimento. Explore com a lente ou use o teclado.
          </p>
        </div>
      </div>
    </section>
  );
}
