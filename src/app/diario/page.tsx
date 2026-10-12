import type { Metadata } from "next";
import { PostPreview } from "@/components/diary/PostPreview";
import { safelyListPublishedPosts } from "@/lib/cms/repository";
import styles from "./index.module.css";

export const metadata: Metadata = {
  title: "Diário de Bancada",
  description: "Relatos, descobertas e olhares do dia a dia da parasitologia.",
};

export default async function DiaryIndexPage() {
  const { posts, error } = await safelyListPublishedPosts();
  return (
    <section className={styles.page} aria-labelledby="indice-titulo">
      <div className="container">
        <header className={styles.header}>
          <h1 id="indice-titulo" className={styles.title}>
            Diário de Bancada
          </h1>
          <p className={styles.lede}>
            Relatos, descobertas e olhares do dia a dia da parasitologia, em uma linguagem acessível
            para todos.
          </p>
          <p className={styles.note}>Curtidas e comentários continuam salvos somente neste navegador.</p>
        </header>

        <div className={styles.list}>
          {error ? <p role="status">{error}</p> : posts.length ? posts.map((post, index) => (
            <PostPreview key={post.id} post={post} variant="entry" headingLevel={2} priority={index === 0} />
          )) : <p>Ainda não há publicações no Diário de Bancada.</p>}
        </div>
      </div>
    </section>
  );
}
