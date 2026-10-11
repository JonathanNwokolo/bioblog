"use client";

import { useCallback, useId, useRef } from "react";
import type { SpecimenKind } from "@/content/types";
import { Specimen } from "@/components/specimens/Specimen";
import styles from "./LensField.module.css";

interface LensFieldProps {
  kind: SpecimenKind;
  /** Imagem fotográfica opcional de microscopia de alta resolução. */
  imageSrc?: string;
  /** Descrição curta do campo (também lida por leitores de tela). */
  label: string;
  /** Legenda de origem, exposta como título e para leitores de tela. */
  credit: string;
  zoom?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Campo microscópico com lente de aumento.
 *
 * Intenção: reforçar a escala (o que o olho vê x o que a lente revela). Sob a
 * lente aparece uma camada de detalhe fino que a imagem base não mostra.
 *
 * - Mouse/caneta: a lente segue o ponteiro enquanto ele estiver sobre o campo.
 * - Toque: tocar ou arrastar horizontalmente coloca a lente; rolar na vertical
 *   continua funcionando (`touch-action: pan-y`).
 * - Teclado: o campo recebe foco; setas movem a lente, Home centraliza, Esc a
 *   recolhe.
 * - Movimento reduzido: a lente aparece e se move sem transições nem ganho de
 *   escala; não há animação contínua em nenhum caso.
 *
 * O deslocamento é aplicado direto no DOM (sem estado React) para não
 * re-renderizar a cada movimento do ponteiro.
 */
export function LensField({ kind, imageSrc, label, credit, zoom = 2.6, className, style }: LensFieldProps) {
  const hintId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const lensRef = useRef<HTMLSpanElement>(null);
  const layerRef = useRef<HTMLSpanElement>(null);
  const pos = useRef({ x: 0.5, y: 0.5 });
  const hideTimer = useRef<number | undefined>(undefined);

  const place = useCallback(
    (fx: number, fy: number) => {
      const root = rootRef.current;
      const lens = lensRef.current;
      const layer = layerRef.current;
      if (!root || !lens || !layer) return;
      const x = Math.min(1, Math.max(0, fx));
      const y = Math.min(1, Math.max(0, fy));
      pos.current = { x, y };
      const w = root.clientWidth;
      const h = root.clientHeight;
      const r = lens.offsetWidth / 2;
      layer.style.width = `${w * zoom}px`;
      layer.style.height = `${h * zoom}px`;
      lens.style.transform = `translate3d(${x * w - r}px, ${y * h - r}px, 0)`;
      layer.style.transform = `translate3d(${r - x * w * zoom}px, ${r - y * h * zoom}px, 0)`;
    },
    [zoom],
  );

  const setActive = useCallback((active: boolean) => {
    window.clearTimeout(hideTimer.current);
    rootRef.current?.setAttribute("data-active", String(active));
  }, []);

  const fromPointer = (event: React.PointerEvent) => {
    const rect = rootRef.current!.getBoundingClientRect();
    place((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
  };

  const onPointerEnter = (event: React.PointerEvent) => {
    fromPointer(event);
    setActive(true);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    fromPointer(event);
  };

  const onPointerLeave = () => setActive(false);

  const onPointerDown = (event: React.PointerEvent) => {
    if (event.pointerType !== "touch") return;
    fromPointer(event);
    setActive(true);
  };

  const onPointerUp = (event: React.PointerEvent) => {
    if (event.pointerType !== "touch") return;
    hideTimer.current = window.setTimeout(() => setActive(false), 1100);
  };

  const onFocus = (event: React.FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.matches(":focus-visible")) return;
    place(pos.current.x, pos.current.y);
    setActive(true);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const step = 0.07;
    const { x, y } = pos.current;
    let next: [number, number] | null = null;
    switch (event.key) {
      case "ArrowLeft":
        next = [x - step, y];
        break;
      case "ArrowRight":
        next = [x + step, y];
        break;
      case "ArrowUp":
        next = [x, y - step];
        break;
      case "ArrowDown":
        next = [x, y + step];
        break;
      case "Home":
        next = [0.5, 0.5];
        break;
      case "Escape":
        setActive(false);
        return;
      default:
        return;
    }
    event.preventDefault();
    place(next[0], next[1]);
    setActive(true);
  };

  return (
    <div
      ref={rootRef}
      className={`${styles.field} ${className ?? ""}`}
      style={style}
      data-active="false"
      tabIndex={0}
      role="group"
      aria-label={label}
      aria-describedby={hintId}
      title={credit}
      onPointerEnter={onPointerEnter}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerLeave}
      onFocus={onFocus}
      onBlur={() => setActive(false)}
      onKeyDown={onKeyDown}
    >
      <span className={styles.frame}>
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageSrc} alt="" className={styles.photo} />
        ) : (
          <Specimen kind={kind} className={styles.art} title={label} />
        )}
      </span>

      <span ref={lensRef} className={styles.lens} aria-hidden="true">
        <span ref={layerRef} className={styles.layer}>
          {imageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageSrc} alt="" className={styles.photoDetail} />
          ) : (
            <Specimen kind={kind} detail className={styles.art} />
          )}
        </span>
      </span>

      <span id={hintId} className="visually-hidden">
        {credit} Use as setas do teclado para mover a lente de aumento.
      </span>
    </div>
  );
}
