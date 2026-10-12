/**
 * Curadoria editorial científica para o Atlas do Invisível e Onde Vivem.
 *
 * Fornece sínteses contextuais, relevância científica e relações taxonômicas
 * para organismos de interesse em parasitologia e biologia microscópica,
 * mantendo estrita fidelidade científica e separação de procedência.
 */

export interface OrganismCuration {
  category: string;
  subtitle: string;
  overview: string;
  scientificImportance: string;
  morphologySummary: string;
  lifeCycleSummary: string;
  hostsSummary: string;
  relatedTaxa: Array<{
    name: string;
    taxId: string;
    relationship: string;
    note: string;
    thumbnail?: string;
  }>;
}

export const CURATED_ORGANISMS: Record<string, OrganismCuration> = {
  "trypanosoma cruzi": {
    category: "Protozoário",
    subtitle: "Protozoário parasita associado à doença de Chagas.",
    overview:
      "Trypanosoma cruzi é um protozoário parasita da ordem Trypanosomatida, responsável pela doença de Chagas. Possui ciclo de vida complexo, envolvendo o inseto vetor (triatomíneos) e mamíferos. Apresenta diferentes formas morfológicas ao longo do ciclo, como tripomastigota, amastigota e epimastigota.",
    scientificImportance:
      "T. cruzi é amplamente estudado por sua relevância médica e por seu impacto na saúde pública na América Latina.",
    morphologySummary:
      "Apresenta três formas principais bem caracterizadas: tripomastigotas sanguíneos e metacíclicos (alongados, com cinetoplasto posterior e membrana ondulante livre), amastigotas intracelulares (esféricos ou ovalados, replicativos) e epimastigotas (cinetoplasto justanuclear, presentes no vetor).",
    lifeCycleSummary:
      "Ciclo heteroxênico obrigatório: tripomastigotas eliminados nas fezes ou urina do triatomíneo durante o repasto penetram por lesão cutânea ou mucosa, invadem células de mamíferos, diferenciam-se em amastigotas, multiplicam-se e liberam novos tripomastigotas na circulação.",
    hostsSummary:
      "Vetores invertebrados: hemípteros da subfamília Triatominae (barbeiros, como Triatoma infestans, Panstrongylus megistus e Rhodnius prolixus). Hospedeiros vertebrados: humanos e mamíferos silvestres ou domésticos (cães, gatos, gambás, tatus).",
    relatedTaxa: [
      {
        name: "Trypanosoma brucei",
        taxId: "5692",
        relationship: "Relacionado · Mesmo gênero",
        note: "Agente da tripanossomíase africana (doença do sono)",
      },
      {
        name: "Leishmania donovani",
        taxId: "5661",
        relationship: "Mesma família",
        note: "Causador de leishmaniose visceral",
      },
      {
        name: "Plasmodium vivax",
        taxId: "5855",
        relationship: "Outro protozoário de interesse",
        note: "Parasita causador de malária",
      },
    ],
  },
  "trypanosoma brucei": {
    category: "Protozoário",
    subtitle: "Agente etiológico da tripanossomíase africana (doença do sono).",
    overview:
      "Trypanosoma brucei é um protozoário hemoflagelado transmitido pela mosca tsé-tsé (gênero Glossina). É modelo clássico no estudo de variação antigênica por meio de suas glicoproteínas variantes de superfície (VSG).",
    scientificImportance:
      "Fundamental no entendimento dos mecanismos moleculares de evasão imune e transição metabólica entre hospedeiro mamífero e vetor inseto.",
    morphologySummary:
      "Formas delgadas e curtas (slender e stumpy) na corrente sanguínea do mamífero, e procíclicas no intestino da mosca tsé-tsé.",
    lifeCycleSummary:
      "Transmitido pela picada da mosca tsé-tsé; multiplica-se nos fluidos corporais e sistema linfático antes de invadir o sistema nervoso central.",
    hostsSummary:
      "Vetores: moscas do gênero Glossina. Hospedeiros: humanos, ungulados e animais de criação na África subsaariana.",
    relatedTaxa: [
      {
        name: "Trypanosoma cruzi",
        taxId: "5691",
        relationship: "Mesmo gênero",
        note: "Agente da doença de Chagas",
      },
      {
        name: "Leishmania major",
        taxId: "5664",
        relationship: "Mesma família",
        note: "Leishmaniose cutânea",
      },
    ],
  },
  "giardia duodenalis": {
    category: "Protozoário flagelado",
    subtitle: "Protozoário parasita flagelado associado à giardíase intestinal.",
    overview:
      "Giardia duodenalis (sinônimo de Giardia lamblia) é um protozoário flagelado microaerofílico que habita o lúmen do intestino delgado humano e de outros mamíferos. Destaca-se pela simetria bilateral, presença de dois núcleos idênticos e disco adesivo ventral característico.",
    scientificImportance:
      "Uma das parasitoses intestinais mais frequentes em todo o mundo, com forte associação à contaminação de água e desafios de saneamento básico.",
    morphologySummary:
      "Trofozoítos piriformes achatados dorsoventralmente com 4 pares de flagelos e disco ventral rígido; cistos ovais tetranucleados resistentes no ambiente.",
    lifeCycleSummary:
      "Ingestão de cistos maduros via água ou alimento contaminado; desencistamento no duodeno; fixação de trofozoítos à mucosa intestinal; encistamento durante o trânsito colônico.",
    hostsSummary:
      "Hospedeiros vertebrados: humanos, cães, gatos, roedores e animais de criação.",
    relatedTaxa: [
      {
        name: "Entamoeba histolytica",
        taxId: "5759",
        relationship: "Parasita intestinal",
        note: "Protozoário entérico causador de amebíase",
      },
      {
        name: "Cryptosporidium parvum",
        taxId: "5807",
        relationship: "Protozoário entérico",
        note: "Causador de criptosporidiose",
      },
      {
        name: "Trichomonas vaginalis",
        taxId: "5722",
        relationship: "Parabasálio flagelado",
        note: "Parasita do trato urogenital",
      },
    ],
  },
  "plasmodium falciparum": {
    category: "Apicomplexa",
    subtitle: "Espécie de protozoário responsável pela forma mais severa de malária humana.",
    overview:
      "Plasmodium falciparum é um parasita unicelular intracelular obrigatório pertencente ao filo Apicomplexa. É o causador da malária terçã maligna, capaz de invadir eritrócitos de todas as idades e expressar adesinas de superfície que promovem citoaderência endotelial.",
    scientificImportance:
      "Maior causador de mortalidade por infecções parasitárias em escala global, central em pesquisas imunológicas, vacinais e genômicas.",
    morphologySummary:
      "Formas em anel delicadas dentro de eritrócitos, esquizontes contendo merozoítos agrupados e gametócitos falciformes característicos (em crescente/banana).",
    lifeCycleSummary:
      "Inoculação de esporozoítos por mosquito Anopheles fêmea; estágio hepático assexuado pré-eritrocítico; ciclos eritrocíticos líticos; gametogênese e reprodução sexuada no mosquito.",
    hostsSummary:
      "Vetor: fêmeas do mosquito Anopheles. Hospedeiro mamífero: seres humanos.",
    relatedTaxa: [
      {
        name: "Plasmodium vivax",
        taxId: "5855",
        relationship: "Mesmo gênero",
        note: "Agente de malária terçã benigna com hipnozoítos",
      },
      {
        name: "Toxoplasma gondii",
        taxId: "5811",
        relationship: "Mesmo filo (Apicomplexa)",
        note: "Parasita causador da toxoplasmose",
      },
      {
        name: "Trypanosoma cruzi",
        taxId: "5691",
        relationship: "Outro hemoflagelado",
        note: "Protozoário parasita das Américas",
      },
    ],
  },
  "entamoeba histolytica": {
    category: "Ameba parasita",
    subtitle: "Amebozoário causador da amebíase intestinal e hepática.",
    overview:
      "Entamoeba histolytica é uma ameba parasita invasiva que coloniza o intestino grosso humano, podendo provocar disenteria amebiana, úlceras em botão de camisa e abscessos hepáticos extraintestinais por disseminação hematogênica.",
    scientificImportance:
      "Relevante modelo de fagocitose e citotoxicidade celular dependente de contato, além de importante indicador de condições higiênico-sanitárias.",
    morphologySummary:
      "Trofozoítos ameboides móveis por pseudópodes digitiformes, frequentemente fagocitando hemácias; cistos esféricos com 1 a 4 núcleos e corpos cromatoides arredondados.",
    lifeCycleSummary:
      "Cistos tetranucleados ingeridos com água ou alimentos sobrevivem ao suco gástrico e eclodem no íleo terminal; trofozoítos colonizam o ceco e cólon ascendente.",
    hostsSummary:
      "Hospedeiro principal e reservatório natural: seres humanos.",
    relatedTaxa: [
      {
        name: "Giardia duodenalis",
        taxId: "5741",
        relationship: "Parasita intestinal",
        note: "Agente de diarreia por má absorção",
      },
      {
        name: "Balantidium coli",
        taxId: "71585",
        relationship: "Protozoário entérico",
        note: "Ciliado parasita intestinal",
      },
    ],
  },
};

export function getOrganismCuration(scientificName: string, synonyms: readonly string[] = []): OrganismCuration | null {
  const candidates = [scientificName, ...synonyms].map((n) => n.trim().toLowerCase());
  for (const c of candidates) {
    if (CURATED_ORGANISMS[c]) return CURATED_ORGANISMS[c];
  }
  return null;
}
