import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";

/** Origin of the Supabase project (signed Storage URLs are the only third-party resources the site loads). */
function supabaseOrigin() {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return null;
  }
}

/**
 * Content-Security-Policy. Next.js bootstraps with inline scripts, and a nonce would force every
 * public page to render dynamically (losing the 5-minute ISR cache), so `script-src` keeps
 * 'unsafe-inline'. Everything else is locked to same-origin plus the Supabase project.
 * `unsafe-eval` is dev-only (React debugging). No `upgrade-insecure-requests`: it would break the
 * http://127.0.0.1 Supabase used for local production tests; HSTS covers real HTTPS deployments.
 */
function contentSecurityPolicy() {
  const supabase = supabaseOrigin();
  const self = ["'self'"];
  const directives: Record<string, string[]> = {
    "default-src": self,
    "script-src": [...self, "'unsafe-inline'", ...(isDevelopment ? ["'unsafe-eval'"] : [])],
    "style-src": [...self, "'unsafe-inline'"],
    "img-src": [...self, "data:", "blob:", ...(supabase ? [supabase] : [])],
    "font-src": self,
    "connect-src": [...self, ...(supabase ? [supabase] : []), ...(isDevelopment ? ["ws:", "wss:"] : [])],
    "media-src": self,
    "object-src": ["'none'"],
    "base-uri": self,
    "form-action": self,
    "frame-ancestors": ["'none'"],
    "manifest-src": self,
    "worker-src": ["'self'", "blob:"],
  };
  return Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`).join("; ");
}

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy() },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Evita que o Turbopack suba para um lockfile fora do repositório.
  turbopack: { root: process.cwd() },
  // The whole stylesheet is ~12 KB: inlining removes the render-blocking CSS round trips on first visit.
  experimental: {
    inlineCss: true,
    // The proxy buffers request bodies; the largest legitimate one is the 6 MB image upload.
    proxyClientMaxBodySize: "7mb",
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The editorial area and its API are private: never indexed, never cached by shared caches.
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
      {
        source: "/api/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
