import Link from "next/link";
import { cleanupUnusedMediaAction, logoutAction } from "./actions";
import { flashFromSearchParams } from "./flash";
import { statusLabel } from "./status";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { requireEditor } from "@/lib/cms/auth";
import { findUnusedMedia } from "@/lib/cms/media";
import { formatDateTime } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Publicações · Acesso editorial", robots: { index: false, follow: false } };

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireEditor();
  const flash = flashFromSearchParams(await searchParams);
  const supabase = await createSupabaseServerClient();
  const [{ data: posts, error }, unused] = await Promise.all([
    supabase.from("posts").select("id,slug,title,status,updated_at,published_at").neq("status", "deleted").order("updated_at", { ascending: false }),
    findUnusedMedia(supabase),
  ]);
  return (
    <>
      <header className="admin-header">
        <div><p className="admin-status">CMS privado</p><h1>Publicações</h1></div>
        <form action={logoutAction}><SubmitButton pendingLabel="Saindo…">Sair</SubmitButton></form>
      </header>
      {flash && <p role={flash.kind === "error" ? "alert" : "status"} className={flash.kind === "error" ? "admin-error" : "admin-success"}>{flash.text}</p>}
      <p><Link className="btn btn--mint" href="/admin/posts/new">Nova publicação</Link></p>
      {error
        ? <p role="alert" className="admin-error">Não foi possível carregar as publicações. Recarregue a página.</p>
        : posts?.length
          ? (
            <ul className="admin-list" aria-label="Publicações">
              {posts.map((post) => (
                <li key={post.id}>
                  <article>
                    <div>
                      <p className="admin-status">{statusLabel(post.status)}</p>
                      <h2>{post.title}</h2>
                      <p className="admin-muted">/{post.slug} · atualizado em {formatDateTime(post.updated_at)}</p>
                    </div>
                    <Link className="btn btn--outline" href={`/admin/posts/${post.id}/edit`} aria-label={`Editar: ${post.title}`}>Editar</Link>
                  </article>
                </li>
              ))}
            </ul>
          )
          : <p>Ainda não há publicações. Comece com um rascunho.</p>}
      {unused.length > 0 && (
        <form className="admin-maintenance" action={cleanupUnusedMediaAction}>
          <h2>Imagens sem uso</h2>
          <p className="admin-help">
            {unused.length} {unused.length === 1 ? "imagem privada enviada há mais de uma hora não está vinculada" : "imagens privadas enviadas há mais de uma hora não estão vinculadas"} a nenhuma publicação.
            Remover libera espaço de armazenamento. Imagens publicadas nunca são removidas.
          </p>
          <SubmitButton pendingLabel="Removendo…">Remover imagens sem uso</SubmitButton>
        </form>
      )}
    </>
  );
}
