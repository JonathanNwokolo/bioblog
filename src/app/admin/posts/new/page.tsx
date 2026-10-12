import Link from "next/link";
import { PostForm } from "@/components/admin/PostForm";
import { requireEditor } from "@/lib/cms/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPostAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewPostPage() {
  await requireEditor();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("categories").select("id,label").eq("active", true).order("sort_order");
  return <><p><Link href="/admin">← Publicações</Link></p><h1>Novo rascunho</h1><PostForm action={createPostAction} categories={data ?? []} /></>;
}

