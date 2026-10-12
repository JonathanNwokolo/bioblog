import type { Post } from "@/content/types";

export type CmsStatus = "draft" | "published" | "unpublished" | "deleted";

export interface CmsCategory {
  id: string;
  slug: string;
  label: string;
}

export interface CmsPostRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body_json: unknown;
  status: CmsStatus;
  first_published_at: string | null;
  published_at: string | null;
  updated_at: string;
  category: { label: string } | { label: string }[] | null;
  media: {
    id: string;
    width: number;
    height: number;
    alt_text: string;
    credit: string;
  } | {
    id: string;
    width: number;
    height: number;
    alt_text: string;
    credit: string;
  }[] | null;
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function parseBody(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function toPublicPostOrNull(row: CmsPostRow): Post | null {
  const category = one(row.category);
  const media = one(row.media);
  if (!category || !media || !row.published_at) return null;
  return toPublicPost(row);
}

export function toPublicPost(row: CmsPostRow): Post {
  const category = one(row.category);
  const media = one(row.media);
  if (!category || !media || !row.published_at) throw new Error("Registro publicado incompleto.");
  return {
    id: row.id,
    slug: row.slug,
    status: "verified",
    source: "Publicação autoral persistida no CMS Microcosmos.",
    title: row.title,
    excerpt: row.excerpt,
    body: parseBody(row.body_json),
    publishedAt: row.published_at,
    publication: "published",
    tag: { label: category.label },
    media: {
      kind: "photo",
      src: `/api/media/${media.id}`,
      width: media.width,
      height: media.height,
      alt: media.alt_text,
      credit: media.credit,
    },
    baseLikes: 0,
  };
}

