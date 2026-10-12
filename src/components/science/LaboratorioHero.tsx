import Link from "next/link";
import styles from "./Lab.module.css";

interface LaboratorioHeroProps {
  scientificName?: string;
  defaultValue?: string;
}

const HERO_EXAMPLES = [
  { name: "Trypanosoma cruzi", slug: "trypanosoma-cruzi" },
  { name: "Giardia duodenalis", slug: "giardia-duodenalis" },
  { name: "Plasmodium falciparum", slug: "plasmodium-falciparum" },
  { name: "Entamoeba histolytica", slug: "entamoeba-histolytica" },
];

export function LaboratorioHero({ scientificName, defaultValue }: LaboratorioHeroProps) {
  const isSelected = Boolean(scientificName);

  return (
    <section className={styles.hero} aria-labelledby="lab-hero-title">
      <div className={styles.heroBackdrop} aria-hidden="true" />
      <div className={`container ${styles.heroContainer}`}>
        <div className={styles.heroLayout}>
          <div className={styles.heroMain}>
            <div className={styles.heroEyebrow}>MICROSCOPIA & DIAGNÓSTICO DIGITAL</div>

            <h1 id="lab-hero-title" className={styles.heroTitle}>
              {isSelected ? (
                <>
                  Laboratório: <i lang="la">{scientificName}</i>
                </>
              ) : (
                "Laboratório Interativo"
              )}
            </h1>

            <p className={styles.heroSubtitle}>
              Explore micrografias de referência curadas em alta definição, identifique estruturas morfológicas diagnósticas e compreenda os critérios científicos de identificação parasitológica.
            </p>

            <form
              className={styles.searchCapsule}
              action="/laboratorio"
              method="get"
              role="search"
              aria-label="Buscar organismo no laboratório"
            >
              <span className={styles.searchIcon} aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                id="lab-hero-search-input"
                name="organismo"
                type="search"
                autoComplete="off"
                spellCheck={false}
                defaultValue={defaultValue}
                placeholder="Buscar organismo, lâmina ou estrutura..."
                aria-label="Nome do organismo ou termo"
                className={styles.searchInput}
              />
              <button type="submit" className={styles.searchSubmit} aria-label="Explorar lâmina">
                <span className={styles.searchSubmitText}>Explorar</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </form>

            <div className={styles.heroExamples}>
              <span className={styles.examplesLabel}>Lâminas em destaque:</span>
              {HERO_EXAMPLES.map((ex, i) => (
                <span key={ex.slug}>
                  <Link href={`/laboratorio?organismo=${ex.slug}`} className={styles.exampleLink} lang="la">
                    {ex.name}
                  </Link>
                  {i < HERO_EXAMPLES.length - 1 && <span className={styles.exampleSep} aria-hidden="true">·</span>}
                </span>
              ))}
            </div>
          </div>

          <div className={styles.heroSideCard} aria-hidden="true">
            <div className={styles.sideCardBadge}>
              <span className={styles.sideCardDot} />
              Coleção de Referência DPDx
            </div>
            <div className={styles.sideCardTitle}>Microscopia de Luz Transmitida</div>
            <p className={styles.sideCardDesc}>
              Preparados citológicos originais com colorações histoquímicas clássicas (Giemsa, Tricrômico, Lugol e H&E).
            </p>
            <div className={styles.sideCardMetrics}>
              <div className={styles.metricItem}>
                <span className={styles.metricValue}>1000×</span>
                <span className={styles.metricLabel}>Imersão</span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricValue}>10 µm</span>
                <span className={styles.metricLabel}>Escala</span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricValue}>DPDx</span>
                <span className={styles.metricLabel}>Curadoria</span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.heroAttribution} aria-hidden="true">
          Representação artística baseada em referências científicas · Micrografias autênticas do CDC DPDx
        </div>
      </div>
    </section>
  );
}
