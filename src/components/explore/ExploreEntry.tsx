import Link from "next/link";
import { ArrowRight } from "@/components/ui/icons";
import { ExploreMount } from "./ExploreMount";
import styles from "./Explore.module.css";

/**
 * Seção 05: entrada editorial para "Explore o Invisível".
 *
 * A experiência cinematográfica é fixa e será entregue em fase própria; os
 * organismos ainda não foram escolhidos pela autora e NÃO são inventados aqui.
 * Esta seção faz a transição, apresenta a composição de entrada e reserva o
 * ponto de montagem (`ExploreMount`). Nenhum código 3D é carregado.
 */
export function ExploreEntry() {
  return (
    <section
      id="explore"
      className={`${styles.section} on-dark`}
      aria-labelledby="explore-titulo"
    >
      <div className={`container ${styles.grid}`}>
        <div className={styles.copy}>
          <h2 id="explore-titulo" className={styles.title}>
            <span className={styles.titleLine}>Explore</span>{" "}
            <span className={styles.titleLine}>o invisível</span>
          </h2>
          <p className={styles.lede}>
            Imagens, histórias e ciência para revelar a beleza e a complexidade da vida
            microscópica. Porque entender o invisível é também cuidar do que nos conecta.
          </p>

          <p className={styles.status}>
            <span className={styles.statusDot} aria-hidden="true" />
            Experiência em preparação
          </p>

          <dl className={styles.facts}>
            <div>
              <dt>Organismos</dt>
              <dd>a definir com a autora</dd>
            </div>
            <div>
              <dt>Narrativa</dt>
              <dd>original, em desenvolvimento</dd>
            </div>
          </dl>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <Link href="/explorar" className="btn btn--mint">
              Iniciar jornada 3D
              <ArrowRight />
            </Link>
            <Link href="/#diario" className="btn btn--outline">
              Enquanto isso, leia o diário
              <ArrowRight />
            </Link>
          </div>
        </div>

        <div className={styles.stage}>
          <ExploreMount />
          <p className={`note ${styles.annotation}`}>
            O invisível também faz parte de nós.
            <svg viewBox="0 0 80 50" className={styles.arrow} aria-hidden="true" focusable="false">
              <path
                d="M70 6 C 50 4, 22 14, 10 40 M10 40 l1 -15 M10 40 l14 -7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </p>
        </div>
      </div>
    </section>
  );
}
