import styles from "./PortraitSlot.module.css";

const DEFAULT_SRC = "/images/hero/hero-portrait-cutout.webp";

interface PortraitSlotProps {
  src?: string;
  alt?: string;
  className?: string;
}

/**
 * Retrato da Ynara / Palco de desenvolvimento da Hero.
 *
 * Utiliza o retrato editorial temporário gerado por IA (pesquisadora com jaleco
 * e microscópio óptico de pesquisa) com recorte transparente e iluminação suave,
 * perfeitamente integrado ao halo mint e aos cards microscópicos.
 *
 * Quando a foto real e final for enviada pela autora, basta passar o novo caminho em `src`.
 */
export function PortraitSlot({
  src = DEFAULT_SRC,
  alt = "Ynara Raíssa Nwokolo observando lâmina ao microscópio de pesquisa (placeholder editorial)",
  className,
}: PortraitSlotProps) {
  return (
    <figure className={`${styles.slot} ${className ?? ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={styles.photo}
        src={src}
        srcSet={src === DEFAULT_SRC ? `/images/hero/hero-portrait-cutout-480.webp 480w, /images/hero/hero-portrait-cutout-640.webp 640w, ${DEFAULT_SRC} 896w` : undefined}
        sizes="(max-width: 560px) 86vw, (max-width: 959px) 540px, 560px"
        width={896}
        height={1200}
        alt={alt}
        fetchPriority="high"
        decoding="async"
      />
      <figcaption className="visually-hidden">{alt}</figcaption>
    </figure>
  );
}
