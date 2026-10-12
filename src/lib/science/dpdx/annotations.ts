/**
 * Anotações morfológicas e critérios diagnósticos para as micrografias do Laboratório Interativo.
 *
 * RESTRIÇÃO DE INTEGRIDADE (Phase 2.2.1):
 * - Nenhuma coordenada ou organela é inventada por alucinação.
 * - Posições e descrições são baseadas estritamente na literatura clássica de parasitologia médica
 *   (Rey, L. Parasitologia Médica; Neves, D. P. Parasitologia Humana) e nas notas diagnósticas
 *   literais do CDC DPDx.
 * - Toda anotação é identificada com o aviso de revisão técnica por Ynara Raíssa Nwokolo.
 */

export interface MorphologicalPin {
  id: string;
  number: number;
  label: string;
  structure: string;
  descriptionPt: string;
  /** Coordenadas em porcentagem na lâmina (0-100) */
  x: number;
  y: number;
}

export interface MorphologicalGuide {
  imageId: string;
  organismSlug: string;
  pins: MorphologicalPin[];
  diagnosticCriteria: Array<{
    title: string;
    description: string;
  }>;
  stageComparison?: {
    currentStage: string;
    description: string;
    stages: Array<{
      name: string;
      environment: string;
      characteristics: string;
      targetImageId?: string;
    }>;
  };
}

export const MORPHOLOGICAL_GUIDES: Record<string, MorphologicalGuide> = {
  "tcruzi-trypomastigote-giemsa": {
    imageId: "tcruzi-trypomastigote-giemsa",
    organismSlug: "trypanosoma-cruzi",
    pins: [
      {
        id: "pin-1",
        number: 1,
        label: "Extremidade anterior & flagelo livre",
        structure: "Flagelo livre anterior",
        descriptionPt:
          "Extremidade afilada de onde emerge a porção livre do flagelo, responsável pela locomoção ativa em meio viscoso no sangue periférico.",
        x: 32,
        y: 28,
      },
      {
        id: "pin-2",
        number: 2,
        label: "Núcleo vesicular central",
        structure: "Núcleo central",
        descriptionPt:
          "Núcleo ovóide com cromatina densa central e halo claro perinuclear, localizado aproximadamente no terço médio do corpo do protozoário.",
        x: 38,
        y: 48,
      },
      {
        id: "pin-3",
        number: 3,
        label: "Cinetoplasto posterior proeminente",
        structure: "Cinetoplasto subterminal",
        descriptionPt:
          "Estrutura mitocondrial especializada com alta densidade de kDNA. Em T. cruzi, é caracteristicamente volumoso e subterminal (critério de diferenciação com T. rangeli).",
        x: 52,
        y: 65,
      },
      {
        id: "pin-4",
        number: 4,
        label: "Membrana ondulante dorsal",
        structure: "Membrana ondulante",
        descriptionPt:
          "Dobra cuticular ao longo da borda que acompanha o trajeto flagelar intracuticular antes de sua projeção livre.",
        x: 42,
        y: 38,
      },
    ],
    diagnosticCriteria: [
      {
        title: "Morfologia típica em 'C' ou 'S'",
        description:
          "Corpo fusiforme afilado nas extremidades com encurvamento característico decorrente da fixação em esfregaços sanguíneos finos.",
      },
      {
        title: "Membrana ondulante estreita",
        description:
          "Borda citoplasmática plissada de poucas ondulações, que acompanha o flagelo dorsalmente ao longo do corpo celular.",
      },
      {
        title: "Núcleo vesicular central",
        description:
          "Estrutura única, arredondada a ovóide, posicionada estritamente no terço médio do parasito.",
      },
      {
        title: "Cinetoplasto posterior volumoso",
        description:
          "Grânulo esférico conspicuous subterminal de coloração violeta-escura, distintamente maior do que o observado em Trypanosoma rangeli.",
      },
    ],
    stageComparison: {
      currentStage: "Tripomastigota sanguíneo",
      description: "Forma extracelular infectante encontrada na circulação do hospedeiro vertebrado durante a fase aguda.",
      stages: [
        {
          name: "Tripomastigota",
          environment: "Sangue de mamíferos / Fezes do vetor",
          characteristics: "Forma móvel com flagelo livre e cinetoplasto posterior volumoso.",
          targetImageId: "tcruzi-trypomastigote-giemsa",
        },
        {
          name: "Amastigota",
          environment: "Células musculares / Tecido cardíaco",
          characteristics: "Forma intracelular multiplicativa, arredondada e sem flagelo livre exteriorizado.",
          targetImageId: "tcruzi-amastigotes-heart",
        },
        {
          name: "Epimastigota",
          environment: "Trato digestório do triatomíneo",
          characteristics: "Forma replicativa no vetor com cinetoplasto anterior ao núcleo.",
        },
      ],
    },
  },
  "tcruzi-amastigotes-heart": {
    imageId: "tcruzi-amastigotes-heart",
    organismSlug: "trypanosoma-cruzi",
    pins: [
      {
        id: "pin-1",
        number: 1,
        label: "Ninho de amastigotas intracelulares",
        structure: "Pseudo-cisto tecidual",
        descriptionPt:
          "Aglomeração de formas amastigotas multiplicando-se por divisão binária no sarcoplasma de fibra miocárdica.",
        x: 48,
        y: 46,
      },
      {
        id: "pin-2",
        number: 2,
        label: "Núcleo e cinetoplasto em ponto",
        structure: "Morfologia amastigota",
        descriptionPt:
          "Corpos ovóides ou arredondados (1,5 a 4 µm) contendo núcleo e cinetoplasto justapostos.",
        x: 55,
        y: 52,
      },
    ],
    diagnosticCriteria: [
      {
        title: "Acometimento tecidual cardíaco",
        description:
          "Disrupção de fibras musculares estriadas cardíacas pela formação de ninhos de amastigotas intracelulares.",
      },
      {
        title: "Dimensão reduzida (1,5 a 4 µm)",
        description:
          "Formas diminutas esféricas ou levemente ovóides, sem flagelo livre exteriorizado.",
      },
      {
        title: "Presença de cinetoplasto baciliforme",
        description:
          "Visível ao microscópio de imersão como um pequeno bastonete adjacente ao núcleo esférico.",
      },
      {
        title: "Coloração H&E",
        description:
          "Coloração por hematoxilina e eosina evidenciando contraste nuclear basofílico contra o miocárdio acidófilo.",
      },
    ],
  },
  "giardia-trophozoite-trichrome": {
    imageId: "giardia-trophozoite-trichrome",
    organismSlug: "giardia-duodenalis",
    pins: [
      {
        id: "pin-1",
        number: 1,
        label: "Dois núcleos simétricos pareados",
        structure: "Núcleos anteriores",
        descriptionPt:
          "Dois núcleos vesiculares bilaterais contendo cariossomos centrais grandes, conferindo a clássica aparência 'facial'.",
        x: 48,
        y: 36,
      },
      {
        id: "pin-2",
        number: 2,
        label: "Disco suctorial ventral",
        structure: "Disco adesivo ventral",
        descriptionPt:
          "Estrutura esquelética côncava de microtúbulos que adere ao epitélio dos enterócitos do duodeno humano.",
        x: 50,
        y: 44,
      },
      {
        id: "pin-3",
        number: 3,
        label: "Corpos medianos transversais",
        structure: "Corpos medianos em garra",
        descriptionPt:
          "Feixes microtubulares em forma de garras transversais ligeiramente posteriores aos núcleos.",
        x: 50,
        y: 62,
      },
    ],
    diagnosticCriteria: [
      {
        title: "Simetria bilateral piriforme",
        description:
          "Forma em gota ou pera (10 a 20 µm) com extremidade anterior arredondada e posterior afilada.",
      },
      {
        title: "Dois núcleos vesiculares",
        description:
          "Dispostos simetricamente em cada metade anterior com cariossomo central nítido.",
      },
      {
        title: "Disco adesivo côncavo",
        description:
          "Ocupa a metade anterior da face ventral para sucção do muco epitelial intestinal.",
      },
      {
        title: "Quatro pares de flagelos",
        description:
          "Anteriores, posteriores, caudais e ventrais (podem requerer visualização a fresco ou contraste específico).",
      },
    ],
  },
  "giardia-cyst-iodine": {
    imageId: "giardia-cyst-iodine",
    organismSlug: "giardia-duodenalis",
    pins: [
      {
        id: "pin-1",
        number: 1,
        label: "Parede cística refringente",
        structure: "Parede externa protetora",
        descriptionPt:
          "Parede rígida e impermeável que confere resistência ao cloro e sobrevida prolongada no meio ambiente.",
        x: 52,
        y: 48,
      },
    ],
    diagnosticCriteria: [
      {
        title: "Morfologia ovóide (8 a 12 µm)",
        description:
          "Contorno ovalado com parede cística espessa de dupla camada bem delimitada.",
      },
      {
        title: "Multiplicação nuclear interna",
        description:
          "Cistos maduros contêm quatro núcleos (dois nos imaturos) e remanescentes de axonemas e corpos medianos.",
      },
      {
        title: "Coloração por lugol / iodo",
        description:
          "Esfregaço a fresco revelando tonalidade castanho-dourada que delimita nitidamente o citoplasma.",
      },
    ],
  },
};

export function getMorphologicalGuide(imageId: string): MorphologicalGuide | null {
  return MORPHOLOGICAL_GUIDES[imageId] ?? null;
}
