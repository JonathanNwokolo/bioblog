import Link from "next/link";
import styles from "./Map.module.css";

interface OndeVivemHeroProps {
  defaultValue?: string;
}

const HERO_EXAMPLES = [
  { name: "Trypanosoma cruzi" },
  { name: "Giardia duodenalis" },
  { name: "Leishmania infantum" },
  { name: "Plasmodium falciparum" },
];

export function OndeVivemHero({ defaultValue }: OndeVivemHeroProps) {
  return (
    <section className={styles.hero} aria-labelledby="map-hero-title">
      <div className={styles.heroBackdrop} aria-hidden="true" />
      <div className={`container ${styles.heroContainer}`}>
        <div className={styles.heroLayout}>
          <div className={styles.heroMain}>
            <div className={styles.heroEyebrow}>ONDE VIVEM?</div>

            <h1 id="map-hero-title" className={styles.heroTitle}>
              Explorando a vida no planeta
            </h1>

            <p className={styles.heroTagline}>
              Registros reais de ocorrência no mundo todo.
            </p>

            <p className={styles.heroDesc}>
              Descubra onde organismos microscópicos e outros seres vivos foram documentados na natureza, com base em dados do GBIF.
            </p>

            <form className={styles.searchCapsule} action="/onde-vivem" method="get" role="search" aria-label="Buscar organismo no mapa">
              <span className={styles.searchIcon} aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                id="map-hero-search-input"
                name="q"
                type="search"
                autoComplete="off"
                spellCheck={false}
                defaultValue={defaultValue}
                placeholder="Buscar um organismo (nome científico ou popular)..."
                aria-label="Nome científico do organismo"
                className={styles.searchInput}
              />
              <button type="submit" className={styles.searchSubmit} aria-label="Buscar ocorrências">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </form>

            <div className={styles.heroExamples}>
              <span className={styles.examplesLabel}>Exemplos:</span>
              {HERO_EXAMPLES.map((ex, i) => (
                <span key={ex.name}>
                  <Link href={`/onde-vivem?q=${encodeURIComponent(ex.name)}`} className={styles.exampleLink} lang="la">
                    {ex.name}
                  </Link>
                  {i < HERO_EXAMPLES.length - 1 && <span className={styles.exampleSep} aria-hidden="true">·</span>}
                </span>
              ))}
            </div>
          </div>

          {/* Card Flutuante de Estatística Global GBIF */}
          <div className={styles.heroStatBadge}>
            <div className={styles.statBadgeHeader}>
              <span className={styles.statBadgeIcon} aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </span>
              <a
                href="https://www.gbif.org"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.statBadgeLink}
                aria-label="Abrir portal oficial da GBIF em nova aba"
                title="Conhecer o GBIF"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </a>
            </div>
            <div className={styles.statBadgeNumber}>2.6 bilhões</div>
            <p className={styles.statBadgeLabel}>
              de registros de ocorrência em todo o mundo no GBIF
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
