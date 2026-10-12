import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { getCurrentEditor } from "@/lib/cms/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (isSupabaseConfigured() && await getCurrentEditor()) redirect("/admin");
  return <div className="admin-login"><h1>Acesso editorial</h1><p>Área privada da autora do Microcosmos.</p>{isSupabaseConfigured() ? <LoginForm /> : <p role="alert" className="admin-config">Supabase não configurado neste ambiente. Consulte <code>.env.example</code>.</p>}</div>;
}

