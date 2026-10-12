import "server-only";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { isValidSlug } from "./paths";
import type { CmsPostRow } from "./types";
import { toPublicPostOrNull } from "./types";

const PUBLIC_SELECT = `
  id, slug, title, excerpt, body_json, status, first_published_at, published_at, updated_at,
  category:categories!posts_category_id_fkey(label),
  media:media_assets!posts_hero_media_id_fkey(id,width,height,alt_text,credit)
`;

function createPublicClient() {
  const { url, publishableKey } = getSupabasePublicEnv();
  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export const listPublishedPosts = unstable_cache(async () => {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("posts")
    .select(PUBLIC_SELECT)
    .eq("status", "published")
    .is("deleted_at", null)
    .order("published_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw new Error(`Falha ao carregar publicações: ${error.message}`);
  // One malformed row must never take the whole diary offline.
  return (data as unknown as CmsPostRow[]).flatMap((row) => {
    const post = toPublicPostOrNull(row);
    return post ? [post] : [];
  });
}, ["published-posts"], { revalidate: 300, tags: ["posts"] });

export const getPublishedPostBySlug = unstable_cache(async (slug: string) => {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("posts")
    .select(PUBLIC_SELECT)
    .eq("slug", slug)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`Falha ao carregar publicação: ${error.message}`);
  return data ? toPublicPostOrNull(data as unknown as CmsPostRow) : null;
}, ["published-post-by-slug"], { revalidate: 300, tags: ["posts"] });

/** Seconds a signed URL stays valid; must exceed the cache window below by a wide margin. */
const MEDIA_URL_TTL_SECONDS = 3600;

/**
 * Signed URL for a *published* cover image, or null. Cached for 5 minutes under the `posts` tag so
 * Server Actions that publish/unpublish expire it immediately.
 */
export const getPublishedMediaUrl = unstable_cache(async (id: string) => {
  const supabase = createPublicClient();
  const { data: media, error } = await supabase
    .from("media_assets")
    .select("object_key")
    .eq("id", id)
    .eq("state", "published")
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error("Falha ao consultar a mídia publicada.");
  if (!media) return null;
  const signed = await supabase.storage.from("post-media").createSignedUrl(media.object_key, MEDIA_URL_TTL_SECONDS);
  return signed.error ? null : signed.data.signedUrl;
}, ["published-media-url"], { revalidate: 300, tags: ["posts"] });

export async function safelyListPublishedPosts() {
  try {
    return { posts: await listPublishedPosts(), error: null };
  } catch (error) {
    return {
      posts: [],
      error: error instanceof SupabaseConfigError ? error.message : "O Diário está temporariamente indisponível.",
    };
  }
}

export async function safelyGetPublishedPost(slug: string) {
  if (!isValidSlug(slug)) return { post: null, error: null };
  try {
    return { post: await getPublishedPostBySlug(slug), error: null };
  } catch (error) {
    return {
      post: null,
      error: error instanceof SupabaseConfigError ? error.message : "A publicação está temporariamente indisponível.",
    };
  }
}

