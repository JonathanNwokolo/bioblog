import { NextResponse } from "next/server";
import { isUuid } from "@/lib/cms/paths";
import { getPublishedMediaUrl } from "@/lib/cms/repository";

/**
 * Public delivery of a published cover image. The lookup is cached under the `posts` tag, so
 * publishing / unpublishing (Server Actions call `updateTag("posts")`) takes effect on the next request.
 * The signed URL outlives the cache window; browsers may keep the redirect for at most one minute.
 */
export const dynamic = "force-dynamic";

const notFound = () => new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=30" } });

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  let signedUrl: string | null = null;
  try {
    signedUrl = await getPublishedMediaUrl(id);
  } catch {
    return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (!signedUrl) return notFound();
  return NextResponse.redirect(signedUrl, { headers: { "Cache-Control": "public, max-age=60" } });
}
