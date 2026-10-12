import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AtlasHero } from "@/components/science/AtlasHero";
import { ScienceShell } from "@/components/science/ScienceShell";
import { SourceDetails } from "@/components/science/SourceDetails";
import { LoadingNote, StateNote } from "@/components/science/StateNote";
import { TaxonClassificationTree } from "@/components/science/TaxonClassificationTree";
import { TaxonExplorer } from "@/components/science/TaxonExplorer";
import { TaxonReferencePanel } from "@/components/science/TaxonReferencePanel";
import { findDpdxOrganismByName, imagesForOrganism } from "@/lib/science/dpdx/registry";
import { getOrganismCuration } from "@/lib/science/editorial-curation";
import { isTaxId } from "@/lib/science/ncbi/client";
import { checkNameQuery, foldName } from "@/lib/science/query";
import { classifyNameMatch, getSpeciesBelow, getTaxonById } from "@/lib/science/ncbi/service";
import type { TaxonRecord } from "@/lib/science/ncbi/types";
import { formatCount } from "@/lib/science/present";
import { withinCallerBudget } from "@/lib/science/server";
import { userFacingProviderMessage } from "@/lib/science/types";
import sci from "@/components/science/Science.module.css";
import styles from "@/components/science/Atlas.module.css";

type Params = Promise<{ taxId: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { taxId } = await params;
  return {
    title: isTaxId(taxId) ? `Atlas: registro NCBI ${taxId}` : "Atlas do Invisível",
    // Páginas de registro dependem de consulta externa: não pedimos indexação.
    robots: { index: false, follow: true },
  };
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TaxonPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { taxId } = await params;
  if (!isTaxId(taxId)) notFound();
  const q = firstParam((await searchParams).q);

  return (
    <Suspense fallback={<LoadingNote label="Consultando o NCBI Taxonomy…" />}>
      <TaxonRecordContent taxId={taxId} query={q} />
    </Suspense>
  );
}

function matchedQuery(query: string | undefined, taxon: TaxonRecord): string | null {
  if (!query) return null;
  const check = checkNameQuery(query);
  if (!check.ok || check.asTaxId) return null;
  const folded = foldName(check.query);
  const known = [taxon.scientificName, ...taxon.synonyms, ...taxon.commonNames, ...taxon.otherNames.map((n) => n.name)];
  return known.some((name) => foldName(name) === folded) ? check.query : null;
}

async function TaxonRecordContent({ taxId, query }: { taxId: string; query: string | undefined }) {
  if (!(await withinCallerBudget())) {
    return (
      <ScienceShell
        active="atlas"
        title="Atlas do Invisível"
        lede="Registro do NCBI Taxonomy: posição do táxon na classificação e fontes dos dados."
        hero={<AtlasHero defaultValue={query} />}
      >
        <StateNote title="Muitas consultas em pouco tempo" tone="error">
          {userFacingProviderMessage("CALLER_RATE_LIMITED")}
        </StateNote>
      </ScienceShell>
    );
  }

  const lookup = await getTaxonById(taxId);

  if (lookup.status === "unavailable") {
    return (
      <ScienceShell
        active="atlas"
        title="Atlas do Invisível"
        lede="Registro do NCBI Taxonomy: posição do táxon na classificação e fontes dos dados."
        hero={<AtlasHero defaultValue={query} />}
      >
        <StateNote title="O NCBI Taxonomy não respondeu" tone="error">
          {userFacingProviderMessage(lookup.reason)}{" "}
          <Link className={sci.linkPlain} href={`/atlas/${taxId}`}>
            Tentar de novo
          </Link>
        </StateNote>
      </ScienceShell>
    );
  }

  if (lookup.status === "not_found" || lookup.status === "invalid_query") {
    return (
      <ScienceShell
        active="atlas"
        title="Atlas do Invisível"
        lede="Registro do NCBI Taxonomy: posição do táxon na classificação e fontes dos dados."
        hero={<AtlasHero defaultValue={query} />}
      >
        <StateNote title={`Não existe registro para o TaxID ${taxId}`}>
          O NCBI não devolveu um registro para esse identificador. Ele pode ter sido removido ou nunca ter existido.
        </StateNote>
      </ScienceShell>
    );
  }

  const { taxon, provenance } = lookup;
  const matched = matchedQuery(query, taxon);
  const matchStatus = matched ? classifyNameMatch(matched, taxon) : null;
  const dpdx = findDpdxOrganismByName([taxon.scientificName, ...taxon.synonyms]);
  const dpdxImages = dpdx ? imagesForOrganism(dpdx.slug).shown : [];
  const curation = getOrganismCuration(taxon.scientificName, taxon.synonyms);
  const mapUsable =
    taxon.rank !== null &&
    ["genus", "subgenus", "species", "subspecies", "varietas", "forma", "strain"].includes(taxon.rank.toLowerCase());

  return (
    <ScienceShell
      active="atlas"
      title="Atlas do Invisível"
      lede="Registro oficial catalogado no NCBI Taxonomy: posição do táxon na árvore da vida, nomes conhecidos e procedência de cada dado."
      hero={
        <AtlasHero
          scientificName={taxon.scientificName}
          rank={taxon.rank}
          subtitle={curation?.subtitle}
          defaultValue={query}
        />
      }
    >
      <div className={sci.stack}>
        {matchStatus && matched && matchStatus !== "exact" && (
          <p className={styles.banner} role="status">
            <span>
              Você buscou <strong lang="la">{matched}</strong>.{" "}
              {matchStatus === "accepted_synonym"
                ? "Esse nome é um sinônimo; o nome aceito no NCBI Taxonomy é:"
                : "Esse nome aparece no registro como outro nome; o nome científico no NCBI Taxonomy é:"}
            </span>
          </p>
        )}

        <article className={styles.editorialGrid} aria-labelledby="atlas-hero-title">
          <TaxonClassificationTree taxon={taxon} mapUsable={mapUsable} />
          <TaxonExplorer
            taxon={taxon}
            curation={curation}
            dpdxImages={dpdxImages}
            mapUsable={mapUsable}
          />
          <TaxonReferencePanel taxon={taxon} curation={curation} />
        </article>

        <Suspense fallback={<LoadingNote label="Buscando espécies dentro deste grupo…" />}>
          <SpeciesBelow taxId={taxon.taxId} rank={taxon.rank} name={taxon.scientificName} />
        </Suspense>

        <SourceDetails
          provenance={provenance}
          limitations={
            <>
              O NCBI Taxonomy cataloga nomes e classificação para os bancos de sequências do NCBI. Não é uma autoridade
              taxonômica primária e não substitui referências clínicas, patológicas, epidemiológicas ou de ciclo de vida.
              Campos que a fonte não preenche aparecem como “não informado”.
            </>
          }
          extra={[{ label: "Adaptador", value: `Microcosmos ${provenance.adapterVersion}` }]}
        />
      </div>
    </ScienceShell>
  );
}

async function SpeciesBelow({ taxId, rank, name }: { taxId: string; rank: string | null; name: string }) {
  const result = await getSpeciesBelow(taxId, rank);
  if (result.status === "not_applicable") return null;
  if (result.status === "unavailable") {
    return (
      <StateNote title="Não foi possível listar as espécies deste grupo">
        {userFacingProviderMessage(result.reason)}
      </StateNote>
    );
  }
  return (
    <section className={sci.panel} aria-labelledby="abaixo">
      <h3 id="abaixo" className={sci.panelTitle}>
        Espécies dentro de <i lang="la">{name}</i>
      </h3>
      <p className={sci.hint} style={{ marginTop: 6 }}>
        {result.complete
          ? `${formatCount(result.total)} espécies no NCBI Taxonomy.`
          : `Mostrando ${formatCount(result.shown.length)} de ${formatCount(result.total)} espécies registradas no NCBI. É uma amostra, não a lista completa.`}
      </p>
      <ul className={styles.speciesGrid} style={{ marginTop: 12 }}>
        {result.shown.map((s) => (
          <li key={s.taxId}>
            <Link href={`/atlas/${s.taxId}`} lang="la">
              {s.scientificName}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
