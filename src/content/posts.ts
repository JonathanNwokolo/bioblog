import type { Post } from "./types";

const ILLUSTRATION_CREDIT =
  "Ilustração gerada em código para o protótipo. Não é registro de laboratório nem imagem real de microscopia.";

/**
 * Diário de Bancada: posts de exemplo.
 *
 * São rotulados como demonstrativos (`status: "placeholder"`) e existem para
 * validar leitura, curtidas e comentários. Não simulam autoria da Ynara.
 * Os textos fazem apenas afirmações gerais e cautelosas; devem ser substituídos
 * pelos posts reais da autora.
 *
 * `baseLikes` é 0: não existe backend. A interface soma o que a pessoa faz
 * neste navegador (ver `src/lib/engagement.ts`).
 */
const entries: Post[] = [
  {
    id: "post-demo-001",
    slug: "larvas-de-helmintos-no-exame-parasitologico",
    status: "placeholder",
    source: null,
    title: "Como identificar larvas de helmintos no exame parasitológico?",
    excerpt:
      "Forma do corpo, tamanho e movimento ajudam a separar larvas de outros elementos da lâmina. Um roteiro de observação, em linguagem acessível.",
    body: [
      "Em um exame parasitológico de fezes, a lâmina mostra muito mais do que parasitas: restos de alimento, fibras vegetais, bolhas e células aparecem lado a lado. Aprender a olhar é, em grande parte, aprender a descartar.",
      "Larvas de helmintos costumam se destacar pelo corpo alongado, em forma de tubo, com estrutura interna organizada. Fibras e filamentos de origem vegetal, por outro lado, tendem a não ter essa organização.",
      "O tamanho e a presença de movimento, quando a amostra está fresca, também orientam a observação. A identificação da espécie, porém, depende de características que só um profissional treinado avalia com segurança.",
    ],
    publishedAt: "2026-10-10",
    tag: { label: "Identificação" },
    media: {
      kind: "illustration",
      specimen: "nematode",
      alt: "Ilustração de uma larva alongada e estriada atravessando um campo microscópico prateado.",
      credit: ILLUSTRATION_CREDIT,
    },
    baseLikes: 0,
  },
  {
    id: "post-demo-002",
    slug: "giardia-um-pequeno-organismo-com-grande-impacto",
    status: "placeholder",
    source: null,
    title: "Giárdia: um pequeno organismo com grande impacto",
    excerpt:
      "Entenda como esse protozoário se transmite e por que a prevenção é tão importante.",
    body: [
      "A giárdia (Giardia lamblia, também chamada de Giardia duodenalis ou Giardia intestinalis) é um protozoário flagelado que vive no intestino delgado. Na forma ativa, o trofozoíto, mede cerca de 10 a 20 micrômetros: só é visível ao microscópio.",
      "A transmissão acontece pela via fecal-oral. O parasita é eliminado nas fezes na forma de cistos, que resistem no ambiente e podem contaminar água e alimentos.",
      "Por isso, medidas de saneamento e higiene, como tratar a água e lavar as mãos, estão entre as principais formas de prevenção. Em caso de sintomas, a avaliação e o tratamento cabem a um profissional de saúde.",
    ],
    publishedAt: "2026-10-09",
    tag: { label: "Protozoários", organism: "Giardia lamblia" },
    media: {
      kind: "illustration",
      specimen: "giardia",
      alt: "Ilustração esquemática de um protozoário em forma de pera, com dois núcleos e flagelos, em um campo microscópico lilás.",
      credit: ILLUSTRATION_CREDIT,
    },
    baseLikes: 0,
  },
  {
    id: "post-demo-003",
    slug: "o-que-os-ovos-de-parasitas-podem-nos-contar",
    status: "placeholder",
    source: null,
    title: "O que os ovos de parasitas podem nos contar?",
    excerpt:
      "Casca, formato e tamanho dos ovos ajudam a reconhecer o parasita e dizem muito sobre o seu ciclo de vida.",
    body: [
      "Muitos helmintos liberam ovos nas fezes do hospedeiro, e é a morfologia desses ovos que, no laboratório, costuma guiar o diagnóstico: formato, tamanho, espessura da casca e o que há no interior.",
      "A casca é também uma estrutura de proteção. Ela permite que o ovo aguarde no ambiente até encontrar condições para continuar o ciclo de vida.",
      "Por isso, o mesmo exame que identifica a espécie ajuda a entender como a infecção se mantém e como interrompê-la.",
    ],
    publishedAt: "2026-10-08",
    tag: { label: "Diagnóstico" },
    media: {
      kind: "illustration",
      specimen: "egg",
      alt: "Ilustração de um ovo oval de casca dourada espessa sobre um campo microscópico bege.",
      credit: ILLUSTRATION_CREDIT,
    },
    baseLikes: 0,
  },
];

/** Rascunhos ficam fora do feed, do arquivo e das páginas individuais. */
export function isPublished(post: Post): boolean {
  return post.publication !== "draft";
}

/**
 * Mais recente primeiro. Desempate determinístico: data, depois `id`
 * (comparação numérica, "post-10" vem depois de "post-9") e por fim `slug`.
 */
export function comparePosts(a: Post, b: Post): number {
  if (a.publishedAt !== b.publishedAt) return a.publishedAt < b.publishedAt ? 1 : -1;
  const byId = b.id.localeCompare(a.id, "pt", { numeric: true });
  if (byId !== 0) return byId;
  return b.slug.localeCompare(a.slug, "pt", { numeric: true });
}

/** Publicados, sem repetição de `id`, ordenados do mais recente ao mais antigo. */
export function sortPublished(source: readonly Post[]): Post[] {
  const seen = new Set<string>();
  return source
    .filter(isPublished)
    .toSorted(comparePosts)
    .filter((post) => {
      if (seen.has(post.id)) return false;
      seen.add(post.id);
      return true;
    });
}

export interface DiarySplit {
  /** Publicação mais recente. `null` quando não há nada publicado. */
  lead: Post | null;
  /** Todas as demais, da mais recente à mais antiga. Nunca contém `lead`. */
  archive: Post[];
}

/** Deriva destaque e histórico da mesma coleção. Sem limite de itens. */
export function splitDiary(source: readonly Post[]): DiarySplit {
  const [lead = null, ...archive] = sortPublished(source);
  return { lead, archive };
}

/**
 * Posts publicados, do mais recente ao mais antigo. É a única coleção que a
 * interface consome: destaque e feed do Diário derivam dela (`splitDiary`).
 * Para publicar, acrescente uma entrada; se for a mais recente, assume o destaque.
 */
export const posts: Post[] = sortPublished(entries);

export function getPost(slug: string): Post | undefined {
  return posts.find((post) => post.slug === slug);
}
