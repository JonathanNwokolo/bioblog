"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { NavItem } from "@/content/types";
import { CloseIcon, MenuIcon } from "@/components/ui/icons";
import { isCurrentNavItem } from "./NavLinks";
import styles from "./SiteHeader.module.css";

/** Menu em painel para telas estreitas. Fecha com Esc, clique em item ou fora. */
export function MobileNav({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointer = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div className={styles.mobile} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls="menu-mobile"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <CloseIcon /> : <MenuIcon />}
        <span className="visually-hidden">{open ? "Fechar menu" : "Abrir menu"}</span>
      </button>

      <nav id="menu-mobile" aria-label="Menu principal" className={styles.panel} hidden={!open}>
        <ul>
          {items.map((item, index) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={styles.panelLink}
                aria-current={isCurrentNavItem(item.href, index, pathname) ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
