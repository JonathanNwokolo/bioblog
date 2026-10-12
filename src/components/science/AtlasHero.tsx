import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./Atlas.module.css";

interface AtlasHeroProps {
  scientificName?: string;
  rank?: string | null;
  subtitle?: string | ReactNode;
  defaultValue?: string;
}

const HERO_EXAMPLES = [
  { name: "Giardia duodenalis" },
  { name: "Plasmodium falciparum" },
  { name: "Leishmania infantum" },
];

export function AtlasHero({ scientificName, subtitle, defaultValue }: AtlasHeroProps) {
  const isSelected = Boolean(scientificName);

  return (
    <section className={styles.hero} aria-labelledby="atlas-hero-title">
      <div className={styles.heroBackdrop} aria-hidden="true" />
      <div className={`container ${styles.heroContainer}`}>
        <div className={styles.heroContent}>
          <div className={styles.heroEyebrow}>ATLAS DO INVISÍVEL</div>

          <h1 id="atlas-hero-title" className={styles.heroTitle}>
            {isSelected ? <i lang="la">{scientificName}</i> : "Atlas do Invisível"}
          </h1>

          <p className={styles.heroSubtitle}>
            {subtitle ??
              (isSelected
                ? "Classificação taxonômica oficial catalogada no banco de dados do NCBI."
                : "De um nome científico à sua posição na árvore da vida. Pesquise organismos e veja sua linhagem biológica com base no NCBI Taxonomy.")}
          </p>

          <form className={styles.searchCapsule} action="/atlas" method="get" role="search" aria-label="Buscar espécie no Atlas">
            <span className={styles.searchIcon} aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              id="atlas-hero-search-input"
              name="q"
              type="search"
              autoComplete="off"
              spellCheck={false}
              defaultValue={defaultValue}
              placeholder={isSelected ? "Buscar outra espécie..." : "Buscar um organismo (ex: Trypanosoma cruzi)..."}
              aria-label="Nome científico ou TaxID"
              className={styles.searchInput}
            />
            <button type="submit" className={styles.searchSubmit} aria-label="Pesquisar táxon">
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
                <Link href={`/atlas?q=${encodeURIComponent(ex.name)}`} className={styles.exampleLink} lang="la">
                  {ex.name}
                </Link>
                {i < HERO_EXAMPLES.length - 1 && <span className={styles.exampleSep} aria-hidden="true">·</span>}
              </span>
            ))}
          </div>
        </div>

        <div className={styles.heroAttribution} aria-hidden="true">
          Representação artística baseada em referências científicas
        </div>
      </div>
    </section>
  );
}
