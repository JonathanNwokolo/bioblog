"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  addComment as addCommentTo,
  EMPTY_ENGAGEMENT,
  getEngagement,
  parseEngagement,
  removeComment as removeCommentFrom,
  STORAGE_KEY,
  toggleLike as toggleLikeIn,
  validateComment,
  type CommentValidation,
  type EngagementMap,
  type PostEngagement,
} from "./engagement";

/**
 * Ligação do estado de curtidas/comentários ao React (`localStorage`).
 *
 * `useSyncExternalStore` mantém todas as instâncias da página (card, barra do
 * post, lista de comentários) e todas as abas sincronizadas. Se o navegador
 * bloquear o armazenamento (aba privada), o estado continua funcionando em
 * memória até a página ser fechada.
 */

const SERVER_SNAPSHOT: EngagementMap = {};
const listeners = new Set<() => void>();

let cachedRaw: string | null | undefined;
let cachedMap: EngagementMap = {};
let memoryFallback: EngagementMap | null = null;

function snapshot(): EngagementMap {
  if (memoryFallback) return memoryFallback;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return cachedMap;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedMap = parseEngagement(raw);
  }
  return cachedMap;
}

function commit(next: EngagementMap) {
  try {
    const raw = JSON.stringify(next);
    window.localStorage.setItem(STORAGE_KEY, raw);
    cachedRaw = raw;
    cachedMap = next;
    memoryFallback = null;
  } catch {
    memoryFallback = next;
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface UseEngagement {
  engagement: PostEngagement;
  toggleLike: () => void;
  addComment: (author: string, text: string) => CommentValidation;
  removeComment: (commentId: string) => void;
}

export function useEngagement(slug: string): UseEngagement {
  const map = useSyncExternalStore(subscribe, snapshot, () => SERVER_SNAPSHOT);
  const engagement = map === SERVER_SNAPSHOT ? EMPTY_ENGAGEMENT : getEngagement(map, slug);

  const toggleLike = useCallback(() => {
    commit(toggleLikeIn(snapshot(), slug));
  }, [slug]);

  const addComment = useCallback(
    (author: string, text: string): CommentValidation => {
      const result = validateComment({ author, text });
      if (result.ok) {
        commit(
          addCommentTo(snapshot(), slug, {
            id: newId(),
            createdAt: new Date().toISOString(),
            author: result.author,
            text: result.text,
          }),
        );
      }
      return result;
    },
    [slug],
  );

  const removeComment = useCallback(
    (commentId: string) => {
      commit(removeCommentFrom(snapshot(), slug, commentId));
    },
    [slug],
  );

  return { engagement, toggleLike, addComment, removeComment };
}
