import type { TrajectoryEntry } from "./types";

/**
 * Minha Trajetória.
 *
 * Verificado em 2026-10-10: o perfil do LinkedIn informado respondeu HTTP 999
 * (bloqueio a acesso automatizado), portanto NENHUM cargo, curso, instituição
 * ou data pôde ser confirmado. Todas as entradas são vagas pendentes.
 *
 * Para publicar um marco: preencher `period`, `title`, `institution`,
 * `description`, trocar `status` por "verified" e informar `source`.
 * O selo "Pendente" some sozinho e o layout não muda.
 */
export const trajectory: TrajectoryEntry[] = [
  {
    id: "trajetoria-001",
    kind: "Formação acadêmica",
    status: "placeholder",
    source: null,
    period: null,
    title: null,
    institution: null,
    description: null,
    media: null,
  },
  {
    id: "trajetoria-002",
    kind: "Pós-graduação",
    status: "placeholder",
    source: null,
    period: null,
    title: null,
    institution: null,
    description: null,
    media: null,
  },
  {
    id: "trajetoria-003",
    kind: "Pesquisa e atuação",
    status: "placeholder",
    source: null,
    period: null,
    title: null,
    institution: null,
    description: null,
    media: null,
  },
  {
    id: "trajetoria-004",
    kind: "Divulgação científica",
    status: "placeholder",
    source: null,
    period: null,
    title: null,
    institution: null,
    description: null,
    media: null,
  },
];
