"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight } from "@/components/ui/icons";
import styles from "./DiaryFeed.module.css";

interface DiaryFeedProps {
  /** Quantidade de entradas (cada filho é um `<li>`). */
  count: number;
  children: ReactNode;
}

interface Reading {
  /** Índice da primeira entrada visível. */
  index: number;
  overflow: boolean;
  atStart: boolean;
  atEnd: boolean;
}

const INITIAL: Reading = { index: 0, overflow: false, atStart: true, atEnd: true };

/**
 * Feed das publicações anteriores.
 *
 * Desktop: coluna vertical de altura controlada. Tablet e mobile: faixa
 * horizontal com encaixe (swipe). Em ambos é rolagem nativa, sem captura de
 * roda nem de toque: ao chegar ao fim, a página continua a rolar. Os botões e o
 * foco por teclado (região focável, setas) são a alternativa acessível.
 */
export function DiaryFeed({ count, children }: DiaryFeedProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [reading, setReading] = useState<Reading>(INITIAL);

  const isHorizontal = () => !window.matchMedia("(min-width: 960px)").matches;

  const measure = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const horizontal = isHorizontal();
    const pos = horizontal ? el.scrollLeft : el.scrollTop;
    const max = horizontal ? el.scrollWidth - el.clientWidth : el.scrollHeight - el.clientHeight;
    const atEnd = pos >= max - 1;

    let index = 0;
    const items = el.querySelectorAll<HTMLElement>(":scope > ol > li");
    items.forEach((item, i) => {
      const offset = horizontal ? item.offsetLeft : item.offsetTop;
      if (offset <= pos + 16) index = i;
    });

    const next: Reading = {
      index,
      overflow: max > 1,
      atStart: pos <= 1,
      atEnd: max <= 1 || atEnd,
    };
    setReading((prev) =>
      prev.index === next.index &&
      prev.overflow === next.overflow &&
      prev.atStart === next.atStart &&
      prev.atEnd === next.atEnd
        ? prev
        : next,
    );
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    schedule();
    el.addEventListener("scroll", schedule, { passive: true });
    const observer = new ResizeObserver(schedule);
    observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", schedule);
      observer.disconnect();
    };
  }, [measure, count]);

  function step(direction: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    const items = el.querySelectorAll<HTMLElement>(":scope > ol > li");
    const target = items[Math.min(Math.max(reading.index + direction, 0), items.length - 1)];
    if (!target) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({
      [isHorizontal() ? "left" : "top"]: isHorizontal() ? target.offsetLeft : target.offsetTop,
      behavior: reduce ? "auto" : "smooth",
    });
  }

  const position = Math.min(reading.index + 1, count);

  return (
    <div className={styles.feed}>
      <div className={styles.head}>
        <h3 className={styles.headTitle}>Publicações anteriores</h3>
        <div className={styles.tools}>
          <span className={styles.status}>
            {position} de {count}
          </span>
          <div className={styles.controls} hidden={!reading.overflow}>
            <button
              type="button"
              className={`${styles.step} ${styles.prev}`}
              onClick={() => step(-1)}
              disabled={reading.atStart}
              aria-label="Publicação anterior do feed"
            >
              <ArrowRight />
            </button>
            <button
              type="button"
              className={`${styles.step} ${styles.next}`}
              onClick={() => step(1)}
              disabled={reading.atEnd}
              aria-label="Próxima publicação do feed"
            >
              <ArrowRight />
            </button>
          </div>
        </div>
      </div>

      <div
        className={styles.frame}
        data-more-start={reading.overflow && !reading.atStart ? "" : undefined}
        data-more-end={reading.overflow && !reading.atEnd ? "" : undefined}
      >
        <div
          ref={scrollerRef}
          className={styles.scroller}
          role="region"
          aria-label={`Feed com ${count} ${count === 1 ? "publicação anterior" : "publicações anteriores"}`}
          tabIndex={0}
        >
          <ol className={styles.list} role="list">
            {children}
          </ol>
        </div>
      </div>
    </div>
  );
}
