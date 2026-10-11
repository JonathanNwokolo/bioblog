import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CommentsPanel } from "@/components/diary/CommentsPanel";
import { EngagementBar } from "@/components/diary/EngagementBar";
import { ArrowRight } from "@/components/ui/icons";
import { Media } from "@/components/ui/Media";
import { featuredOrganism } from "@/content/featured-organism";
import { getPost, posts } from "@/content/posts";
import { formatDate } from "@/lib/format";
import styles from "./post.module.css";

export function generateStaticParams() {
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  return post ? { title: post.title, description: post.excerpt } : {};
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const isPlaceholder = post.status !== "verified";
  const isFeatured = post.slug === featuredOrganism.relatedPostSlug;

  return (
    <article className={styles.page}>
      <div className={`container ${styles.inner}`}>
        <nav aria-label="Trilha" className={styles.back}>
          <Link href="/diario">Diário de Bancada</Link>
        </nav>

        <header className={styles.header}>
          <p className={styles.meta}>
            <span className="pill">{post.tag.label}</span>
            {post.tag.organism && <i className={styles.organism}>{post.tag.organism}</i>}
            <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
          </p>
          <h1 className={styles.title}>{post.title}</h1>
          <p className={styles.excerpt}>{post.excerpt}</p>
        </header>

        <figure className={styles.figure}>
          <div className={styles.media}>
            <Media media={post.media} loading="eager" />
          </div>
          <figcaption>{post.media.credit}</figcaption>
        </figure>

        <div className={styles.content}>
          {isPlaceholder && (
            <aside className={styles.notice} aria-label="Aviso sobre este conteúdo">
              <span className="seal">Post de exemplo</span>
              <p>
                Texto demonstrativo do protótipo, não escrito pela autora. Existe para testar leitura,
                curtidas e comentários e será substituído pelos textos da Ynara.
              </p>
            </aside>
          )}

          <div className={styles.prose}>
            {post.body.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>

          <div className={styles.engagement}>
            <EngagementBar slug={post.slug} baseLikes={post.baseLikes} commentsHref="#comentarios" />
          </div>

          {isFeatured && (
            <p className={styles.related}>
              <Link href="/#parasita" className="btn btn--outline">
                Ver o parasita em destaque
                <ArrowRight />
              </Link>
            </p>
          )}

          <CommentsPanel slug={post.slug} />
        </div>
      </div>
    </article>
  );
}
