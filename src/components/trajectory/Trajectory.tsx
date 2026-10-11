import { site } from "@/content/site";
import { trajectory } from "@/content/trajectory";
import { Media } from "@/components/ui/Media";
import { ArrowRight } from "@/components/ui/icons";
import styles from "./Trajectory.module.css";

/**
 * Seção 02: linha do tempo profissional.
 *
 * Única seção com numeração, porque os marcos são uma sequência real. Os dados
 * vêm de `src/content/trajectory.ts` (separados da apresentação). Marcos
 * `placeholder` mostram selo "Pendente" e nunca texto que pareça verdadeiro.
 */
export function Trajectory() {
  const hasPending = trajectory.some((entry) => entry.status !== "verified");

  return (
    <section id="trajetoria" className={styles.section} aria-labelledby="trajetoria-titulo">
      <div className="container">
        <header className={styles.header}>
          <div className={styles.headerText}>
            <h2 id="trajetoria-titulo" className={styles.title}>
              Minha trajetória
            </h2>
            <p className={styles.lede}>
              Uma jornada movida pela curiosidade sobre o invisível e pelo desejo de transformar
              conhecimento em impacto real.
            </p>
            {hasPending && (
              <p className={styles.pendingNote}>
                <span className="seal">Marcos pendentes</span>
                <span>A autora ainda vai informar formação, atuação e datas. Nada foi inventado.</span>
              </p>
            )}
          </div>

          <a
            className="btn btn--outline"
            href={site.linkedin.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            Ver perfil no LinkedIn
            <ArrowRight />
            <span className="visually-hidden"> (abre em nova aba)</span>
          </a>
        </header>

        <ol className={styles.timeline}>
          {trajectory.map((entry, index) => {
            const pending = entry.status !== "verified";
            return (
              <li key={entry.id} className={styles.item} data-pending={pending}>
                <span className={styles.dot} aria-hidden="true" />
                <p className={styles.meta}>
                  <span className={styles.index} aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className={styles.period}>{entry.period ?? "Período a informar"}</span>
                </p>

                <h3 className={styles.kind}>{entry.title ?? entry.kind}</h3>
                {entry.institution && <p className={styles.institution}>{entry.institution}</p>}

                <p className={styles.description}>
                  {entry.description ?? "Ainda não informado pela autora."}
                </p>

                <div className={styles.media}>
                  <Media
                    media={entry.media}
                    emptyLabel={`Imagem a ser enviada: ${entry.kind.toLowerCase()}`}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
