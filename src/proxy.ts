import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isTrustedMutationRequest } from "@/lib/cms/validation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { refreshSupabaseSession } from "@/lib/supabase/proxy";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export async function proxy(request: NextRequest) {
  // CSRF guard for every cookie-authenticated mutation (Server Actions and Route Handlers alike).
  // Next's own Server Action check is skipped when `Origin` is absent; this one also rejects
  // browser requests that declare `Sec-Fetch-Site: cross-site|same-site`.
  if (!SAFE_METHODS.has(request.method) && !isTrustedMutationRequest(request.headers)) {
    return NextResponse.json({ error: "Origem não permitida." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  if (!isSupabaseConfigured()) return NextResponse.next();
  return refreshSupabaseSession(request);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
