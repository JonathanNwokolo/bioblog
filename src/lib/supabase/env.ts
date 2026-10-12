export class SupabaseConfigError extends Error {
  constructor(message = "Supabase não configurado. Defina as variáveis descritas em .env.example.") {
    super(message);
    this.name = "SupabaseConfigError";
  }
}

export function getSupabasePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) throw new SupabaseConfigError();
  return { url, publishableKey };
}

export function isSupabaseConfigured() {
  try {
    getSupabasePublicEnv();
    return true;
  } catch {
    return false;
  }
}

