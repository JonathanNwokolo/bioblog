import { splitDiary } from "@/content/posts";
import type { Post } from "@/content/types";
import { DiaryFeed } from "./DiaryFeed";
import { PostPreview } from "./PostPreview";
import styles from "./Diary.module.css";

interface DiaryProps {
  /**
   * Coleção de publicações. Por padrão vem de `src/content/posts`; um CMS futuro
   * pode entregar a mesma forma (`Post[]`). Rascunhos são ignorados e a ordem é
   * derivada aqui, então a ordem de chegada não importa.
   */
  posts: readonly Post[];
  error?: string | null;
}

/**
 * Seção 03: Diário de Bancada.
 *
 * Composição de periódico científico: um destaque em escala grande sobre uma
 * placa branca e, ao lado, um feed de entradas separadas por filetes. Não é
 * uma grade de cards iguais (decisão registrada em `docs/art-direction-decisions.md`).
 *
 * Destaque e feed derivam da mesma coleção: o destaque é a publicação mais
 * recente e o feed contém todas as demais, sem limite e sem repetição.
 */
export function Diary({ posts, error = null }: DiaryProps) {
  const { lead, archive } = splitDiary(posts);
  const hasPlaceholder = [lead, ...archive].some((post) => post && post.status !== "verified");

  return (
    <section id="diario" className={styles.section} aria-labelledby="diario-titulo">
      <div className="container">
        <header className={styles.header}>
          <div className={styles.headerText}>
            <h2 id="diario-titulo" className={styles.title}>
              Diário de Bancada
            </h2>
            <p className={styles.lede}>
              Relatos, descobertas e olhares do dia a dia da parasitologia, em uma linguagem
              acessível para todos.
            </p>
            {hasPlaceholder && (
              <p className={styles.note}>
                <span className="seal">Protótipo</span>
                <span>
                  Posts de exemplo. Curtidas e comentários funcionam, mas ficam salvos só neste
                  navegador.
                </span>
              </p>
            )}
          </div>
        </header>

        {error ? (
          <p className={styles.empty} role="status">{error}</p>
        ) : lead ? (
          <div className={styles.layout}>
            <div className={styles.lead}>
              <PostPreview post={lead} variant="lead" />
            </div>

            {archive.length > 0 ? (
              <DiaryFeed count={archive.length}>
                {archive.map((post) => (
                  <li key={post.id}>
                    <PostPreview post={post} variant="entry" />
                  </li>
                ))}
              </DiaryFeed>
            ) : (
              <p className={styles.waiting}>
                Esta é a primeira publicação do diário. As próximas entram aqui, da mais recente
                para a mais antiga.
              </p>
            )}
          </div>
        ) : (
          <p className={styles.empty}>
            Ainda não há publicações no diário. Quando a primeira for publicada, ela aparece aqui
            em destaque.
          </p>
        )}
      </div>
    </section>
  );
}
