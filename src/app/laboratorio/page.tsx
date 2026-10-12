import type { Metadata } from "next";
import { ScienceShell } from "@/components/science/ScienceShell";
import { LaboratorioHero } from "@/components/science/LaboratorioHero";
import { LaboratorioWorkspace } from "@/components/science/LaboratorioWorkspace";
import { StateNote } from "@/components/science/StateNote";
import {
  dpdxOrganisms,
  dpdxSourceStatements,
  findOrganism,
  imagesForOrganism,
} from "@/lib/science/dpdx/registry";
import sci from "@/components/science/Science.module.css";

export const metadata: Metadata = {
  title: "Laboratório Interativo | Microcosmos",
  description:
    "Micrografias de referência do CDC DPDx em alta definição, visualizador de microscopia com zoom óptico simulado, minimapa e anotações morfológicas.",
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function resolveOrganism(query?: string) {
  if (!query) {
    return findOrganism("trypanosoma-cruzi") ?? dpdxOrganisms[0];
  }
  const clean = query.trim().toLowerCase();
  const bySlug = findOrganism(clean);
  if (bySlug) return bySlug;

  if (clean.includes("chagas") || clean.includes("cruzi") || clean.includes("trypanosoma")) {
    return findOrganism("trypanosoma-cruzi") ?? dpdxOrganisms[0];
  }
  if (clean.includes("giardia") || clean.includes("duodenalis") || clean.includes("lamblia")) {
    return findOrganism("giardia-duodenalis") ?? dpdxOrganisms[0];
  }
  if (clean.includes("malaria") || clean.includes("falciparum") || clean.includes("plasmodium")) {
    return findOrganism("plasmodium-falciparum") ?? dpdxOrganisms[0];
  }
  if (
    clean.includes("ameba") ||
    clean.includes("amoeba") ||
    clean.includes("histolytica") ||
    clean.includes("entamoeba")
  ) {
    return findOrganism("entamoeba-histolytica") ?? dpdxOrganisms[0];
  }

  return findOrganism(query) ?? null;
}

export default async function LaboratorioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requested = first(params.organismo);
  const resolved = resolveOrganism(requested);
  const unknownRequest = requested !== undefined && resolved === null;
  const organism = resolved ?? findOrganism("trypanosoma-cruzi") ?? dpdxOrganisms[0];

  const { shown, withheld } = imagesForOrganism(organism.slug);
  const initialId = first(params.imagem);

  // Reúne lâminas dos demais organismos curados para a galeria inferior
  const otherSlides = dpdxOrganisms
    .filter((org) => org.slug !== organism.slug)
    .flatMap((org) => {
      const { shown: orgShown } = imagesForOrganism(org.slug);
      return orgShown.map((img) => ({
        id: img.id,
        organismSlug: org.slug,
        organismName: org.scientificName,
        stagePt: img.stage.pt,
        prepPt: img.preparation.pt,
        imageUrl: img.imageUrl,
      }));
    });

  return (
    <ScienceShell
      active="laboratorio"
      hero={
        <LaboratorioHero
          scientificName={organism.scientificName}
          defaultValue={requested}
        />
      }
    >
      <div className={sci.stack}>
        {unknownRequest && (
          <StateNote title="Esse organismo não está no Laboratório">
            Mostrando <i lang="la">{organism.scientificName}</i>. O acervo é curado e focado em espécies de interesse médico prioritário.
          </StateNote>
        )}

        {shown.length > 0 ? (
          <LaboratorioWorkspace
            key={organism.slug}
            organism={organism}
            images={shown}
            initialImageId={initialId}
            withheld={withheld}
            otherSlides={otherSlides}
          />
        ) : (
          <StateNote title="Nenhuma imagem deste organismo pode ser exibida">
            Nenhuma figura da página do CDC passou pela verificação de direitos. Consulte a{" "}
            <a href={organism.dpdxPageUrl} target="_blank" rel="noopener noreferrer">
              página original<span className="visually-hidden"> (abre em nova aba)</span>
            </a>
            .
          </StateNote>
        )}

        {/* Painel de Metodologia e Integridade Científica (Preservado da Fase 2.2) */}
        <section className={sci.panel} aria-labelledby="como-lemos" style={{ marginTop: 48 }}>
          <h2 id="como-lemos" className={sci.panelTitle}>
            Como estas imagens foram selecionadas e catalogadas
          </h2>
          <div className={sci.stack} style={{ marginTop: 12, color: "var(--ink-soft)", fontSize: "0.92rem" }}>
            <p>
              O CDC DPDx não oferece uma API pública estruturada. Em vez de copiar páginas automaticamente, a Microcosmos mantém um
              registro revisado manualmente: para cada imagem, a página de origem, a legenda literal, a verificação de crédito de
              terceiros e a base de uso. As imagens aprovadas são cópias sem alteração, guardadas no próprio site (com somas de verificação SHA-256), para que a visita não envie dados ao cdc.gov.
            </p>
            <p>{dpdxSourceStatements.about.summary}</p>
            <p>{dpdxSourceStatements.policy.summary}</p>
            <p>
              A revisão é documental e feita pela equipe de engenharia, não é parecer jurídico nem revisão científica por
              especialista. As anotações morfológicas são baseadas em literatura clássica de parasitologia médica e marcadas para revisão contínua pela autora Ynara Raíssa Nwokolo.
            </p>
            <p>
              Fontes oficiais:{" "}
              <a href={dpdxSourceStatements.about.url} target="_blank" rel="noopener noreferrer">
                About DPDx<span className="visually-hidden"> (abre em nova aba)</span>
              </a>
              {" · "}
              <a href={dpdxSourceStatements.policy.url} target="_blank" rel="noopener noreferrer">
                Política de materiais do CDC<span className="visually-hidden"> (abre em nova aba)</span>
              </a>
            </p>
          </div>
        </section>

        <p className={sci.disclaimer} style={{ marginTop: 32 }}>
          Conteúdo educativo, sem finalidade diagnóstica. Imagens: crédito ao CDC DPDx; o uso não implica endosso do CDC, do HHS ou
          do governo dos Estados Unidos.
        </p>
      </div>
    </ScienceShell>
  );
}
