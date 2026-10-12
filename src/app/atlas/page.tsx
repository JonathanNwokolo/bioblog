import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AtlasHero } from "@/components/science/AtlasHero";
import { ScienceShell } from "@/components/science/ScienceShell";
import { SourceDetails } from "@/components/science/SourceDetails";
import { StateNote } from "@/components/science/StateNote";
import { rankLabel } from "@/lib/science/present";
import { searchTaxaByName } from "@/lib/science/ncbi/service";
import { withinCallerBudget } from "@/lib/science/server";
import { userFacingProviderMessage } from "@/lib/science/types";
import sci from "@/components/science/Science.module.css";
import styles from "@/components/science/Atlas.module.css";

export const metadata: Metadata = {
  title: "Atlas do Invisível",
  description:
    "Pesquise um nome científico e veja a classificação do organismo no NCBI Taxonomy: nome aceito, sinônimos, categoria e hierarquia.",
};

const FEATURED_TAXA = [
  {
    name: "Trypanosoma cruzi",
    taxId: "5691",
    rank: "Espécie",
    group: "Protozoário flagelado",
    desc: "Parasita hemoflagelado agente da doença de Chagas, transmitido por triatomíneos (barbeiros).",
    thumbnail: "/images/science/atlas-hero.jpg",
  },
  {
    name: "Giardia duodenalis",
    taxId: "5741",
    rank: "Espécie",
    group: "Diplomonadida",
    desc: "Protozoário flagelado entérico com disco adesivo ventral, causador da giardíase intestinal.",
    thumbnail: "/images/science/ncbi-thumbnail.jpg",
  },
  {
    name: "Plasmodium falciparum",
    taxId: "5833",
    rank: "Espécie",
    group: "Apicomplexa",
    desc: "Protozoário intracelular responsável pela forma mais letal de malária humana, transmitido por Anopheles.",
    thumbnail: "/images/science/atlas-hero.jpg",
  },
  {
    name: "Entamoeba histolytica",
    taxId: "5759",
    rank: "Espécie",
    group: "Amebozoa",
    desc: "Ameba invasiva patogênica causadora da amebíase intestinal e hepática.",
    thumbnail: "/images/science/ncbi-thumbnail.jpg",
  },
];

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AtlasPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const q = first(params.q);
  const submitted = q !== undefined;

  return (
    <ScienceShell
      active="atlas"
      title="Atlas do Invisível"
      lede="De um nome científico à sua posição na árvore da vida. Os dados vêm do NCBI Taxonomy; o que a fonte não informa aparece como não informado."
      hero={<AtlasHero defaultValue={q} />}
    >
      <div className={sci.stack}>
        {submitted ? <Result query={q ?? ""} /> : <Intro />}
      </div>
    </ScienceShell>
  );
}

function Intro() {
  return (
    <div className={sci.stack}>
      {/* Seção de Organismos em Destaque */}
      <section className={sci.panel} aria-labelledby="heading-destaques">
        <h2 id="heading-destaques" className={sci.panelTitle}>
          Organismos microscópicos em destaque
        </h2>
        <p className={sci.hint} style={{ marginTop: 6 }}>
          Explore registros selecionados com linhagem completa e micrografias documentadas.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
            marginTop: 20,
          }}
        >
          {FEATURED_TAXA.map((taxon) => (
            <div
              key={taxon.taxId}
              style={{
                display: "flex",
                flexDirection: "column",
                background: "var(--surface-warm, #faf8f5)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-s)",
                overflow: "hidden",
                padding: 16,
                gap: 10,
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: 110,
                  borderRadius: 6,
                  overflow: "hidden",
                  background: "#090912",
                }}
              >
                <Image
                  src={taxon.thumbnail}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 100vw, 300px"
                  style={{ objectFit: "cover" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <strong lang="la" style={{ fontStyle: "italic", fontSize: "1.05rem" }}>
                  {taxon.name}
                </strong>
                <span className={sci.chip}>{taxon.rank}</span>
              </div>
              <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)", lineHeight: 1.45, margin: 0 }}>
                {taxon.desc}
              </p>
              <Link
                href={`/atlas/${taxon.taxId}`}
                className="btn btn--outline"
                style={{ marginTop: "auto", minHeight: 38, fontSize: "0.85rem", textAlign: "center" }}
              >
                Explorar no Atlas →
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Como ler o Atlas */}
      <div className={sci.panel}>
        <h2 className={sci.panelTitle}>Como navegar no Atlas do Invisível</h2>
        <ul className={sci.stack} style={{ marginTop: 14, color: "var(--ink-soft)" }}>
          <li>
            <strong style={{ color: "var(--ink)" }}>Nome aceito e sinônimos.</strong> A taxonomia se atualiza. Buscar um
            nome antigo (como <em>Giardia lamblia</em>) leva ao registro atual (<em>Giardia duodenalis</em>) com explicação
            explícita do sinônimo.
          </li>
          <li>
            <strong style={{ color: "var(--ink)" }}>Hierarquia taxonômica.</strong> Da raiz celular ao táxon consultado,
            cada nível exibe seu identificador oficial e permite navegar para grupos ancestrais.
          </li>
          <li>
            <strong style={{ color: "var(--ink)" }}>Incerteza e homônimos visíveis.</strong> Se o mesmo nome científico
            existe em reinos distintos (como bactérias e fungos), nenhum é escolhido automaticamente: os candidatos são
            apresentados com suas divisões correspondentes.
          </li>
        </ul>
        <p className={sci.disclaimer} style={{ marginTop: 18 }}>
          O NCBI Taxonomy cataloga nomes e classificação filogenética para os bancos de sequências do NCBI; não é uma
          autoridade taxonômica primária nem substitui tratados clínicos de parasitologia médica.
        </p>
      </div>
    </div>
  );
}

async function Result({ query }: { query: string }) {
  if (!(await withinCallerBudget())) {
    return (
      <StateNote title="Muitas consultas em pouco tempo" tone="error">
        {userFacingProviderMessage("CALLER_RATE_LIMITED")}
      </StateNote>
    );
  }

  const result = await searchTaxaByName(query);

  if (result.status === "verified") {
    redirect(`/atlas/${result.taxon.taxId}?q=${encodeURIComponent(result.query)}`);
  }

  if (result.status === "invalid_query") {
    return (
      <StateNote title="Essa busca não pôde ser feita" tone="error">
        {result.hint}
      </StateNote>
    );
  }

  if (result.status === "unavailable") {
    return (
      <StateNote title="O NCBI Taxonomy não respondeu" tone="error">
        {userFacingProviderMessage(result.reason)}{" "}
        <Link className={sci.linkPlain} href={`/atlas?q=${encodeURIComponent(query)}`}>
          Tentar de novo
        </Link>
      </StateNote>
    );
  }

  if (result.status === "not_found") {
    return (
      <div className={sci.stack}>
        <StateNote title={`Nenhum registro para “${result.query}”`}>
          O NCBI Taxonomy não tem um nome idêntico a esse. Confira a grafia: o Atlas pesquisa nomes de organismos (gênero
          ou espécie), não doenças nem nomes populares.
        </StateNote>
        {result.suggestions.length > 0 && (
          <div className={sci.panel}>
            <h2 className={sci.panelTitle}>Nomes parecidos no NCBI</h2>
            <p className={sci.hint} style={{ marginTop: 6 }}>
              Sugestões por prefixo. Nenhuma foi escolhida automaticamente por você.
            </p>
            <ul className={styles.speciesGrid} style={{ marginTop: 12 }}>
              {result.suggestions.map((s) => (
                <li key={s.taxId}>
                  <Link href={`/atlas/${s.taxId}`} lang="la">
                    {s.scientificName}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        <SourceDetails
          provenance={result.provenance}
          limitations="Ausência de resultado não significa que o organismo não exista: pode ser grafia, nome ainda não incluído ou um nome fora do escopo do NCBI Taxonomy."
        />
      </div>
    );
  }

  // ambíguo (homônimos)
  return (
    <div className={sci.stack}>
      <StateNote title={`Mais de um táxon se chama “${result.query}”`}>
        O mesmo nome científico existe em grupos biológicos diferentes. Escolha qual registro você quer ver; o Atlas não
        escolhe por você.
      </StateNote>
      <ul className={styles.candidates}>
        {result.candidates.map((c) => {
          const rank = rankLabel(c.rank);
          return (
            <li key={c.taxId} className={styles.candidate}>
              <Link href={`/atlas/${c.taxId}?q=${encodeURIComponent(result.query)}`} lang="la">
                {c.scientificName}
              </Link>
              <span className={sci.row}>
                <span className={sci.chip}>{rank.text}</span>
                <span className={sci.chipPlain}>TaxID {c.taxId}</span>
                {c.division && <span className={sci.hint}>Divisão NCBI: {c.division}</span>}
              </span>
            </li>
          );
        })}
      </ul>
      <SourceDetails
        provenance={result.provenance}
        limitations="Homônimos são nomes iguais em grupos distintos (por exemplo, um gênero de bactérias e um de fungos). A divisão do NCBI ajuda a distinguir."
      />
    </div>
  );
}
