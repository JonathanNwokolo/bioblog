import type { ReactNode } from "react";
import styles from "./Science.module.css";

interface StateNoteProps {
  title: string;
  children?: ReactNode;
  tone?: "info" | "error";
  /** Região viva: `alert` para falhas, `status` para estados neutros. */
  role?: "status" | "alert";
}

/** Estado explícito (vazio, erro, indisponível, ambíguo). Nunca preenche a lacuna com conteúdo inventado. */
export function StateNote({ title, children, tone = "info", role }: StateNoteProps) {
  const liveRole = role ?? (tone === "error" ? "alert" : "status");
  return (
    <div className={`${styles.note} ${tone === "error" ? styles.noteError : ""}`} role={liveRole}>
      <p className={styles.noteTitle}>{title}</p>
      {children && <div className={styles.noteBody}>{children}</div>}
    </div>
  );
}

export function LoadingNote({ label }: { label: string }) {
  return (
    <div className={styles.skeleton} role="status" aria-live="polite">
      <span className="visually-hidden">{label}</span>
      <div className={styles.skeletonBar} style={{ width: "60%" }} aria-hidden="true" />
      <div className={styles.skeletonBar} style={{ width: "90%" }} aria-hidden="true" />
      <div className={styles.skeletonBar} style={{ width: "74%" }} aria-hidden="true" />
    </div>
  );
}
