import Link from "next/link";
import { QUERY_LIMITS } from "@/lib/science/config";
import styles from "./Science.module.css";

interface ScienceSearchProps {
  action: string;
  label: string;
  placeholder: string;
  hint: string;
  defaultValue?: string;
  submitLabel: string;
  examples: Array<{ name: string; note?: string }>;
  /** `id` base para ligar rótulo, dica e campo. */
  idBase: string;
}

/**
 * Busca por nome científico via GET: funciona sem JavaScript, o endereço é compartilhável e o
 * navegador não envia nada além do texto digitado. O servidor valida de novo.
 */
export function ScienceSearch({ action, label, placeholder, hint, defaultValue, submitLabel, examples, idBase }: ScienceSearchProps) {
  return (
    <form className={styles.search} action={action} method="get" role="search" aria-label={label}>
      <label htmlFor={`${idBase}-q`}>{label}</label>
      <div className={styles.searchRow}>
        <input
          id={`${idBase}-q`}
          name="q"
          type="search"
          autoComplete="off"
          spellCheck={false}
          maxLength={QUERY_LIMITS.maxLength}
          minLength={QUERY_LIMITS.minLength}
          defaultValue={defaultValue}
          placeholder={placeholder}
          aria-describedby={`${idBase}-hint`}
        />
        <button type="submit" className="btn btn--mint">
          {submitLabel}
        </button>
      </div>
      <p id={`${idBase}-hint`} className={styles.hint}>
        {hint}
      </p>
      {examples.length > 0 && (
        <p className={styles.examples}>
          <span>Experimente:</span>
          {examples.map((example) => (
            <Link key={example.name} href={`${action}?q=${encodeURIComponent(example.name)}`} lang="la">
              {example.name}
              {example.note && <span className="visually-hidden"> ({example.note})</span>}
            </Link>
          ))}
        </p>
      )}
    </form>
  );
}
