import Link from "next/link";
import { primaryNav } from "@/content/site";
import { Brandmark } from "@/components/ui/Brandmark";
import { ArrowRight } from "@/components/ui/icons";
import { MobileNav } from "./MobileNav";
import { NavLinks } from "./NavLinks";
import styles from "./SiteHeader.module.css";

export function SiteHeader() {
  return (
    <header className={styles.header} id="topo">
      <div className={`container ${styles.bar}`}>
        <Brandmark />

        <nav aria-label="Principal" className={styles.nav}>
          <NavLinks items={primaryNav} />
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
