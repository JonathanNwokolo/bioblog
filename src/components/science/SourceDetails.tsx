import type { ReactNode } from "react";
import type { Provenance } from "@/lib/science/types";
import { formatRetrieved } from "@/lib/science/present";
import styles from "./Science.module.css";

interface SourceDetailsProps {
  provenance: Provenance;
  /** Limitações específicas da experiência, em linguagem simples. */
  limitations: ReactNode;
  /** Linhas extras de procedência (ex.: contagens). */
  extra?: Array<{ label: string; value: ReactNode }>;
  summary?: string;
  /** Aberto por padrão (usado quando a limitação é essencial para a leitura). */
  open?: boolean;
}

/**
 * Um único controle "Fonte e limitações" por bloco científico (docs/phase2-scientific-content-
 * architecture.md §7). `<details>` nativo: operável por teclado, expõe estado expandido e mantém
 * a atribuição acessível sem hover.
 */
export function SourceDetails({ provenance, limitations, extra = [], summary = "Fonte e limitações", open }: SourceDetailsProps) {
  const ids = provenance.sourceRecordIds;
  return (
    <details className={styles.source} open={open}>
      <summary>{summary}</summary>
      <div className={styles.sourceBody}>
        <div>{limitations}</div>
        <dl>
          <dt>Fonte</dt>
          <dd>{provenance.attribution}</dd>
          <dt>Registro</dt>
          <dd>
            <a href={provenance.sourceUrl} target="_blank" rel="noopener noreferrer">
              Abrir na fonte original<span className="visually-hidden"> (abre em nova aba)</span>
            </a>
            {ids.length > 0 && (
              <>
                {" "}
                <span>
                  ({ids.length === 1 ? "identificador" : "identificadores"}: {ids.slice(0, 6).join(", ")}
                  {ids.length > 6 ? "…" : ""})
                </span>
              </>
            )}
          </dd>
          <dt>Consultado em</dt>
          <dd>
            <time dateTime={provenance.fetchedAt}>{formatRetrieved(provenance.fetchedAt)}</time>
          </dd>
          {provenance.licenceOrRights && (
            <>
              <dt>Direitos</dt>
              <dd>{provenance.licenceOrRights}</dd>
            </>
          )}
          {extra.map((row) => (
            <div key={row.label} style={{ display: "contents" }}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </details>
  );
}
