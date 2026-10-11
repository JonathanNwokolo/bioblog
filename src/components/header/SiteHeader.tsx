import Link from "next/link";
import { primaryNav } from "@/content/site";
import { Brandmark } from "@/components/ui/Brandmark";
import { ArrowRight } from "@/components/ui/icons";
import { MobileNav } from "./MobileNav";
import styles from "./SiteHeader.module.css";

export function SiteHeader() {
  return (
    <header className={styles.header} id="topo">
      <div className={`container ${styles.bar}`}>
        <Brandmark />

        <nav aria-label="Principal" className={styles.nav}>
          <ul className={styles.list}>
            {primaryNav.map((item, index) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={styles.link}
                  aria-current={index === 0 ? "page" : undefined}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <Link href="/#contato" className={`btn btn--mint ${styles.cta}`}>
          Falar com a autora
          <ArrowRight />
        </Link>

        <MobileNav items={primaryNav} />
      </div>
    </header>
  );
}
