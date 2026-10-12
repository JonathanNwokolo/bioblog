import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { OndeVivemHero } from "@/components/science/OndeVivemHero";
import { OndeVivemWorkspace } from "@/components/science/OndeVivemWorkspace";
import type { MapPoint } from "@/components/science/OccurrenceMap";
import { ScienceShell } from "@/components/science/ScienceShell";
import { SourceDetails } from "@/components/science/SourceDetails";
import { LoadingNote, StateNote } from "@/components/science/StateNote";
import { buildCrosswalk } from "@/lib/science/crosswalk";
import { GBIF_LICENCE_LABELS, GBIF_SAMPLING } from "@/lib/science/config";
import { getOccurrenceSample, resolveGbifTaxon } from "@/lib/science/gbif/service";
import type { GbifTaxon } from "@/lib/science/gbif/types";
import { getTaxonById, searchTaxaByName } from "@/lib/science/ncbi/service";
import { countryName, exclusionLabel, formatCount } from "@/lib/science/present";
import { withinCallerBudget } from "@/lib/science/server";
import { type Provenance, userFacingProviderMessage } from "@/lib/science/types";
import sci from "@/components/science/Science.module.css";

export const metadata: Metadata = {
  title: "Onde vivem? — Mapeamento Global GBIF",
  description:
    "Registros de ocorrência da GBIF para organismos de interesse em parasitologia, em um espaço de trabalho cartográfico interativo e editorial.",
};

const LIMITATION =
  "Os pontos representam registros disponíveis no GBIF, sujeitos a lacunas e incertezas. Eles não mostram necessariamente toda a distribuição da espécie, prevalência de doença ou risco de infecção.";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function OndeVivemPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = first(params.q);
  const targetQuery = q && q.trim().length > 0 ? q.trim() : "Trypanosoma cruzi";
  const isDefaultTaxon = !q || q.trim().length === 0;

  return (
    <ScienceShell active="mapa" hero={<OndeVivemHero defaultValue={q} />}>
      <div className={sci.stack}>
        {isDefaultTaxon && (
          <div
            className={sci.row}
            style={{
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 14px",
              background: "var(--surface-warm, #faf8f5)",
              borderRadius: "var(--radius-s)",
              border: "1px solid var(--line)",
              fontSize: "0.84rem",
            }}
          >
            <span className={sci.chipPlain}>
              Espécime em destaque: <em lang="la">Trypanosoma cruzi</em>
            </span>
            <span className={sci.hint}>
              Utilize o campo de busca acima para consultar qualquer outro táxon no índice global GBIF.
            </span>
          </div>
        )}

        <Resolved query={targetQuery} />
      </div>
    </ScienceShell>
  );
}

async function Resolved({ query }: { query: string }) {
  if (!(await withinCallerBudget())) {
    return (
      <StateNote title="Muitas consultas em pouco tempo" tone="error">
        {userFacingProviderMessage("CALLER_RATE_LIMITED")}
      </StateNote>
    );
  }

  const resolved = await resolveGbifTaxon(query);

  if (resolved.status === "invalid_query") {
    return (
      <StateNote title="Essa busca não pôde ser feita" tone="error">
        {resolved.hint}
      </StateNote>
    );
  }

  if (resolved.status === "unavailable") {
    return (
      <StateNote title="A GBIF não respondeu" tone="error">
        {userFacingProviderMessage(resolved.reason)}{" "}
        <Link className={sci.linkPlain} href={`/onde-vivem?q=${encodeURIComponent(query)}`}>
          Tentar de novo
        </Link>
      </StateNote>
    );
  }

  if (resolved.status === "not_found") {
    return (
      <div className={sci.stack}>
        <StateNote title={`A GBIF não reconheceu “${query}”`}>
          O backbone taxonômico da GBIF não devolveu correspondência para esse nome. Isso não significa que o organismo não
          exista, e nenhum organismo parecido foi usado no lugar. Confira a grafia ou tente o gênero.
        </StateNote>
        <SourceDetails
          provenance={resolved.provenance}
          limitations="Resultado do serviço de correspondência de nomes da GBIF (species/match)."
        />
      </div>
    );
  }

  if (resolved.status === "ambiguous") {
    const suggestion = resolved.suggestion;
    const text =
      resolved.kind === "fuzzy"
        ? "A GBIF só encontrou uma correspondência aproximada. Confirme antes de ver os registros."
        : resolved.kind === "higher_rank"
          ? "A GBIF só reconheceu um nível superior (por exemplo, o gênero), não essa espécie. O mapa não mistura registros de outros organismos."
          : resolved.kind === "rank_too_broad"
            ? "Esse nome é de um grupo amplo demais para um mapa de ocorrência. Escolha um gênero ou uma espécie."
            : "A GBIF classificou essa correspondência como duvidosa. Confirme antes de ver os registros.";
    return (
      <div className={sci.stack}>
        <StateNote title={`Identidade de “${query}” incerta na GBIF`}>
          <p>{text}</p>
          {suggestion && (resolved.kind === "fuzzy" || resolved.kind === "doubtful") && (
            <p style={{ marginTop: 8 }}>
              Sugestão da GBIF:{" "}
              <Link className={sci.linkPlain} href={`/onde-vivem?q=${encodeURIComponent(suggestion.canonicalName)}`}>
                <i lang="la">{suggestion.canonicalName}</i>
              </Link>
              .
            </p>
          )}
          {suggestion && resolved.kind === "higher_rank" && (
            <p style={{ marginTop: 8 }}>
              Nível reconhecido: <i lang="la">{suggestion.canonicalName}</i> ({suggestion.rank.toLowerCase()}).{" "}
              <Link className={sci.linkPlain} href={`/onde-vivem?q=${encodeURIComponent(suggestion.canonicalName)}`}>
                Ver registros deste grupo
              </Link>
            </p>
          )}
        </StateNote>
        <SourceDetails
          provenance={resolved.provenance}
          limitations="A GBIF informa o tipo de correspondência (exata, aproximada ou de nível superior); o site não promove uma correspondência incerta a confirmada."
        />
      </div>
    );
  }

  const { taxon, provenance } = resolved;

  return (
    <Suspense fallback={<LoadingNote label="Buscando registros e processando coordenadas no GBIF…" />}>
      <Occurrences taxon={taxon} provenance={provenance} />
    </Suspense>
  );
}

async function Occurrences({ taxon, provenance }: { taxon: GbifTaxon; provenance: Provenance }) {
  const [result, searchResult] = await Promise.all([
    getOccurrenceSample(taxon),
    searchTaxaByName(taxon.acceptedName),
  ]);

  if (result.status === "unavailable") {
    return (
      <StateNote title="Não foi possível obter os registros" tone="error">
        {userFacingProviderMessage(result.reason)} Nenhum ponto foi inventado para preencher o mapa.
      </StateNote>
    );
  }

  if (result.status === "insufficient") {
    const excluded = Object.entries(result.excluded);
    return (
      <div className={sci.stack}>
        <StateNote title="Dados de ocorrência confiáveis ainda são insuficientes para exibir este mapa.">
          <p>
            A GBIF informa {formatCount(result.totalGeoreferenced)} registros com coordenadas para este táxon; após a
            validação restaram {formatCount(result.retained)}, abaixo do mínimo de {result.minRequired} para exibir um mapa
            responsável. Nenhum ponto foi adicionado e nenhuma área de distribuição foi estimada.
          </p>
        </StateNote>
        <SourceDetails
          provenance={result.provenance}
          open
          limitations={LIMITATION}
          extra={[
            { label: "Avaliados", value: formatCount(result.fetched) },
            ...(excluded.length > 0
              ? [
                  {
                    label: "Excluídos",
                    value: (
                      <ul>
                        {excluded.map(([code, count]) => (
                          <li key={code}>
                            {exclusionLabel(code)}: {formatCount(count ?? 0)}
                          </li>
                        ))}
                      </ul>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </div>
    );
  }

  // Obter dados de taxonomia cruzada com NCBI se disponível
  let ncbi = null;
  let ncbiTaxId: string | null = null;
  if (searchResult.status === "verified") {
    ncbiTaxId = String(searchResult.taxon.taxId);
    const record = await getTaxonById(searchResult.taxon.taxId);
    if (record.status === "verified") ncbi = record.taxon;
  }

  const cross = buildCrosswalk(ncbi, {
    acceptedKey: taxon.acceptedKey,
    canonicalName: taxon.canonicalName,
    acceptedName: taxon.acceptedName,
    rank: taxon.rank,
    isSynonym: taxon.isSynonym,
  });

  const titles = new Map(result.datasets.map((d) => [d.datasetKey, d.title]));
  const points: MapPoint[] = result.points.map((p) => ({
    gbifId: p.gbifId,
    lat: p.lat,
    lon: p.lon,
    uncertaintyMeters: p.uncertaintyMeters,
    basisOfRecord: p.basisOfRecord,
    year: p.year,
    eventDate: p.eventDate,
    country: p.countryCode ? countryName(p.countryCode) : p.country,
    datasetName: p.datasetName,
    datasetTitle: p.datasetKey ? (titles.get(p.datasetKey) ?? null) : null,
    institutionCode: p.institutionCode,
    rightsHolder: p.rightsHolder,
    licenceLabel: p.licence ? (GBIF_LICENCE_LABELS[p.licence] ?? p.licence) : null,
    issues: p.issues,
    url: p.url,
  }));

  return (
    <OndeVivemWorkspace
      taxon={taxon}
      allPoints={points}
      totalGeoreferenced={result.totalGeoreferenced}
      sampled={result.sampled}
      fetchedCount={result.fetched}
      sampleCountries={result.sampleCountries}
      topDataset={result.topDataset}
      countries={result.countries}
      datasets={result.datasets}
      licences={result.licences}
      excluded={result.excluded}
      minRequired={GBIF_SAMPLING.minReliableOccurrences}
      provenance={provenance}
      ncbiTaxId={ncbiTaxId}
      crosswalkData={{
        linked: cross.linked,
        agreement: cross.agreement,
        evidence: cross.evidence,
        ncbiName: ncbi?.scientificName ?? null,
        ncbiRank: ncbi?.rank ?? null,
      }}
    />
  );
}
