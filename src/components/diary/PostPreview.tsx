import Link from "next/link";
import type { Post } from "@/content/types";
import { Media } from "@/components/ui/Media";
import { ArrowRight } from "@/components/ui/icons";
import { formatDate } from "@/lib/format";
import { EngagementBar } from "./EngagementBar";
import styles from "./PostPreview.module.css";

interface PostPreviewProps {
  post: Post;
  /** `lead`: destaque em grande escala. `entry`: entrada compacta do índice. */
  variant: "lead" | "entry";
}

/**
 * Prévia de um post do Diário de Bancada.
 *
 * Cada prévia traz: imagem, título, resumo, data, tag (categoria e organismo
 * opcional), ação de leitura, curtidas e comentários. O título é o link
 * principal; o card inteiro é clicável por área estendida, e os controles de
 * interação ficam acima dela.
 */
export function PostPreview({ post, variant }: PostPreviewProps) {
  const href = `/diario/${post.slug}`;
  const isPlaceholder = post.status !== "verified";
  const TitleTag = variant === "lead" ? "h3" : "h4";

  return (
    <article className={`${styles.post} ${styles[variant]}`}>
      <div className={styles.media}>
        <Media media={post.media} loading={variant === "lead" ? "eager" : "lazy"} />
        {isPlaceholder && <span className={styles.chip}>Ilustração de exemplo</span>}
      </div>

      <div className={styles.body}>
        <p className={styles.meta}>
          <span className="pill">{post.tag.label}</span>
          <time dateTime={post.publishedAt} className={styles.date}>
            {formatDate(post.publishedAt)}
          </time>
        </p>

        <TitleTag className={styles.title}>
          <Link href={href} className={styles.titleLink}>
            {post.title}
          </Link>
        </TitleTag>

        <p className={styles.excerpt}>{post.excerpt}</p>

        <div className={styles.actions}>
          <EngagementBar
            slug={post.slug}
            baseLikes={post.baseLikes}
            commentsHref={`${href}#comentarios`}
          />
          <span className={styles.read} aria-hidden="true">
            Ler o artigo
            <ArrowRight />
          </span>
        </div>
      </div>
    </article>
  );
}
