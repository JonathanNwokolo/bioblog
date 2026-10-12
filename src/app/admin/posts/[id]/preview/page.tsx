import Link from "next/link";
import { notFound } from "next/navigation";
import { requireEditor } from "@/lib/cms/auth";
import { isUuid } from "@/lib/cms/paths";
import { parseBody } from "@/lib/cms/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Prévia privada · Acesso editorial", robots: { index: false, follow: false } };

export default async function PrivatePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireEditor();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createSupabaseServerClient();
  const { data: post } = await supabase.from("posts").select("id,title,excerpt,body_json,status,hero_media_id,media:media_assets!posts_hero_media_id_fkey(id,alt_text,credit)").eq("id", id).maybeSingle();
  if (!post || post.status === "deleted") notFound();
  const media = Array.isArray(post.media) ? post.media[0] : post.media;
  return (
    <article>
      <p><Link href={`/admin/posts/${id}/edit`}>← Voltar à edição</Link></p>
      <p className="admin-status">Prévia privada · {post.status === "published" ? "Publicado" : post.status === "unpublished" ? "Retirado do ar" : "Rascunho"}</p>
      <h1>{post.title}</h1>
      <p>{post.excerpt}</p>
      {media?.id && (
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="admin-image-preview" src={`/api/admin/media/${media.id}`} alt={media.alt_text} />
          {media.credit && <figcaption className="admin-muted">{media.credit}</figcaption>}
        </figure>
      )}
      <div className="editor-preview">{parseBody(post.body_json).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
    </article>
  );
}
