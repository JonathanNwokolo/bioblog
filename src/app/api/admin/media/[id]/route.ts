import { NextResponse } from "next/server";
import { getCurrentEditor } from "@/lib/cms/auth";
import { isUuid } from "@/lib/cms/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const editor = await getCurrentEditor();
  if (!editor) return new Response(null, { status: 404 });
  const { id } = await params;
  if (!isUuid(id)) return new Response(null, { status: 404 });
  const supabase = await createSupabaseServerClient();
  const { data: media } = await supabase.from("media_assets").select("object_key").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!media) return new Response(null, { status: 404 });
  const { data, error } = await supabase.storage.from("post-media").createSignedUrl(media.object_key, 60);
  if (error) return new Response(null, { status: 404 });
  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "private, no-store" } });
}

