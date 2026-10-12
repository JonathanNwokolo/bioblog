import Link from "next/link";
import { featuredOrganism as organism } from "@/content/featured-organism";
import { Media } from "@/components/ui/Media";
import { ArrowRight } from "@/components/ui/icons";
import styles from "./FeaturedParasite.module.css";

/**
 * Seção 04: Parasita em Destaque.
 *
 * Composição em três zonas (texto, placa, ficha) para contrastar com o
 * Diário (destaque + índice). O nome científico é o elemento tipográfico:
 * itálico por convenção de nomenclatura, não por enfeite. Conteúdo
 * provisório: ver `src/content/featured-organism.ts`.
 */
export function FeaturedParasite() {
  const provisional = organism.status !== "verified";

  return (
    <section id="parasita" className={styles.section} aria-labelledby="parasita-titulo">
      <div className={`container ${styles.grid}`}>
        <div className={styles.intro}>
          <h2 id="parasita-titulo" className={styles.title}>
            Parasita em destaque
          </h2>
          <p className={styles.lede}>
            Um organismo, muitas histórias. De perto, a biologia, o ciclo de vida e as curiosidades
            por trás dos parasitas que fazem parte do nosso mundo.
          </p>
          {provisional && (
            <p className={styles.provisional}>
              <span className="seal">Provisório</span>
              <span>{organism.provisionalNote}</span>
            </p>
          )}
        </div>

        <figure className={styles.plate}>
          <div className={styles.frame}>
            <Media media={organism.media} loading="lazy" />
            <span className={styles.badge}>Em destaque</span>
          </div>
          <figcaption>{organism.media.credit}</figcaption>
        </figure>

        <div className={styles.sheet}>
          <h3 className={styles.name}>
            <i lang="la">{organism.scientificName}</i>
          </h3>
          <p className={styles.common}>
            {organism.commonName ? `Nome comum: ${organism.commonName}. ` : ""}
            {organism.tagline}
          </p>
          <p className={styles.summary}>{organism.summary}</p>


          <Link href={`/diario/${organism.relatedPostSlug}`} className="btn btn--mint">
            Ler o conteúdo relacionado
            <ArrowRight />
          </Link>

          <p className={styles.science}>
            <span>Ver em dados oficiais:</span>
            <Link href={`/atlas?q=${encodeURIComponent(organism.scientificName)}`}>Classificação</Link>
            <Link href="/laboratorio?organismo=giardia-duodenalis">Microscopia</Link>
            <Link href={`/onde-vivem?q=${encodeURIComponent(organism.scientificName)}`}>Registros de ocorrência</Link>
          </p>
        </div>

        <dl className={styles.facts}>
          {organism.facts.map((fact) => (
            <div key={fact.label} className={styles.fact}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
