import Link from "next/link";
import { notFound } from "next/navigation";
import { PostForm } from "@/components/admin/PostForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { isUuid } from "@/lib/cms/paths";
import { parseBody } from "@/lib/cms/types";
import { requireEditor } from "@/lib/cms/auth";
import { formatDateTime } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deletePostAction, publishPostAction, unpublishPostAction, updatePostAction } from "../../../actions";
import { flashFromSearchParams } from "../../../flash";
import { statusLabel } from "../../../status";

export const dynamic = "force-dynamic";

export const metadata = { title: "Editar publicação · Acesso editorial", robots: { index: false, follow: false } };

export default async function EditPostPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireEditor();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const flash = flashFromSearchParams(await searchParams);
  const supabase = await createSupabaseServerClient();
  const [{ data: post }, { data: categories }] = await Promise.all([
    supabase.from("posts").select("id,slug,title,excerpt,body_json,category_id,hero_media_id,status,updated_at,published_at,media:media_assets!posts_hero_media_id_fkey(id,alt_text,credit)").eq("id", id).maybeSingle(),
    supabase.from("categories").select("id,label").eq("active", true).order("sort_order"),
  ]);
  if (!post || post.status === "deleted") notFound();
  const mediaValue = Array.isArray(post.media) ? post.media[0] : post.media;
  const isPublished = post.status === "published";
  return (
    <>
      <p><Link href="/admin">← Publicações</Link></p>
      <header className="admin-header">
        <div>
          <p className="admin-status">{statusLabel(post.status)}</p>
          <h1>{post.title}</h1>
          <p className="admin-muted">
            Atualizado em {formatDateTime(post.updated_at)}
            {isPublished && post.published_at ? ` · no ar desde ${formatDateTime(post.published_at)}` : ""}
          </p>
        </div>
        <div className="admin-header-actions">
          <Link className="btn btn--outline" href={`/admin/posts/${id}/preview`}>Prévia privada</Link>
          {isPublished && <Link className="btn btn--outline" href={`/diario/${post.slug}`}>Ver no site</Link>}
        </div>
      </header>
      {flash && <p role={flash.kind === "error" ? "alert" : "status"} className={flash.kind === "error" ? "admin-error" : "admin-success"}>{flash.text}</p>}
      <PostForm
        action={updatePostAction}
        categories={categories ?? []}
        post={{ id: post.id, title: post.title, excerpt: post.excerpt, body: parseBody(post.body_json).join("\n\n"), categoryId: post.category_id, mediaId: post.hero_media_id, mediaAlt: mediaValue?.alt_text ?? "", mediaCredit: mediaValue?.credit ?? "" }}
      />
      <section className="admin-actions" aria-labelledby="publicacao-titulo">
        <h2 id="publicacao-titulo">Publicação</h2>
        <p className="admin-help">
          {isPublished
            ? "Esta publicação está no ar. Retirá-la a torna um rascunho privado; você pode republicá-la depois."
            : "Salve as alterações antes de publicar. Publicar exige imagem de capa e conteúdo."}
        </p>
        {isPublished
          ? <form action={unpublishPostAction}><input type="hidden" name="id" value={id} /><SubmitButton pendingLabel="Retirando…">Retirar do ar</SubmitButton></form>
          : <form action={publishPostAction}><input type="hidden" name="id" value={id} /><SubmitButton className="btn btn--mint" pendingLabel="Publicando…">Publicar</SubmitButton></form>}
      </section>
      <form className="admin-danger" action={deletePostAction}>
        <h2>Excluir publicação</h2>
        <p id="excluir-hint">A exclusão remove a publicação do site e do painel. Digite EXCLUIR para confirmar.</p>
        <input type="hidden" name="id" value={id} />
        <div className="admin-field">
          <label htmlFor="confirmation">Confirmação</label>
          <input id="confirmation" name="confirmation" autoComplete="off" aria-describedby="excluir-hint" />
        </div>
        <SubmitButton pendingLabel="Excluindo…">Excluir</SubmitButton>
      </form>
    </>
  );
}
