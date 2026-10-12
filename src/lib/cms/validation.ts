import { z } from "zod";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const postInputSchema = z.object({
  title: z.string().trim()
    .min(3, "O título precisa ter ao menos 3 caracteres.")
    .max(180, "O título pode ter no máximo 180 caracteres."),
  excerpt: z.string().trim()
    .min(10, "O resumo precisa ter ao menos 10 caracteres.")
    .max(420, "O resumo pode ter no máximo 420 caracteres."),
  body: z.string().trim()
    .min(10, "Escreva o conteúdo da publicação (ao menos 10 caracteres).")
    .max(50000, "O conteúdo pode ter no máximo 50.000 caracteres."),
  categoryId: z.uuid("Selecione uma categoria."),
  heroMediaId: z.union([z.literal(""), z.uuid("Imagem inválida. Envie a imagem novamente.")]).optional(),
  heroAlt: z.string().trim().max(500, "O texto alternativo pode ter no máximo 500 caracteres.").optional(),
  heroCredit: z.string().trim().max(500, "O crédito pode ter no máximo 500 caracteres.").optional(),
});

export type PostInputField = "title" | "excerpt" | "body" | "categoryId" | "heroMediaId" | "heroAlt" | "heroCredit";

/** First message per field, in schema order — so each invalid control can be described individually. */
export function fieldErrors(error: z.ZodError): Partial<Record<PostInputField, string>> {
  const result: Partial<Record<PostInputField, string>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as PostInputField | undefined;
    if (field && !(field in result)) result[field] = issue.message;
  }
  return result;
}

export function bodyToJson(body: string) {
  return body
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function slugifyTitle(title: string) {
  const slug = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 96)
    .replace(/-$/g, "");
  return slugPattern.test(slug) ? slug : `publicacao-${crypto.randomUUID().slice(0, 8)}`;
}

export const loginSchema = z.object({
  email: z.email("Informe um e-mail válido.").trim(),
  password: z.string().min(8, "Informe a senha completa.").max(256, "Senha longa demais."),
});

/**
 * CSRF guard for cookie-authenticated mutations.
 * - An `Origin` header must match the request host (or the forwarded host behind a proxy).
 * - Without `Origin`, a browser-supplied `Sec-Fetch-Site` of cross-site/same-site is refused;
 *   a request with neither header is a non-browser client and carries no victim cookies.
 */
export function isTrustedMutationRequest(headers: { get(name: string): string | null }) {
  const host = headers.get("x-forwarded-host")?.split(",")[0]?.trim() || headers.get("host");
  const origin = headers.get("origin");
  if (origin) {
    try {
      return host !== null && new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  const fetchSite = headers.get("sec-fetch-site");
  return fetchSite === null || fetchSite === "same-origin" || fetchSite === "none";
}

/** Browsers always send Origin on cross-site POSTs; a missing Origin is accepted (same-origin tools). */
export function isSameOrigin(origin: string | null, host: string | null) {
  if (!origin) return true;
  try {
    return host !== null && new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function hasAllowedImageSignature(bytes: Uint8Array) {
  const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    .every((value, index) => bytes[index] === value);
  const webp = bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return jpeg || png || webp;
}
