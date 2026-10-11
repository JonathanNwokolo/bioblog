import type { Metadata } from "next";
import { PostPreview } from "@/components/diary/PostPreview";
import { posts } from "@/content/posts";
import styles from "./index.module.css";

export const metadata: Metadata = {
  title: "Diário de Bancada",
  description: "Relatos, descobertas e olhares do dia a dia da parasitologia.",
};

export default function DiaryIndexPage() {
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
          <p className={styles.note}>
            <span className="seal">Protótipo</span>
            <span>
              Posts de exemplo. Curtidas e comentários funcionam, mas ficam salvos só neste navegador.
            </span>
          </p>
        </header>

        <div className={styles.list}>
          {posts.map((post) => (
            <PostPreview key={post.id} post={post} variant="entry" />
          ))}
        </div>
      </div>
    </section>
  );
}
