/**
 * Contratos de conteúdo do Microcosmos.
 *
 * Tudo que a interface exibe vem de dados tipados neste formato, separado dos
 * componentes, para que um CMS futuro possa substituir os arquivos de
 * `src/content/*` sem tocar em layout. Convenção de verificação:
 * `docs/content-placeholders.md`.
 */

/** `placeholder` = dado de exemplo, exibido com selo. `verified` exige `source`. */
export type VerificationStatus = "placeholder" | "verified";

export interface Provenance {
  status: VerificationStatus;
  /** Quem forneceu o dado e quando. Obrigatório quando `status === "verified"`. */
  source: string | null;
}

/** Ilustrações geradas em código (`components/specimens`). */
export type SpecimenKind = "cysts" | "nematode" | "giardia" | "egg";

export type MediaRef =
  | {
      kind: "illustration";
      specimen: SpecimenKind;
      alt: string;
      /** Origem declarada, exibida como legenda. */
      credit: string;
    }
  | {
      kind: "photo";
      src: string;
      width: number;
      height: number;
      alt: string;
      credit: string;
    };

export interface NavItem {
  label: string;
  href: string;
}

export interface TrajectoryEntry extends Provenance {
  id: string;
  /** Natureza do marco. Rótulo da vaga na timeline, não afirma que o marco existe. */
  kind: string;
  /** `null` enquanto pendente. */
  period: string | null;
  title: string | null;
  institution: string | null;
  description: string | null;
  media: MediaRef | null;
}

export interface PostTag {
  /** Categoria editorial ("Identificação", "Protozoários"...). */
  label: string;
  /** Nome científico do organismo, quando houver. */
  organism?: string;
}

export interface Post extends Provenance {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  /** Parágrafos do corpo. */
  body: string[];
  /**
   * Data de publicação, ISO (AAAA-MM-DD; aceita AAAA-MM-DDThh:mm para desempatar
   * posts do mesmo dia). Define a ordem do Diário: o mais recente é o destaque.
   */
  publishedAt: string;
  /** Estado editorial. Ausente = publicado. `draft` nunca entra no feed nem tem página. */
  publication?: "published" | "draft";
  tag: PostTag;
  media: MediaRef;
  /** Contagem base vinda do servidor. Hoje 0: não há backend. */
  baseLikes: number;
  /** `slug` de um post relacionado a este, quando houver. */
  relatedTo?: string;
}

export interface FeaturedOrganism extends Provenance {
  scientificName: string;
  commonName: string | null;
  /** Frase curta sob o nome. */
  tagline: string;
  summary: string;
  facts: { label: string; value: string }[];
  media: MediaRef;
  /** Post do diário relacionado. */
  relatedPostSlug: string;
  /** Aviso mostrado enquanto o organismo não for aprovado. */
  provisionalNote: string;
}
