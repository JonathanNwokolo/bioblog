import type { MediaRef } from "@/content/types";
import { Specimen } from "@/components/specimens/Specimen";
import styles from "./Media.module.css";

interface MediaProps {
  media: MediaRef | null;
  /** Rótulo do espaço reservado quando não há mídia. */
  emptyLabel?: string;
  className?: string;
  loading?: "lazy" | "eager";
  /** `high` só para a imagem do LCP (primeira dobra). */
  fetchPriority?: "high" | "auto";
}

/**
 * Renderiza a mídia de um item de conteúdo: ilustração gerada em código,
 * fotografia real ou, na falta de ambas, um espaço reservado identificado.
 * Quem consome não precisa saber qual das três é.
 */
export function Media({ media, emptyLabel = "Imagem a ser enviada", className, loading = "lazy", fetchPriority }: MediaProps) {
  if (!media) {
    return (
      <div className={`${styles.empty} ${className ?? ""}`} role="img" aria-label={emptyLabel}>
        <span className={styles.emptyLabel}>{emptyLabel}</span>
      </div>
    );
  }

  if (media.kind === "photo") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={`${styles.photo} ${className ?? ""}`}
        src={media.src}
        width={media.width}
        height={media.height}
        alt={media.alt}
        loading={loading}
        decoding="async"
        fetchPriority={fetchPriority}
      />
    );
  }

  return <Specimen kind={media.specimen} title={media.alt} className={`${styles.art} ${className ?? ""}`} />;
}
