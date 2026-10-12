/** Query-string flash codes → accessible messages. Codes are an allowlist; free text is never echoed. */
export type FlashKind = "success" | "error";

const messages: Record<string, { kind: FlashKind; text: string }> = {
  created: { kind: "success", text: "Rascunho criado. Agora envie a imagem de capa e publique quando estiver pronto." },
  published: { kind: "success", text: "Publicação no ar. Ela já aparece na página inicial e no Diário de Bancada." },
  unpublished: { kind: "success", text: "Publicação retirada do ar. Ela voltou a ser um rascunho privado e pode ser republicada." },
  deleted: { kind: "success", text: "Publicação excluída. Ela não aparece mais no site." },
  publish_hero: { kind: "error", text: "Não foi possível publicar: envie e salve a imagem de capa antes." },
  publish_body: { kind: "error", text: "Não foi possível publicar: escreva o conteúdo e salve antes." },
  publish_media: { kind: "error", text: "Não foi possível publicar: a imagem de capa não está mais disponível. Envie outra." },
  publish_missing: { kind: "error", text: "Esta publicação não existe mais ou foi excluída." },
  publish_generic: { kind: "error", text: "Não foi possível publicar agora. Tente novamente em instantes." },
  unpublish_missing: { kind: "error", text: "Esta publicação já não está no ar." },
  unpublish_generic: { kind: "error", text: "Não foi possível retirar do ar agora. Tente novamente em instantes." },
  delete_missing: { kind: "error", text: "Esta publicação já foi excluída." },
  delete_generic: { kind: "error", text: "Não foi possível excluir agora. Tente novamente em instantes." },
  confirmation: { kind: "error", text: "Para excluir, digite EXCLUIR (em maiúsculas) no campo de confirmação." },
};

export function flashFromSearchParams(params: Record<string, string | string[] | undefined>) {
  const pick = (key: string) => (Array.isArray(params[key]) ? params[key]?.[0] : params[key]);
  const error = pick("error");
  if (error && messages[error]) return messages[error];
  for (const key of ["created", "published", "unpublished", "deleted"]) {
    if (pick(key) === "1") return messages[key];
  }
  const cleaned = pick("media_cleaned");
  if (cleaned !== undefined && /^\d{1,4}$/.test(cleaned)) {
    const count = Number(cleaned);
    return { kind: "success" as const, text: count === 0 ? "Nenhuma imagem sem uso foi encontrada." : `${count} ${count === 1 ? "imagem sem uso removida" : "imagens sem uso removidas"}.` };
  }
  return null;
}
