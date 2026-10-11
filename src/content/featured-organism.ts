import type { FeaturedOrganism } from "./types";

/**
 * Parasita em Destaque.
 *
 * PROVISÓRIO: o organismo ainda não foi aprovado pela proprietária. Giardia
 * lamblia foi mantida por ser o exemplo da referência visual. As afirmações são
 * gerais e conferem com a literatura introdutória de parasitologia, mas o texto
 * não é de autoria da Ynara e deve ser revisado por ela antes de publicar.
 */
export const featuredOrganism: FeaturedOrganism = {
  status: "placeholder",
  source: null,
  scientificName: "Giardia lamblia",
  commonName: "giárdia",
  tagline: "Pequena no tamanho, grande no impacto.",
  summary:
    "Um protozoário flagelado do intestino delgado, associado à giardíase. Tem forma de pera, dois núcleos que lembram olhos e um disco adesivo com o qual se fixa à parede do intestino.",
  facts: [
    { label: "Grupo", value: "Protozoário flagelado" },
    { label: "Doença associada", value: "Giardíase" },
    {
      label: "Transmissão",
      value: "Via fecal-oral, por cistos em água e alimentos contaminados",
    },
    { label: "Tamanho", value: "Trofozoíto de cerca de 10 a 20 µm" },
    { label: "Ocorrência", value: "Distribuição mundial" },
  ],
  media: {
    kind: "illustration",
    specimen: "giardia",
    alt: "Ilustração esquemática de um protozoário em forma de pera, com dois núcleos, disco adesivo e flagelos.",
    credit:
      "Esquema simplificado gerado em código. Não é micrografia nem registro de laboratório.",
  },
  relatedPostSlug: "giardia-um-pequeno-organismo-com-grande-impacto",
  provisionalNote:
    "Organismo provisório. A escolha final será da autora. Texto de exemplo, sem autoria.",
};
