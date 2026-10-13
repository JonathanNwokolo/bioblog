import { ORGANISM_TIMELINE } from "./opticalTransition";

export type GraphicsQualityTier = "high" | "medium" | "low" | "fallback";

export type ParasiteObservationId = "giardia" | "t-cruzi" | "trichuris";

export interface ParasiteObservation {
  id: ParasiteObservationId;
  scientificName: string;
  stage: string;
  shortDescription: string;
  morphology: readonly string[];
  sourceLabel: string;
  sourceUrl: string;
  relatedRoute: "/atlas" | "/atlas/5693" | "/laboratorio";
  relatedLabel: string;
  /** Intervalo da jornada em que o organismo existe (revelação e saída). Ver `opticalTransition`. */
  progressWindow: readonly [number, number];
}

export const PARASITE_OBSERVATIONS: readonly ParasiteObservation[] = [
  {
    id: "giardia",
    scientificName: "Giardia duodenalis",
    stage: "Trofozoíto",
    shortDescription:
      "Reconstrução artística do estágio móvel que pode permanecer livre no intestino delgado ou aderir à mucosa pelo disco ventral.",
    morphology: [
      "Contorno piriforme e simetria bilateral",
      "Dois núcleos grandes geralmente visíveis em preparações coradas",
      "Disco ventral, corpos medianos e oito flagelos como referências estruturais",
    ],
    sourceLabel: "CDC DPDx — Giardiasis",
    sourceUrl: "https://www.cdc.gov/dpdx/giardiasis/index.html",
    relatedRoute: "/laboratorio",
    relatedLabel: "Abrir no Laboratório",
    progressWindow: [ORGANISM_TIMELINE.giardia.in[0], ORGANISM_TIMELINE.giardia.out[1]],
  },
  {
    id: "t-cruzi",
    scientificName: "Trypanosoma cruzi",
    stage: "Tripomastigota sanguíneo",
    shortDescription:
      "Reconstrução artística da forma circulante encontrada no sangue; esse estágio não se replica na corrente sanguínea.",
    morphology: [
      "Corpo alongado, frequentemente curvado em C em esfregaços fixados",
      "Núcleo central e cinetoplasto grande, subterminal ou terminal",
      "Membrana ondulante e flagelo que emerge na extremidade anterior",
    ],
    sourceLabel: "CDC DPDx — American Trypanosomiasis",
    sourceUrl: "https://www.cdc.gov/dpdx/trypanosomiasisamerican/index.html",
    relatedRoute: "/atlas/5693",
    relatedLabel: "Abrir registro no Atlas",
    progressWindow: [ORGANISM_TIMELINE["t-cruzi"].in[0], ORGANISM_TIMELINE["t-cruzi"].out[1]],
  },
  {
    id: "trichuris",
    scientificName: "Trichuris trichiura",
    stage: "Ovo não embrionado",
    shortDescription:
      "Reconstrução artística do ovo eliminado nas fezes antes do desenvolvimento no solo.",
    morphology: [
      "Silhueta característica em barril",
      "Casca espessa",
      "Um plugue polar em cada extremidade",
    ],
    sourceLabel: "CDC DPDx — Trichuriasis",
    sourceUrl: "https://www.cdc.gov/dpdx/trichuriasis/index.html",
    relatedRoute: "/laboratorio",
    relatedLabel: "Comparar no Laboratório",
    progressWindow: [ORGANISM_TIMELINE.trichuris.in[0], ORGANISM_TIMELINE.trichuris.out[1]],
  },
] as const;

export interface CinematicStoryHotspot {
  id: string;
  title: string;
  subtitle: string;
  category: "Classificação & Filogenia" | "Microscopia & Morfologia" | "Distribuição & Biodiversidade";
  targetRoute: "/atlas" | "/laboratorio" | "/onde-vivem";
  provenance: "NCBI Taxonomy (Oficial)" | "CDC DPDx (Curadoria Pública)" | "GBIF (Ocorrências Globais)";
  badge: string;
  description: string;
  artisticNote: string;
  /** Coordenadas no referencial do micromundo; ancoradas para a pose final da câmera. */
  position: [number, number, number];
}

export const CINEMATIC_HOTSPOTS: readonly CinematicStoryHotspot[] = [
  {
    id: "hotspot-atlas",
    title: "Atlas do Invisível",
    subtitle: "Filogenia, classificação e nomes aceitos",
    category: "Classificação & Filogenia",
    targetRoute: "/atlas",
    provenance: "NCBI Taxonomy (Oficial)",
    badge: "NCBI TAXONOMY",
    description: "Explore a posição precisa de protozoários e helmintos na árvore filogenética celular, sem homônimos ocultos e com sinônimos documentados.",
    artisticNote: "A Giardia 3D preserva silhueta bilateral, dois núcleos e flagelos como referência morfológica editorial; não substitui identificação diagnóstica.",
    position: [-3, 1.7, -4],
  },
  {
    id: "hotspot-laboratorio",
    title: "Laboratório Interativo",
    subtitle: "Micrografias fotográficas reais documentadas",
    category: "Microscopia & Morfologia",
    targetRoute: "/laboratorio",
    provenance: "CDC DPDx (Curadoria Pública)",
    badge: "CDC DPDX",
    description: "Analise as micrografias documentadas e as notas morfológicas disponíveis no acervo do Laboratório.",
    artisticNote: "O Trypanosoma 3D destaca corpo alongado, membrana ondulante e flagelo como referência editorial; as micrografias documentadas vivem no Laboratório.",
    position: [0, -1.6, -4],
  },
  {
    id: "hotspot-onde-vivem",
    title: "Onde Vivem?",
    subtitle: "Registros biogeográficos no planeta Terra",
    category: "Distribuição & Biodiversidade",
    targetRoute: "/onde-vivem",
    provenance: "GBIF (Ocorrências Globais)",
    badge: "GBIF OCCURRENCES",
    description: "Consulte ocorrências georreferenciadas com proveniência explícita, filtros temporais e transparência sobre lacunas de amostragem.",
    artisticNote: "O ovo de Trichuris 3D preserva contorno em barril, casca e plugs polares como referência editorial; não representa escala diagnóstica.",
    position: [3, 1.2, -4],
  },
] as const;

/** Rótulo de anatomia exibido no modo de inspeção. Só estruturas citadas pela fonte (CDC DPDx). */
export interface OrganismAnnotation {
  key: string;
  label: string;
}

export const ORGANISM_ANNOTATIONS: Record<ParasiteObservationId, readonly OrganismAnnotation[]> = {
  giardia: [
    { key: "nuclei", label: "Núcleos" },
    { key: "disc", label: "Disco ventral" },
    { key: "flagella", label: "Flagelos" },
  ],
  "t-cruzi": [
    { key: "nucleus", label: "Núcleo" },
    { key: "membrane", label: "Membrana ondulante" },
    { key: "flagellum", label: "Flagelo" },
  ],
  trichuris: [
    { key: "plug-left", label: "Plugue polar" },
    { key: "plug-right", label: "Plugue polar" },
    { key: "shell", label: "Casca espessa" },
  ],
};

/**
 * Nota sobre o movimento exibido. Separa o que a fonte documenta do que é interpretação artística
 * (matriz completa em `docs/phase239-scientific-motion-report.md`).
 */
export const ORGANISM_MOTION_NOTES: Record<ParasiteObservationId, string> = {
  giardia:
    "Movimento exibido: ondulação coordenada dos flagelos e rotação lenta do corpo. É uma interpretação artística em câmera lenta; as fontes consultadas descrevem a motilidade apenas de forma qualitativa, sem frequências.",
  "t-cruzi":
    "Movimento exibido: onda no flagelo e na membrana ondulante, com flexão sutil do corpo. A propagação da ponta para a base está documentada em epimastigotas e foi estendida a este estágio como interpretação artística.",
  trichuris:
    "O ovo não tem motilidade. A rotação é uma operação de visualização controlada por você, não um movimento biológico.",
};
