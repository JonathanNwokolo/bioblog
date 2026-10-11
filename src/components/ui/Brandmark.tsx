import Link from "next/link";
import { site } from "@/content/site";
import styles from "./Brandmark.module.css";

/** Marca gráfica provisória: aglomerado celular. Desenho final a definir com a proprietária. */
function Mark() {
  return (
    <svg viewBox="0 0 40 40" className={styles.mark} aria-hidden="true" focusable="false">
      <circle cx="13" cy="11" r="7.500" />
      <circle cx="29" cy="13" r="5" />
      <circle cx="22" cy="27" r="8.500" />
      <circle cx="7.500" cy="29" r="4.500" />
      <circle cx="34" cy="31" r="3" />
    </svg>
  );
}

export function Brandmark({ onDark = false }: { onDark?: boolean }) {
  return (
    <Link href="/#topo" className={`${styles.brand} ${onDark ? styles.onDark : ""}`}>
      <Mark />
      <span className={styles.words}>
        <span className={styles.name}>{site.brand}</span>{" "}
        <span className={styles.signature}>{site.signature}</span>
      </span>
    </Link>
  );
}
