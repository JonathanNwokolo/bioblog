import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Resolves the signed-in owner, or null.
 *
 * The session is confirmed with the Auth server by default (`getUser`, revocation-aware). A JWT that is
 * only verified locally (`getClaims`) stays valid until it expires, so a cookie captured before logout
 * would still open private drafts. Pass `verify: false` only for non-sensitive, high-frequency checks.
 */
export async function getCurrentEditor(options: { verify?: boolean } = {}) {
  const verify = options.verify ?? true;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return null;
  if (verify) {
    const { data: verified, error: verifyError } = await supabase.auth.getUser();
    if (verifyError || verified.user?.id !== userId) return null;
  }
  const { data: owner } = await supabase
    .from("owner_accounts")
    .select("user_id,active")
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();
  return owner ? { id: userId, email: typeof data.claims.email === "string" ? data.claims.email : null } : null;
}

export async function requireEditor(options: { verify?: boolean } = {}) {
  const editor = await getCurrentEditor(options);
  if (!editor) redirect("/admin/login");
  return editor;
}
