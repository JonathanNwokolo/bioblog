import Link from "next/link";
import { primaryNav, site } from "@/content/site";
import { Brandmark } from "@/components/ui/Brandmark";
import { LinkedInIcon } from "@/components/ui/icons";
import styles from "./SiteFooter.module.css";

export function SiteFooter() {
  return (
    <footer className={styles.footer} id="contato" aria-labelledby="rodape-titulo">
      <div className={`container ${styles.inner}`}>
        <h2 id="rodape-titulo" className="visually-hidden">
          Rodapé e contato
        </h2>

        <div className={styles.identity}>
          <Brandmark />
          <p className={styles.attribution}>
            Publicação científica autoral de <strong>{site.author.name}</strong>,{" "}
            {site.author.role.toLowerCase()}, sobre {site.author.field.toLowerCase()} e o mundo
            invisível.
          </p>
        </div>

        <nav aria-label="Rodapé" className={styles.nav}>
          <ul>
            {primaryNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
            <li>
              <Link href="/diario" className={styles.archive}>
                Arquivo do diário
              </Link>
            </li>
          </ul>
        </nav>

        <div className={styles.contact}>
          <p className={styles.contactTitle}>Contato</p>
          <a
            className={`btn btn--outline ${styles.linkedin}`}
            href={site.linkedin.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            <LinkedInIcon />
            {site.linkedin.label}
            <span className="visually-hidden"> (abre em nova aba)</span>
          </a>
          {site.email ? (
            <a href={`mailto:${site.email}`} className={styles.email}>
              {site.email}
            </a>
          ) : (
            <p className={styles.pending}>
              <span className="seal">E-mail a ser informado</span>
            </p>
          )}
        </div>
      </div>

      <div className={`container ${styles.legal}`}>
        <p className={styles.disclaimer}>
          Conteúdo de divulgação científica, sem caráter de diagnóstico ou orientação médica. Em
          caso de sintomas, procure um profissional de saúde. Ilustrações e textos marcados como
          exemplo são provisórios e não são registros reais.
        </p>
        <p className={styles.copy}>
          © {site.copyrightYear} {site.brand}, {site.signature}. {site.author.name}.
        </p>
      </div>
    </footer>
  );
}
