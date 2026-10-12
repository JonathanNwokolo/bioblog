"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentEditor, requireEditor } from "@/lib/cms/auth";
import { findUnusedMedia } from "@/lib/cms/media";
import { publicPathsForSlugs, isUuid } from "@/lib/cms/paths";
import { bodyToJson, fieldErrors, loginSchema, postInputSchema, slugifyTitle, type PostInputField } from "@/lib/cms/validation";

export interface PostFormValues {
  title: string;
  excerpt: string;
  body: string;
  categoryId: string;
  heroMediaId: string;
  heroAlt: string;
  heroCredit: string;
}

export interface ActionState {
  error?: string;
  success?: string;
  /** Field-level messages, keyed by form control name. */
  fieldErrors?: Partial<Record<PostInputField | "email" | "password", string>>;
  /** Echo of what was submitted, so a failed save never discards the author's typing. */
  values?: Partial<PostFormValues & { email: string }>;
  /** Changes on every result; the form uses it to re-key its controls. */
  nonce?: number;
  sessionExpired?: boolean;
}

const SESSION_EXPIRED = "Sua sessão expirou. Entre novamente em outra aba e volte aqui para salvar sem perder o texto.";

function text(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function readPostValues(formData: FormData): PostFormValues {
  return {
    title: text(formData, "title"), excerpt: text(formData, "excerpt"), body: text(formData, "body"),
    categoryId: text(formData, "categoryId"), heroMediaId: text(formData, "heroMediaId"),
    heroAlt: text(formData, "heroAlt"), heroCredit: text(formData, "heroCredit"),
  };
}

/**
 * Expires the public data cache immediately (no stale-while-revalidate: an unpublished
 * article must stop being served on the very next request) and re-renders the listing paths.
 * Slugs must be read from persisted rows, never from the form.
 */
function refreshPublicContent(...slugs: Array<string | null | undefined>) {
  updateTag("posts");
  for (const path of publicPathsForSlugs(...slugs)) revalidatePath(path);
}

function rowSlug(value: unknown): string | null {
  return value && typeof value === "object" && "slug" in value && typeof value.slug === "string" ? value.slug : null;
}

function lifecycleError(message: string | undefined) {
  if (!message) return "generic";
  if (message.includes("hero_media_required")) return "hero";
  if (message.includes("body_required")) return "body";
  if (message.includes("post_not_found")) return "missing";
  if (message.includes("media_not_found")) return "media";
  return "generic";
}

export async function loginAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const email = text(formData, "email");
  const parsed = loginSchema.safeParse({ email, password: text(formData, "password") });
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error) as ActionState["fieldErrors"];
    return { error: parsed.error.issues[0]?.message ?? "Credenciais inválidas.", fieldErrors: errors, values: { email }, nonce: Date.now() };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "E-mail ou senha inválidos.", values: { email }, nonce: Date.now() };
  const editor = await getCurrentEditor();
  if (!editor) {
    await supabase.auth.signOut();
    return { error: "Esta conta não está autorizada a editar o Microcosmos.", values: { email }, nonce: Date.now() };
  }
  redirect("/admin");
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

export async function createPostAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const values = readPostValues(formData);
  const editor = await getCurrentEditor({ verify: true });
  if (!editor) return { error: SESSION_EXPIRED, sessionExpired: true, values, nonce: Date.now() };
  const parsed = postInputSchema.safeParse(values);
  if (!parsed.success) {
    return { error: "Revise os campos destacados.", fieldErrors: fieldErrors(parsed.error), values, nonce: Date.now() };
  }
  const supabase = await createSupabaseServerClient();
  const baseSlug = slugifyTitle(parsed.data.title);
  const payload = {
    slug: baseSlug,
    title: parsed.data.title,
    excerpt: parsed.data.excerpt,
    body_json: bodyToJson(parsed.data.body),
    category_id: parsed.data.categoryId,
    hero_media_id: parsed.data.heroMediaId || null,
    author_user_id: editor.id,
    status: "draft",
  };
  let result = await supabase.from("posts").insert(payload).select("id").single();
  if (result.error?.code === "23505") {
    result = await supabase.from("posts").insert({ ...payload, slug: `${baseSlug}-${crypto.randomUUID().slice(0, 6)}` }).select("id").single();
  }
  if (result.error || !result.data) return { error: "Não foi possível criar o rascunho. Seu texto foi mantido; tente novamente.", values, nonce: Date.now() };
  await supabase.from("audit_events").insert({ actor_user_id: editor.id, action: "create", entity_type: "post", entity_id: result.data.id });
  redirect(`/admin/posts/${result.data.id}/edit?created=1`);
}

export async function updatePostAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const values = readPostValues(formData);
  const editor = await getCurrentEditor({ verify: true });
  if (!editor) return { error: SESSION_EXPIRED, sessionExpired: true, values, nonce: Date.now() };
  const id = text(formData, "id");
  if (!isUuid(id)) return { error: "Publicação inválida.", values, nonce: Date.now() };
  const parsed = postInputSchema.safeParse(values);
  if (!parsed.success) {
    return { error: "Revise os campos destacados.", fieldErrors: fieldErrors(parsed.error), values, nonce: Date.now() };
  }
  const supabase = await createSupabaseServerClient();
  const { data: before } = await supabase.from("posts").select("slug,status").eq("id", id).maybeSingle();
  const { data, error } = await supabase.rpc("save_post_changes", {
    target_post_id: id,
    new_title: parsed.data.title,
    new_excerpt: parsed.data.excerpt,
    new_body: bodyToJson(parsed.data.body),
    new_category: parsed.data.categoryId,
    new_hero: parsed.data.heroMediaId || null,
  });
  if (error || !data) {
    const base = { values, nonce: Date.now() };
    if (error?.message.includes("hero_media_required")) return { ...base, error: "Uma publicação no ar precisa de imagem de capa." };
    if (error?.message.includes("body_required")) return { ...base, error: "Uma publicação no ar precisa de conteúdo." };
    if (error?.message.includes("post_not_found")) return { ...base, error: "Esta publicação não existe mais ou foi excluída." };
    return { ...base, error: "Não foi possível salvar as alterações. Seu texto foi mantido; tente novamente." };
  }

  // Alt text / credit stay editable after upload; only written when a cover is set and alt is valid.
  if (parsed.data.heroMediaId && parsed.data.heroAlt && parsed.data.heroAlt.length >= 3) {
    await supabase
      .from("media_assets")
      .update({ alt_text: parsed.data.heroAlt, credit: parsed.data.heroCredit ?? "" })
      .eq("id", parsed.data.heroMediaId)
      .is("deleted_at", null);
  }

  // Both the slug stored before and after the write are revalidated (they differ if slugs ever become editable).
  if (before?.status === "published" || data.status === "published") refreshPublicContent(rowSlug(before), rowSlug(data));
  return { success: data.status === "published" ? "Alterações salvas e publicadas." : "Rascunho salvo.", values, nonce: Date.now() };
}

export async function publishPostAction(formData: FormData) {
  await requireEditor({ verify: true });
  const id = text(formData, "id");
  if (!isUuid(id)) redirect("/admin");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("publish_post", { target_post_id: id });
  if (error || !data) redirect(`/admin/posts/${id}/edit?error=publish_${lifecycleError(error?.message)}`);
  refreshPublicContent(rowSlug(data));
  redirect(`/admin/posts/${id}/edit?published=1`);
}

export async function unpublishPostAction(formData: FormData) {
  await requireEditor({ verify: true });
  const id = text(formData, "id");
  if (!isUuid(id)) redirect("/admin");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("unpublish_post", { target_post_id: id });
  if (error || !data) redirect(`/admin/posts/${id}/edit?error=unpublish_${lifecycleError(error?.message)}`);
  refreshPublicContent(rowSlug(data));
  redirect(`/admin/posts/${id}/edit?unpublished=1`);
}

export async function deletePostAction(formData: FormData) {
  await requireEditor({ verify: true });
  const id = text(formData, "id");
  if (!isUuid(id)) redirect("/admin");
  if (text(formData, "confirmation").trim() !== "EXCLUIR") redirect(`/admin/posts/${id}/edit?error=confirmation`);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("soft_delete_post", { target_post_id: id });
  if (error || !data) redirect(`/admin/posts/${id}/edit?error=delete_${lifecycleError(error?.message)}`);
  refreshPublicContent(rowSlug(data));
  redirect("/admin?deleted=1");
}

/** Removes private draft images no live post uses. Published media is never touched. */
export async function cleanupUnusedMediaAction() {
  const editor = await requireEditor({ verify: true });
  const supabase = await createSupabaseServerClient();
  const unused = await findUnusedMedia(supabase);
  let removed = 0;
  for (const item of unused) {
    const stored = await supabase.storage.from("post-media").remove([item.object_key]);
    if (stored.error) continue;
    const { error } = await supabase.from("media_assets").update({ deleted_at: new Date().toISOString() }).eq("id", item.id).eq("state", "draft").is("deleted_at", null);
    if (error) continue;
    await supabase.from("audit_events").insert({ actor_user_id: editor.id, action: "media_delete", entity_type: "media", entity_id: item.id });
    removed += 1;
  }
  redirect(`/admin?media_cleaned=${removed}`);
}
