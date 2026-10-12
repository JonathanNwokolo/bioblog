import type { NavItem } from "./types";

/**
 * Identidade e navegação do site.
 *
 * Nada aqui é inventado: o LinkedIn é o endereço fornecido pela proprietária
 * no briefing; e-mail e demais redes ficam `null` até serem informados.
 */
export const site = {
  brand: "Microcosmos",
  signature: "Além das Lentes",
  author: {
    name: "Ynara Raíssa Nwokolo",
    role: "Biomédica",
    field: "Parasitologia",
  },
  linkedin: {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/ynara-ra%C3%ADssa-nwokolo-2959351a0/",
  },
  /** `null` até a proprietária informar um contato. Não inventar. */
  email: null as string | null,
  copyrightYear: 2026,
} as const;

/** Âncoras absolutas (`/#...`) para funcionarem também fora da homepage. */
export const primaryNav: NavItem[] = [
  { label: "Início", href: "/#topo" },
  { label: "Trajetória", href: "/#trajetoria" },
  { label: "Diário de Bancada", href: "/#diario" },
  { label: "Parasita em destaque", href: "/#parasita" },
  { label: "Ciência interativa", href: "/ciencia" },
  { label: "Contato", href: "/#contato" },
];
