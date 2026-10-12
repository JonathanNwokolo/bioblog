"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/content/types";
import styles from "./SiteHeader.module.css";

/** Rotas que pertencem a uma entrada do menu (a seção "Ciência interativa" cobre as três experiências). */
const SECTION_PREFIXES: Record<string, string[]> = {
  "/ciencia": ["/ciencia", "/atlas", "/laboratorio", "/onde-vivem"],
};

export function isCurrentNavItem(href: string, index: number, pathname: string): boolean {
  const path = href.split("#")[0] || "/";
  if (path === "/") return pathname === "/" && index === 0;
  const prefixes = SECTION_PREFIXES[path] ?? [path];
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <ul className={styles.list}>
      {items.map((item, index) => (
        <li key={item.href}>
          <Link
            href={item.href}
            className={styles.link}
            aria-current={isCurrentNavItem(item.href, index, pathname) ? "page" : undefined}
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
