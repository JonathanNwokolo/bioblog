const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const zonedDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

/**
 * "2026-10-10" -> "10 de out. de 2026" (UTC, sem deslocar o dia).
 * Timestamps completos do CMS ("2026-10-11T03:28:53.1+00:00") são exibidos em America/Sao_Paulo.
 */
export function formatDate(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return dateFormatter.format(new Date(`${iso}T00:00:00Z`));
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? "" : zonedDateFormatter.format(parsed);
}

export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
