import styles from "./PortraitSlot.module.css";

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
  src = "/images/hero/hero-portrait-cutout.png",
  alt = "Ynara Raíssa Nwokolo observando lâmina ao microscópio de pesquisa (placeholder editorial)",
  className,
}: PortraitSlotProps) {
  return (
    <figure className={`${styles.slot} ${className ?? ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.photo} src={src} alt={alt} />
      <figcaption className="visually-hidden">{alt}</figcaption>
    </figure>
  );
}
