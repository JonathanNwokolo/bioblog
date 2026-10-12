import Image from "next/image";
import Link from "next/link";
import type { TaxonRecord } from "@/lib/science/ncbi/types";
import type { OrganismCuration } from "@/lib/science/editorial-curation";
import { ncbiTaxonUrl } from "@/lib/science/present";
import styles from "./Atlas.module.css";

interface TaxonReferencePanelProps {
  taxon: TaxonRecord;
  curation: OrganismCuration | null;
}

const DEFAULT_EXPLORE = [
  {
    name: "Trypanosoma brucei",
    taxId: "5692",
    relationship: "Relacionado · Mesmo gênero",
    thumbnail: "/images/science/atlas-hero.jpg",
  },
  {
    name: "Leishmania donovani",
    taxId: "5661",
    relationship: "Mesma família",
    thumbnail: "/images/science/ncbi-thumbnail.jpg",
  },
  {
    name: "Plasmodium vivax",
    taxId: "5855",
    relationship: "Outro protozoário de interesse",
    thumbnail: "/images/science/atlas-hero.jpg",
  },
];

export function TaxonReferencePanel({ taxon, curation }: TaxonReferencePanelProps) {
  const exploreItems =
    curation?.relatedTaxa && curation.relatedTaxa.length > 0
      ? curation.relatedTaxa
      : DEFAULT_EXPLORE;

  return (
    <aside className={styles.rightCol}>
      {/* Card: Ver no NCBI */}
      <section className={styles.ncbiCard} aria-labelledby="heading-ver-ncbi">
        <div className={styles.ncbiImageWrap}>
          <Image
            src="/images/science/ncbi-thumbnail.jpg"
            alt="Micrografia eletrônica de varredura representando estrutura celular microscópica"
            width={320}
            height={160}
            className={styles.ncbiImage}
          />
        </div>
        <div className={styles.ncbiBody}>
          <h2 id="heading-ver-ncbi" className={styles.ncbiTitle}>
            Ver no NCBI
          </h2>
          <p className={styles.ncbiDesc}>
            Acesse o registro completo desta espécie no banco de dados de taxonomia do NCBI.
          </p>
          <a
            href={ncbiTaxonUrl(taxon.taxId)}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.ncbiBtn}
          >
            Abrir no NCBI ↗
          </a>
        </div>
      </section>

      {/* Card: Explorar também */}
      <section className={styles.exploreCard} aria-labelledby="heading-explorar-tambem">
        <h2 id="heading-explorar-tambem" className={styles.exploreTitle}>
          Explorar também
        </h2>
        <ul className={styles.exploreList}>
          {exploreItems.map((item) => (
            <li key={item.taxId} className={styles.exploreItem}>
              <Link href={`/atlas/${item.taxId}`} className={styles.exploreLink}>
                <div className={styles.exploreThumbWrap}>
                  <Image
                    src={item.thumbnail ?? "/images/science/ncbi-thumbnail.jpg"}
                    alt=""
                    width={52}
                    height={52}
                    className={styles.exploreThumb}
                  />
                </div>
                <div className={styles.exploreText}>
                  <strong className={styles.exploreName} lang="la">
                    {item.name}
                  </strong>
                  <span className={styles.exploreRelation}>{item.relationship}</span>
                </div>
                <span className={styles.exploreArrow} aria-hidden="true">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
