/**
 * Registro curado do CDC DPDx (Laboratório Interativo).
 *
 * O DPDx NÃO tem API pública estruturada (confirmado em 2026-10-11: o site é HTML estático e o
 * acesso automatizado por cliente HTTP comum é bloqueado pela proteção do cdc.gov). A integração é,
 * portanto, um conjunto pequeno de registros REVISADOS à mão, cada um com página de origem, legenda
 * literal, checagem de crédito de terceiros e base de uso. Nada aqui é raspado em tempo de execução.
 *
 * Regra de direitos (docs/phase2-scientific-content-architecture.md §5): cada imagem é uma decisão
 * própria. Uma afirmação genérica da página ("a maior parte do material é livre de direitos
 * autorais") só contribui como evidência; um crédito de terceiros na legenda bloqueia a imagem.
 */

export type DpdxRightsStatus = "permitted" | "permission_required" | "unverified" | "prohibited";

export interface DpdxRights {
  status: DpdxRightsStatus;
  /** Declaração aplicável, em português, com a base legal/política usada. */
  basis: string;
  evidenceUrl: string;
  verifiedAt: string;
  verifier: "documented-review";
  /** Crédito de terceiros presente na legenda do CDC, literal. `null` = nenhum crédito encontrado. */
  thirdPartyCredit: string | null;
  attributionText: string;
}

export interface DpdxImage {
  id: string;
  organismSlug: string;
  /** Nome científico como aparece na legenda do CDC (pode ser um complexo, ex.: E. histolytica/E. dispar). */
  taxonLabelInCaption: string;
  /** Forma diagnóstica, distinta da espécie. */
  stage: { pt: string; en: string };
  preparation: { pt: string; en: string };
  figureLabel: string;
  /** Legenda literal do CDC (inglês). */
  captionEn: string;
  /** Tradução para o português, marcada como tradução na interface. */
  captionPt: string;
  /** Observações tiradas SOMENTE da legenda; nenhuma anotação é inventada. */
  notes: Array<{ pt: string; fromCaption: string }>;
  /** Alternativa textual: descreve o que a legenda afirma, não o que o olho "vê". */
  alt: string;
  /**
   * Cópia local, sem alteração, em /images/dpdx (manifesto com SHA-256 em public/images/dpdx/MANIFEST.json).
   * `null` quando a imagem não é exibida: nenhum arquivo de imagem retida entra no repositório.
   */
  imageUrl: string | null;
  /** Endereço original do arquivo no cdc.gov (procedência; não é carregado pelo navegador do visitante). */
  sourceImageUrl: string;
  /** Dimensões nativas medidas no navegador em 2026-10-11. */
  width: number;
  height: number;
  sourcePageUrl: string;
  sourcePageLastReviewed: string;
  rights: DpdxRights;
}

export interface DpdxOrganism {
  slug: string;
  scientificName: string;
  commonNamePt: string | null;
  dpdxPageUrl: string;
  dpdxPageTitle: string;
  pageLastReviewed: string;
  /** Nome científico a pesquisar no Atlas (NCBI) e no mapa (GBIF); a identidade é resolvida ao vivo. */
  lookupName: string;
}

const ABOUT_URL = "https://www.cdc.gov/dpdx/about.html";
const POLICY_URL = "https://www.cdc.gov/other/agencymaterials.html";
const REVIEWED_AT = "2026-10-11";

export const dpdxSourceStatements = {
  about: {
    url: ABOUT_URL,
    summary:
      "A página 'About DPDx' afirma que a maior parte do material é livre de direitos autorais, pede a citação da fonte e nomeia como protegidos apenas: imagens do ciclo de vida de Blastocystis e Pneumocystis e micrografias eletrônicas de Gnathostoma.",
  },
  policy: {
    url: POLICY_URL,
    summary:
      "A política de materiais do CDC (revisada em 1º/5/2023) diz que a maior parte do conteúdo é de domínio público, pede crédito ao CDC, aviso de não endosso, conteúdo inalterado, e ressalva que imagens de contratados, terceiros e governos estaduais/locais podem ter restrições.",
  },
} as const;

export const dpdxOrganisms: readonly DpdxOrganism[] = [
  {
    slug: "giardia-duodenalis",
    scientificName: "Giardia duodenalis",
    commonNamePt: "giárdia",
    dpdxPageUrl: "https://www.cdc.gov/dpdx/giardiasis/index.html",
    dpdxPageTitle: "DPDx: Giardiasis",
    pageLastReviewed: "2024-06-05",
    lookupName: "Giardia duodenalis",
  },
  {
    slug: "plasmodium-falciparum",
    scientificName: "Plasmodium falciparum",
    commonNamePt: null,
    dpdxPageUrl: "https://www.cdc.gov/dpdx/malaria/index.html",
    dpdxPageTitle: "DPDx: Malaria",
    pageLastReviewed: "2024-12-13",
    lookupName: "Plasmodium falciparum",
  },
  {
    slug: "trypanosoma-cruzi",
    scientificName: "Trypanosoma cruzi",
    commonNamePt: null,
    dpdxPageUrl: "https://www.cdc.gov/dpdx/trypanosomiasisamerican/index.html",
    dpdxPageTitle: "DPDx: American Trypanosomiasis",
    pageLastReviewed: "2021-06-16",
    lookupName: "Trypanosoma cruzi",
  },
  {
    slug: "entamoeba-histolytica",
    scientificName: "Entamoeba histolytica",
    commonNamePt: null,
    dpdxPageUrl: "https://www.cdc.gov/dpdx/amebiasis/index.html",
    dpdxPageTitle: "DPDx: Amebiasis",
    pageLastReviewed: "2019-10-15",
    lookupName: "Entamoeba histolytica",
  },
];

const cdc = (path: string) => `https://www.cdc.gov/dpdx/${path}`;
const local = (id: string) => `/images/dpdx/${id}.jpg`;

function permitted(pageUrl: string): DpdxRights {
  return {
    status: "permitted",
    basis:
      "Sem crédito de terceiros na legenda desta figura; o assunto não está entre as exceções nomeadas pela página About DPDx; a política de materiais do CDC trata o conteúdo do próprio CDC como domínio público, com crédito à fonte. Revisão documental de engenharia, não parecer jurídico.",
    evidenceUrl: pageUrl,
    verifiedAt: REVIEWED_AT,
    verifier: "documented-review",
    thirdPartyCredit: null,
    attributionText: "Fonte: CDC DPDx (Division of Parasitic Diseases and Malaria). Imagem sem alterações.",
  };
}

function blocked(pageUrl: string, credit: string): DpdxRights {
  return {
    status: "permission_required",
    basis:
      "A legenda do CDC credita a imagem a um órgão ou laboratório de saúde pública estadual. A política do CDC ressalva que obras de governos estaduais e locais podem ter proteção autoral; sem permissão documentada, a imagem não é exibida.",
    evidenceUrl: pageUrl,
    verifiedAt: REVIEWED_AT,
    verifier: "documented-review",
    thirdPartyCredit: credit,
    attributionText: "Fonte: CDC DPDx. Imagem não exibida: crédito de terceiros na legenda.",
  };
}

const GIARDIA_PAGE = "https://www.cdc.gov/dpdx/giardiasis/index.html";
const MALARIA_PAGE = "https://www.cdc.gov/dpdx/malaria/index.html";
const CHAGAS_PAGE = "https://www.cdc.gov/dpdx/trypanosomiasisamerican/index.html";
const AMEBIASIS_PAGE = "https://www.cdc.gov/dpdx/amebiasis/index.html";

export const dpdxImages: readonly DpdxImage[] = [
  {
    id: "giardia-cyst-iodine",
    organismSlug: "giardia-duodenalis",
    taxonLabelInCaption: "G. duodenalis",
    stage: { pt: "Cisto", en: "Cyst" },
    preparation: { pt: "Preparação a fresco com iodo", en: "Wet mount, iodine" },
    figureLabel: "Figure A",
    captionEn: "Figure A: G. duodenalis cyst in a wet mount stained with iodine.",
    captionPt: "Figura A: cisto de G. duodenalis em preparação a fresco corada com iodo.",
    notes: [],
    alt: "Micrografia do CDC DPDx: cisto de Giardia duodenalis em preparação a fresco corada com iodo.",
    imageUrl: local("giardia-cyst-iodine"),
    sourceImageUrl: cdc("giardiasis/images/1/Giardia_cyst_wtmt.jpg"),
    width: 300,
    height: 300,
    sourcePageUrl: GIARDIA_PAGE,
    sourcePageLastReviewed: "2024-06-05",
    rights: permitted(GIARDIA_PAGE),
  },
  {
    id: "giardia-trophozoite-trichrome",
    organismSlug: "giardia-duodenalis",
    taxonLabelInCaption: "G. duodenalis",
    stage: { pt: "Trofozoíto", en: "Trophozoite" },
    preparation: { pt: "Coloração tricrômica", en: "Trichrome stain" },
    figureLabel: "Figure A",
    captionEn: "Figure A: G. duodenalis trophozoite stained with trichrome.",
    captionPt: "Figura A: trofozoíto de G. duodenalis corado com tricrômico.",
    notes: [],
    alt: "Micrografia do CDC DPDx: trofozoíto de Giardia duodenalis corado com tricrômico.",
    imageUrl: local("giardia-trophozoite-trichrome"),
    sourceImageUrl: cdc("giardiasis/images/5/Giardia_troph_tric.jpg"),
    width: 300,
    height: 300,
    sourcePageUrl: GIARDIA_PAGE,
    sourcePageLastReviewed: "2024-06-05",
    rights: permitted(GIARDIA_PAGE),
  },
  {
    id: "giardia-trophozoite-vermont",
    organismSlug: "giardia-duodenalis",
    taxonLabelInCaption: "G. duodenalis",
    stage: { pt: "Trofozoíto", en: "Trophozoite" },
    preparation: { pt: "Coloração tricrômica", en: "Trichrome stain" },
    figureLabel: "Figure D",
    captionEn: "Figure D: G. duodenalis trophozoites. Image contributed by the Vermont Department of Health Laboratory.",
    captionPt: "Figura D: trofozoítos de G. duodenalis. Imagem contribuída pelo Laboratório do Departamento de Saúde de Vermont.",
    notes: [],
    alt: "Imagem não exibida: crédito de terceiros.",
    imageUrl: null,
    sourceImageUrl: cdc("giardiasis/images/5/Giardia_troph_VT.jpg"),
    width: 300,
    height: 300,
    sourcePageUrl: GIARDIA_PAGE,
    sourcePageLastReviewed: "2024-06-05",
    rights: blocked(GIARDIA_PAGE, "Vermont Department of Health Laboratory"),
  },
  {
    id: "pfalciparum-rings-thin",
    organismSlug: "plasmodium-falciparum",
    taxonLabelInCaption: "P. falciparum",
    stage: { pt: "Formas em anel", en: "Rings (ring-form trophozoites)" },
    preparation: { pt: "Esfregaço sanguíneo fino", en: "Thin blood smear" },
    figureLabel: "Figure G",
    captionEn: "Figure G: Rings of P. falciparum in a thin blood smear.",
    captionPt: "Figura G: formas em anel de P. falciparum em esfregaço sanguíneo fino.",
    notes: [],
    alt: "Micrografia do CDC DPDx: formas em anel de Plasmodium falciparum em esfregaço sanguíneo fino.",
    imageUrl: local("pfalciparum-rings-thin"),
    sourceImageUrl: cdc("malaria/images/1/Pf_rings_thinA.jpg"),
    width: 300,
    height: 300,
    sourcePageUrl: MALARIA_PAGE,
    sourcePageLastReviewed: "2024-12-13",
    rights: permitted(MALARIA_PAGE),
  },
  {
    id: "pfalciparum-gametocyte-thin",
    organismSlug: "plasmodium-falciparum",
    taxonLabelInCaption: "P. falciparum",
    stage: { pt: "Gametócito", en: "Gametocyte" },
    preparation: { pt: "Esfregaço sanguíneo fino", en: "Thin blood smear" },
    figureLabel: "Figure E",
    captionEn:
      "Figure E: Gametocyte of P. falciparum in a thin blood smear. Also seen in this image are ring-form trophozoites exhibiting Maurer's clefts.",
    captionPt:
      "Figura E: gametócito de P. falciparum em esfregaço sanguíneo fino. A imagem também mostra trofozoítos em anel com fendas de Maurer.",
    notes: [
      {
        pt: "Além do gametócito, a legenda indica trofozoítos em anel com fendas de Maurer na mesma imagem.",
        fromCaption: "Also seen in this image are ring-form trophozoites exhibiting Maurer's clefts.",
      },
    ],
    alt: "Micrografia do CDC DPDx: gametócito de Plasmodium falciparum em esfregaço sanguíneo fino, com trofozoítos em anel na mesma imagem.",
    imageUrl: local("pfalciparum-gametocyte-thin"),
    sourceImageUrl: cdc("malaria/images/4/Pf_gametocyte_thinB.jpg"),
    width: 300,
    height: 300,
    sourcePageUrl: MALARIA_PAGE,
    sourcePageLastReviewed: "2024-12-13",
    rights: permitted(MALARIA_PAGE),
  },
  {
    id: "pfalciparum-rings-arizona",
    organismSlug: "plasmodium-falciparum",
    taxonLabelInCaption: "P. falciparum",
    stage: { pt: "Formas em anel", en: "Rings (ring-form trophozoites)" },
    preparation: { pt: "Esfregaço sanguíneo fino", en: "Thin blood smear" },
    figureLabel: "Figure L",
    captionEn: "Figure L: Rings of P. falciparum in a thin blood smear. Image courtesy of the Arizona State Public Health Laboratory.",
    captionPt: "Figura L: formas em anel de P. falciparum em esfregaço sanguíneo fino. Imagem cedida pelo Laboratório de Saúde Pública do Estado do Arizona.",
    notes: [],
    alt: "Imagem não exibida: crédito de terceiros.",
    imageUrl: null,
    sourceImageUrl: cdc("malaria/images/1/Pf_rings_thinF_AZPHL.jpg"),
    width: 300,
    height: 300,
    sourcePageUrl: MALARIA_PAGE,
    sourcePageLastReviewed: "2024-12-13",
    rights: blocked(MALARIA_PAGE, "Arizona State Public Health Laboratory"),
  },
  {
    id: "tcruzi-trypomastigote-giemsa",
    organismSlug: "trypanosoma-cruzi",
    taxonLabelInCaption: "T. cruzi",
    stage: { pt: "Tripomastigota", en: "Trypomastigote" },
    preparation: { pt: "Esfregaço sanguíneo fino, Giemsa", en: "Thin blood smear, Giemsa" },
    figureLabel: "Figure A",
    captionEn:
      "Figure A: T. cruzi trypomastigote in a thin blood smear stained with Giemsa. Note the typical C-shape of the trypomastigote that characterizes T. cruzi in fixed blood smears.",
    captionPt:
      "Figura A: tripomastigota de T. cruzi em esfregaço sanguíneo fino corado com Giemsa. Observe a forma típica em C do tripomastigota, que caracteriza T. cruzi em esfregaços sanguíneos fixados.",
    notes: [
      {
        pt: "Segundo a legenda, a forma em C é típica do tripomastigota de T. cruzi em esfregaços fixados.",
        fromCaption: "Note the typical C-shape of the trypomastigote that characterizes T. cruzi in fixed blood smears.",
      },
    ],
    alt: "Micrografia do CDC DPDx: tripomastigota de Trypanosoma cruzi em esfregaço sanguíneo fino corado com Giemsa.",
    imageUrl: local("tcruzi-trypomastigote-giemsa"),
    sourceImageUrl: cdc("trypanosomiasisamerican/images/2/Tcruzi_thin_giemsa.jpg"),
    width: 300,
    height: 300,
    sourcePageUrl: CHAGAS_PAGE,
    sourcePageLastReviewed: "2021-06-16",
    rights: permitted(CHAGAS_PAGE),
  },
  {
    id: "tcruzi-amastigotes-heart",
    organismSlug: "trypanosoma-cruzi",
    taxonLabelInCaption: "Trypanosoma cruzi",
    stage: { pt: "Amastigota (em tecido)", en: "Amastigote (in tissue)" },
    preparation: { pt: "Corte de tecido cardíaco, H&E", en: "Heart tissue section, H&E" },
    figureLabel: "Figure A",
    captionEn:
      "Figure A: Trypanosoma cruzi amastigotes in heart tissue. The section is stained with hematoxylin and eosin (H&E).",
    captionPt:
      "Figura A: amastigotas de Trypanosoma cruzi em tecido cardíaco. O corte é corado com hematoxilina e eosina (H&E).",
    notes: [],
    alt: "Micrografia do CDC DPDx: amastigotas de Trypanosoma cruzi em corte de tecido cardíaco corado com hematoxilina e eosina.",
    imageUrl: local("tcruzi-amastigotes-heart"),
    sourceImageUrl: cdc("trypanosomiasisamerican/images/5/Tcruzi_tissue_he.jpg"),
    width: 300,
    height: 300,
    sourcePageUrl: CHAGAS_PAGE,
    sourcePageLastReviewed: "2021-06-16",
    rights: permitted(CHAGAS_PAGE),
  },
  {
    id: "ehistolytica-cyst-trichrome",
    organismSlug: "entamoeba-histolytica",
    taxonLabelInCaption: "E. histolytica/E. dispar",
    stage: { pt: "Cisto", en: "Cyst" },
    preparation: { pt: "Coloração tricrômica", en: "Trichrome stain" },
    figureLabel: "Figure A",
    captionEn:
      "Figure A: Cyst of E. histolytica/E. dispar stained with trichrome. Note the chromatoid body with blunt ends (red arrow).",
    captionPt:
      "Figura A: cisto de E. histolytica/E. dispar corado com tricrômico. Observe o corpo cromatoide de extremidades arredondadas (seta vermelha).",
    notes: [
      {
        pt: "A legenda nomeia o complexo E. histolytica/E. dispar: a fonte não atribui esta imagem a uma única espécie.",
        fromCaption: "Cyst of E. histolytica/E. dispar stained with trichrome.",
      },
      {
        pt: "A seta vermelha faz parte da imagem original e marca o corpo cromatoide, segundo a legenda.",
        fromCaption: "Note the chromatoid body with blunt ends (red arrow).",
      },
    ],
    alt: "Micrografia do CDC DPDx: cisto do complexo Entamoeba histolytica/E. dispar corado com tricrômico; seta vermelha na imagem original indica o corpo cromatoide.",
    imageUrl: local("ehistolytica-cyst-trichrome"),
    sourceImageUrl: cdc("amebiasis/images/2/Ehistdisp_cyst_tric.jpg"),
    width: 300,
    height: 300,
    sourcePageUrl: AMEBIASIS_PAGE,
    sourcePageLastReviewed: "2019-10-15",
    rights: permitted(AMEBIASIS_PAGE),
  },
  {
    id: "ehistolytica-trophozoite-trichrome",
    organismSlug: "entamoeba-histolytica",
    taxonLabelInCaption: "E. histolytica",
    stage: { pt: "Trofozoíto", en: "Trophozoite" },
    preparation: { pt: "Coloração tricrômica", en: "Trichrome stain" },
    figureLabel: "Figure A",
    captionEn:
      "Figure A: Trophozoite of E. histolytica with ingested erythrocytes stained with trichrome. The ingested erythrocytes appear as dark inclusions. The parasite above shows nuclei that have the typical small, centrally located karyosome, and thin, uniform peripheral chromatin.",
    captionPt:
      "Figura A: trofozoíto de E. histolytica com eritrócitos ingeridos, corado com tricrômico. Os eritrócitos ingeridos aparecem como inclusões escuras. O parasita acima mostra núcleos com o cariossoma típico, pequeno e central, e cromatina periférica fina e uniforme.",
    notes: [
      {
        pt: "Segundo a legenda, os eritrócitos ingeridos aparecem como inclusões escuras.",
        fromCaption: "The ingested erythrocytes appear as dark inclusions.",
      },
    ],
    alt: "Micrografia do CDC DPDx: trofozoíto de Entamoeba histolytica com eritrócitos ingeridos, corado com tricrômico.",
    imageUrl: local("ehistolytica-trophozoite-trichrome"),
    sourceImageUrl: cdc("amebiasis/images/6/Ehisto_troph_tric3.jpg"),
    width: 300,
    height: 300,
    sourcePageUrl: AMEBIASIS_PAGE,
    sourcePageLastReviewed: "2019-10-15",
    rights: permitted(AMEBIASIS_PAGE),
  },
  {
    id: "ehistolytica-cyst-kansas",
    organismSlug: "entamoeba-histolytica",
    taxonLabelInCaption: "E. histolytica/E. dispar",
    stage: { pt: "Cisto imaturo", en: "Immature cyst" },
    preparation: { pt: "Coloração tricrômica", en: "Trichrome stain" },
    figureLabel: "Figure B",
    captionEn:
      "Figure B: Immature cyst of E. histolytica/E. dispar stained with trichrome. Image taken at 1000x oil magnification and contributed by the Kansas Department of Health and Environment.",
    captionPt:
      "Figura B: cisto imaturo de E. histolytica/E. dispar corado com tricrômico. Imagem tirada com objetiva de imersão em óleo de 1000x e contribuída pelo Departamento de Saúde e Meio Ambiente do Kansas.",
    notes: [],
    alt: "Imagem não exibida: crédito de terceiros.",
    imageUrl: null,
    sourceImageUrl: cdc("amebiasis/images/3/Ehistdisp_cyst_tric5_KS.jpg"),
    width: 300,
    height: 300,
    sourcePageUrl: AMEBIASIS_PAGE,
    sourcePageLastReviewed: "2019-10-15",
    rights: blocked(AMEBIASIS_PAGE, "Kansas Department of Health and Environment"),
  },
];

// ---------------------------------------------------------------------------------------------
// Portão de direitos
// ---------------------------------------------------------------------------------------------

const SOURCE_IMAGE_PATTERN = /^https:\/\/www\.cdc\.gov\/dpdx\/[a-z]+\/images\/\d{1,3}\/[A-Za-z0-9_.-]+\.jpg$/;
const LOCAL_IMAGE_PATTERN = /^\/images\/dpdx\/[a-z0-9-]+\.jpg$/;
const PAGE_URL_PATTERN = /^https:\/\/www\.cdc\.gov\/dpdx\/[a-z]+\/index\.html$/;

/** Imagem aprovada pelo portão: `imageUrl` garantidamente presente. */
export type ShownDpdxImage = DpdxImage & { imageUrl: string };

export type ImageGateDecision =
  | { show: true; image: ShownDpdxImage }
  | { show: false; image: DpdxImage; reason: "IMAGE_PERMISSION_REQUIRED" | "IMAGE_RIGHTS_UNVERIFIED" | "IMAGE_REUSE_PROHIBITED" };

/**
 * Decide se a imagem pode ser exibida. Falha fechado: qualquer lacuna na evidência (URL fora do
 * padrão, crédito de terceiros, ausência de data/atribuição) bloqueia.
 */
export function gateImage(image: DpdxImage): ImageGateDecision {
  const r = image.rights;
  if (r.status === "prohibited") return { show: false, image, reason: "IMAGE_REUSE_PROHIBITED" };
  if (r.status === "permission_required" || r.thirdPartyCredit !== null) {
    return { show: false, image, reason: "IMAGE_PERMISSION_REQUIRED" };
  }
  const evidenceComplete =
    r.status === "permitted" &&
    r.verifier === "documented-review" &&
    r.attributionText.trim().length > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(r.verifiedAt) &&
    PAGE_URL_PATTERN.test(r.evidenceUrl) &&
    PAGE_URL_PATTERN.test(image.sourcePageUrl) &&
    image.imageUrl !== null &&
    LOCAL_IMAGE_PATTERN.test(image.imageUrl) &&
    SOURCE_IMAGE_PATTERN.test(image.sourceImageUrl);
  if (!evidenceComplete || image.imageUrl === null) return { show: false, image, reason: "IMAGE_RIGHTS_UNVERIFIED" };
  return { show: true, image: { ...image, imageUrl: image.imageUrl } };
}

export function imagesForOrganism(slug: string) {
  const all = dpdxImages.filter((image) => image.organismSlug === slug).map(gateImage);
  return {
    shown: all.filter((d): d is Extract<ImageGateDecision, { show: true }> => d.show).map((d) => d.image),
    withheld: all.filter((d): d is Extract<ImageGateDecision, { show: false }> => !d.show),
  };
}

export function findOrganism(slug: string | null | undefined) {
  return dpdxOrganisms.find((organism) => organism.slug === slug) ?? null;
}

/** Organismo do Laboratório cujo nome científico coincide com algum dos nomes dados (sem diferenciar caixa). */
export function findDpdxOrganismByName(names: readonly string[]) {
  const wanted = new Set(names.map((n) => n.trim().toLowerCase()));
  return dpdxOrganisms.find((organism) => wanted.has(organism.scientificName.toLowerCase())) ?? null;
}
