const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidSlug(value: unknown): value is string {
  return typeof value === "string" && value.length >= 1 && value.length <= 96 && slugPattern.test(value);
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

/**
 * Public paths that must be revalidated after a mutation. Slugs MUST come from rows
 * persisted and authorized on the server (RPC return values), never from form fields.
 * Pass both the previous and the new slug when a slug can change; duplicates and
 * malformed values are dropped.
 */
export function publicPathsForSlugs(...slugs: Array<string | null | undefined>): string[] {
  const unique = new Set<string>();
  for (const slug of slugs) if (isValidSlug(slug)) unique.add(`/diario/${slug}`);
  return ["/", "/diario", ...unique];
}
