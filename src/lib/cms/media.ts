import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Uploads younger than this are never treated as unused: they may be about to be attached to a post. */
export const UNUSED_MEDIA_GRACE_MS = 60 * 60 * 1000;
const BATCH_LIMIT = 100;

export interface UnusedMedia {
  id: string;
  object_key: string;
}

/**
 * Private draft images that no live post references (replaced covers, abandoned uploads).
 * Published media is never returned: only `state = 'draft'` rows qualify.
 */
export async function findUnusedMedia(supabase: SupabaseClient): Promise<UnusedMedia[]> {
  const cutoff = new Date(Date.now() - UNUSED_MEDIA_GRACE_MS).toISOString();
  const [{ data: candidates, error: candidatesError }, { data: used, error: usedError }] = await Promise.all([
    supabase.from("media_assets").select("id,object_key").is("deleted_at", null).eq("state", "draft").lt("created_at", cutoff).order("created_at").limit(BATCH_LIMIT),
    supabase.from("posts").select("hero_media_id").is("deleted_at", null).not("hero_media_id", "is", null),
  ]);
  if (candidatesError || usedError || !candidates || !used) return [];
  const inUse = new Set(used.map((row) => row.hero_media_id as string));
  return candidates.filter((item) => !inUse.has(item.id));
}
