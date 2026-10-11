/**
 * Curtidas e comentários do Diário de Bancada (PROTÓTIPO).
 *
 * Não existe backend. O estado é guardado em `localStorage`, por navegador:
 * funciona de verdade para quem usa (curtir, comentar, remover o próprio
 * comentário, recarregar a página), mas NÃO é compartilhado entre pessoas nem
 * entre dispositivos. A interface declara isso. Um backend futuro substitui
 * este módulo mantendo as mesmas funções puras e os mesmos tipos.
 *
 * Este arquivo não importa nada do React nem do DOM: as funções de transformação
 * são puras e testadas em `tests/engagement.test.ts`.
 */

export interface LocalComment {
  id: string;
  /** Nome informado pela pessoa; vazio vira "Anônimo" na exibição. */
  author: string;
  text: string;
  /** ISO 8601. */
  createdAt: string;
}

export interface PostEngagement {
  liked: boolean;
  comments: LocalComment[];
}

export type EngagementMap = Record<string, PostEngagement>;

export const STORAGE_KEY = "microcosmos.engagement.v1";
export const MAX_COMMENT_LENGTH = 600;
export const MAX_AUTHOR_LENGTH = 60;

export const EMPTY_ENGAGEMENT: PostEngagement = Object.freeze({
  liked: false,
  comments: Object.freeze([]) as unknown as LocalComment[],
}) as PostEngagement;

export function getEngagement(map: EngagementMap, slug: string): PostEngagement {
  return map[slug] ?? EMPTY_ENGAGEMENT;
}

export function toggleLike(map: EngagementMap, slug: string): EngagementMap {
  const current = getEngagement(map, slug);
  return { ...map, [slug]: { ...current, liked: !current.liked } };
}

export interface NewComment {
  author: string;
  text: string;
}

export type CommentValidation =
  | { ok: true; author: string; text: string }
  | { ok: false; reason: "empty" | "too-long" };

export function validateComment(input: NewComment): CommentValidation {
  const text = input.text.trim().replace(/\s+\n/g, "\n");
  const author = input.author.trim().slice(0, MAX_AUTHOR_LENGTH);
  if (text.length === 0) return { ok: false, reason: "empty" };
  if (text.length > MAX_COMMENT_LENGTH) return { ok: false, reason: "too-long" };
  return { ok: true, author, text };
}

export function addComment(
  map: EngagementMap,
  slug: string,
  comment: { id: string; createdAt: string; author: string; text: string },
): EngagementMap {
  const current = getEngagement(map, slug);
  return { ...map, [slug]: { ...current, comments: [...current.comments, comment] } };
}

export function removeComment(map: EngagementMap, slug: string, commentId: string): EngagementMap {
  const current = getEngagement(map, slug);
  return {
    ...map,
    [slug]: { ...current, comments: current.comments.filter((c) => c.id !== commentId) },
  };
}

/** Contagem exibida: base do servidor (hoje 0) + o que esta pessoa fez. */
export function likeCount(baseLikes: number, engagement: PostEngagement): number {
  return baseLikes + (engagement.liked ? 1 : 0);
}

/** Lê o mapa salvo, tolerando JSON inválido ou formato antigo. */
export function parseEngagement(raw: string | null): EngagementMap {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const result: EngagementMap = {};
    for (const [slug, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value !== "object" || value === null) continue;
      const v = value as Partial<PostEngagement>;
      const comments = Array.isArray(v.comments)
        ? v.comments.filter(
            (c): c is LocalComment =>
              !!c &&
              typeof c.id === "string" &&
              typeof c.text === "string" &&
              typeof c.author === "string" &&
              typeof c.createdAt === "string",
          )
        : [];
      result[slug] = { liked: v.liked === true, comments };
    }
    return result;
  } catch {
    return {};
  }
}
