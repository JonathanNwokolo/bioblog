const labels: Record<string, string> = {
  draft: "Rascunho",
  published: "Publicado",
  unpublished: "Retirado do ar",
  deleted: "Excluído",
};

export function statusLabel(status: string) {
  return labels[status] ?? status;
}
