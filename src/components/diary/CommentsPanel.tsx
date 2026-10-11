"use client";

import { useId, useRef, useState } from "react";
import { TrashIcon } from "@/components/ui/icons";
import { MAX_AUTHOR_LENGTH, MAX_COMMENT_LENGTH } from "@/lib/engagement";
import { formatDateTime, pluralize } from "@/lib/format";
import { useEngagement } from "@/lib/use-engagement";
import styles from "./CommentsPanel.module.css";

/**
 * Comentários de um post (PROTÓTIPO sem servidor).
 *
 * Funciona de verdade: publica, lista, persiste e remove, mas só neste
 * navegador. O aviso aparece junto do formulário, onde a pessoa decide
 * escrever.
 */
export function CommentsPanel({ slug }: { slug: string }) {
  const { engagement, addComment, removeComment } = useEngagement(slug);
  const [author, setAuthor] = useState("");
  const [text, setText] = useState("");
  const [status, setStatus] = useState<{ kind: "ok" | "error"; message: string } | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const nameId = useId();
  const textId = useId();
  const helpId = useId();

  const remaining = MAX_COMMENT_LENGTH - text.length;
  const comments = engagement.comments;

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = addComment(author, text);
    if (result.ok) {
      setText("");
      setStatus({ kind: "ok", message: "Comentário publicado neste navegador." });
      textRef.current?.focus();
    } else {
      setStatus({
        kind: "error",
        message:
          result.reason === "empty"
            ? "Escreva algo antes de publicar."
            : `O comentário passa de ${MAX_COMMENT_LENGTH} caracteres. Encurte o texto.`,
      });
      textRef.current?.focus();
    }
  };

  return (
    <section id="comentarios" className={styles.panel} aria-labelledby="comentarios-titulo">
      <h2 id="comentarios-titulo" className={styles.title}>
        Comentários
        <span className={styles.count}> {pluralize(comments.length, "comentário", "comentários")}</span>
      </h2>

      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <div className={styles.field}>
          <label htmlFor={nameId}>Seu nome (opcional)</label>
          <input
            id={nameId}
            type="text"
            value={author}
            maxLength={MAX_AUTHOR_LENGTH}
            autoComplete="nickname"
            onChange={(event) => setAuthor(event.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor={textId}>Comentário</label>
          <textarea
            id={textId}
            ref={textRef}
            rows={4}
            value={text}
            aria-describedby={helpId}
            aria-invalid={status?.kind === "error"}
            onChange={(event) => {
              setText(event.target.value);
              if (status?.kind === "error") setStatus(null);
            }}
          />
          <p id={helpId} className={styles.help}>
            Protótipo: o comentário fica salvo apenas neste navegador, sem servidor.
            <span className={remaining < 0 ? styles.over : undefined}>
              {" "}
              {remaining} caracteres restantes.
            </span>
          </p>
        </div>

        <div className={styles.submitRow}>
          <button type="submit" className="btn btn--mint">
            Publicar comentário
          </button>
          <p
            className={status?.kind === "error" ? styles.error : styles.ok}
            role={status?.kind === "error" ? "alert" : "status"}
          >
            {status?.message}
          </p>
        </div>
      </form>

      {comments.length === 0 ? (
        <p className={styles.empty}>Nenhum comentário ainda. Seja a primeira pessoa a comentar.</p>
      ) : (
        <ol className={styles.list}>
          {comments.map((comment) => (
            <li key={comment.id} className={styles.item}>
              <div className={styles.itemHead}>
                <p className={styles.author}>{comment.author || "Anônimo"}</p>
                <time dateTime={comment.createdAt} className={styles.time}>
                  {formatDateTime(comment.createdAt)}
                </time>
                <button
                  type="button"
                  className={styles.remove}
                  onClick={() => removeComment(comment.id)}
                >
                  <TrashIcon />
                  <span className="visually-hidden">
                    Remover comentário de {comment.author || "Anônimo"}
                  </span>
                </button>
              </div>
              <p className={styles.text}>{comment.text}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
