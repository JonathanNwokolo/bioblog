"use client";

import Link from "next/link";
import { CommentIcon, HeartIcon } from "@/components/ui/icons";
import { likeCount } from "@/lib/engagement";
import { pluralize } from "@/lib/format";
import { useEngagement } from "@/lib/use-engagement";
import styles from "./EngagementBar.module.css";

interface EngagementBarProps {
  slug: string;
  baseLikes: number;
  /** Destino do botão de comentários. Na página do post, ancora na própria lista. */
  commentsHref: string;
}

/**
 * Curtir e comentar. Ambos funcionam de verdade (persistem neste navegador);
 * não há servidor, e a página explica isso onde a interação acontece.
 */
export function EngagementBar({ slug, baseLikes, commentsHref }: EngagementBarProps) {
  const { engagement, toggleLike } = useEngagement(slug);
  const likes = likeCount(baseLikes, engagement);
  const comments = engagement.comments.length;

  return (
    <div className={styles.bar}>
      <button
        type="button"
        className={styles.like}
        aria-pressed={engagement.liked}
        onClick={toggleLike}
      >
        <HeartIcon filled={engagement.liked} className={styles.heart} />
        <span className="visually-hidden">
          {engagement.liked ? "Remover curtida. " : "Curtir. "}
        </span>
        <span aria-live="polite">
          <span aria-hidden="true">{likes}</span>
          <span className="visually-hidden">{pluralize(likes, "curtida", "curtidas")}</span>
        </span>
      </button>

      <Link href={commentsHref} className={styles.comment}>
        <CommentIcon />
        <span aria-hidden="true">{comments}</span>
        <span className="visually-hidden">
          {pluralize(comments, "comentário", "comentários")}. Ver comentários
        </span>
      </Link>
    </div>
  );
}
