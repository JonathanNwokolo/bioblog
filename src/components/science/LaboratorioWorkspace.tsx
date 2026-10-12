"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { DpdxOrganism, ShownDpdxImage } from "@/lib/science/dpdx/registry";
import { getMorphologicalGuide } from "@/lib/science/dpdx/annotations";
import { InteractiveMicroscope } from "./InteractiveMicroscope";
import styles from "./Lab.module.css";

interface WithheldItem {
  image: {
    id: string;
    stage: { pt: string };
    figureLabel: string;
    sourcePageUrl: string;
    rights: { thirdPartyCredit: string | null };
  };
}

interface OtherSlideItem {
  id: string;
  organismSlug: string;
  organismName: string;
  stagePt: string;
  prepPt: string;
  imageUrl: string;
}

interface LaboratorioWorkspaceProps {
  organism: DpdxOrganism;
  images: ShownDpdxImage[];
  initialImageId?: string;
  withheld: WithheldItem[];
  otherSlides: OtherSlideItem[];
}

function formatDay(iso: string) {
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(parsed);
}

export function LaboratorioWorkspace({
  organism,
  images,
  initialImageId,
  withheld,
  otherSlides,
}: LaboratorioWorkspaceProps) {
  const [selectedId, setSelectedId] = useState<string>(
    initialImageId && images.some((img) => img.id === initialImageId)
      ? initialImageId
      : images[0]?.id ?? ""
  );
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [showPins, setShowPins] = useState<boolean>(true);

  const currentImage = useMemo(
    () => images.find((img) => img.id === selectedId) ?? images[0],
    [images, selectedId]
  );

  const guide = useMemo(() => (currentImage ? getMorphologicalGuide(currentImage.id) : null), [currentImage]);
  const pins = guide?.pins ?? [];

  const diagnosticCriteria = useMemo(() => {
    if (guide?.diagnosticCriteria && guide.diagnosticCriteria.length > 0) {
      return guide.diagnosticCriteria;
    }
    return [
      {
        title: "Morfologia e dimensões características",
        description: `Identificação pelo contorno celular e proporções típicas do estágio ${currentImage?.stage.pt ?? "diagnóstico"}.`,
      },
      {
        title: "Afinidade tintorial específica",
        description: `Visualização detalhada pelo método de coloração: ${currentImage?.preparation.pt ?? "coloração de rotina"}.`,
      },
      {
        title: "Estruturas subcelulares diagnósticas",
        description: "Análise de integridade de núcleos, membrana e organelas de locomoção ou proteção.",
      },
      {
        title: "Diferenciação taxonômica",
        description: `Critérios morfológicos para diferenciação de outras espécies afins do gênero ${organism.scientificName.split(" ")[0]}.`,
      },
    ];
  }, [guide, currentImage, organism.scientificName]);

  if (!currentImage) {
    return null;
  }

  return (
    <div className={styles.workspaceContainer}>
      {/* Grade Principal: Visualizador + Barra Lateral */}
      <div className={styles.workspace}>
        {/* Coluna Esquerda: Visualizador Interativo */}
        <InteractiveMicroscope
          organismName={organism.scientificName}
          images={images}
          selectedImageId={currentImage.id}
          onSelectImage={(id) => {
            setSelectedId(id);
            setActivePinId(null);
          }}
          activePinId={activePinId}
          onSelectPin={setActivePinId}
          showPins={showPins}
          onTogglePins={() => setShowPins((prev) => !prev)}
        />

        {/* Coluna Direita: Cards Editoriais de Apoio */}
        <aside className={styles.sidebarColumn} aria-label="Informações científicas da lâmina">
          {/* Card 1: Lâmina em Destaque */}
          <section className={styles.featuredCard} aria-labelledby="lamina-destaque-title">
            <div className={styles.cardHeader}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentImage.imageUrl}
                alt=""
                className={styles.cardHeaderImg}
                width={68}
                height={68}
              />
              <div className={styles.cardHeaderMeta}>
                <div className={styles.cardBadges}>
                  <span className={`${styles.cardBadge} ${styles.cardBadgeMint}`}>CDC DPDx</span>
                  <span className={styles.cardBadge}>{currentImage.stage.pt}</span>
                </div>
                <h3 id="lamina-destaque-title" className={styles.cardTitle}>
                  <i lang="la">{organism.scientificName}</i>
                </h3>
              </div>
            </div>

            <p className={styles.cardDesc}>
              {currentImage.captionPt.replace(/^Figura [A-Z]:\s*/i, "")}
            </p>

            <dl className={styles.factTable}>
              <div className={styles.factRow}>
                <dt className={styles.factLabel}>Espécie</dt>
                <dd className={styles.factValue}>
                  <i lang="la">{organism.scientificName}</i>
                </dd>
              </div>
              <div className={styles.factRow}>
                <dt className={styles.factLabel}>Estágio</dt>
                <dd className={styles.factValue}>
                  {currentImage.stage.pt} <span lang="en">({currentImage.stage.en})</span>
                </dd>
              </div>
              <div className={styles.factRow}>
                <dt className={styles.factLabel}>Coloração</dt>
                <dd className={styles.factValue}>{currentImage.preparation.pt}</dd>
              </div>
              <div className={styles.factRow}>
                <dt className={styles.factLabel}>Origem</dt>
                <dd className={styles.factValue}>
                  {currentImage.figureLabel} · CDC DPDx
                </dd>
              </div>
            </dl>

            <a
              href={currentImage.sourcePageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.cardSourceLink}
            >
              Consultar página original no CDC DPDx
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              <span className="visually-hidden"> (abre em nova aba)</span>
            </a>
          </section>

          {/* Card 2: Anotações Morfológicas */}
          <section className={styles.annotationsCard} aria-labelledby="anotacoes-title">
            <div className={styles.annotationsHeader}>
              <h3 id="anotacoes-title" className={styles.annotationsTitle}>
                Anotações morfológicas
              </h3>
              <button
                type="button"
                className={styles.togglePinsBtn}
                onClick={() => setShowPins((prev) => !prev)}
                aria-pressed={showPins}
              >
                {showPins ? "Ocultar 👁" : "Mostrar 👁"}
              </button>
            </div>

            {pins.length > 0 ? (
              <ul className={styles.pinsList} role="list">
                {pins.map((pin) => {
                  const isActive = activePinId === pin.id;
                  return (
                    <li key={pin.id}>
                      <button
                        type="button"
                        className={`${styles.pinItemBtn} ${isActive ? styles.pinItemActive : ""}`}
                        onClick={() => setActivePinId(isActive ? null : pin.id)}
                        aria-pressed={isActive}
                      >
                        <span className={styles.pinItemNumber}>{pin.number}</span>
                        <div className={styles.pinItemBody}>
                          <span className={styles.pinItemTitle}>{pin.label}</span>
                          <p className={styles.pinItemDesc}>{pin.descriptionPt}</p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className={styles.cardDesc}>
                Esta micrografia não possui anotações de organelas catalogadas nesta versão. Utilize os controles de zoom para exploração livre.
              </p>
            )}

            <div className={styles.annotationCaveat}>
              <strong>Garantia de integridade científica:</strong> Anotações morfológicas baseadas estritamente em literatura clássica de parasitologia médica; revisão técnica de curadoria por Ynara Raíssa Nwokolo.
            </div>
          </section>
        </aside>
      </div>

      {/* 3 Cards Educacionais Centrais */}
      <section className={styles.educationGrid} aria-label="Guias e fundamentação do laboratório">
        {/* Card 1: Como usar */}
        <div className={styles.eduCard}>
          <div className={styles.eduCardHeader}>
            <div className={styles.eduIcon} aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h3 className={styles.eduCardTitle}>Como usar o laboratório</h3>
          </div>
          <ol className={styles.eduSteps}>
            <li className={styles.eduStep}>
              <span className={styles.eduStepNum}>1</span>
              <span><strong>Navegue pelo campo:</strong> utilize o cursor ou toque para arrastar a lâmina e explorar diferentes quadrantes.</span>
            </li>
            <li className={styles.eduStep}>
              <span className={styles.eduStepNum}>2</span>
              <span><strong>Alterne a ampliação:</strong> selecione entre 100×, 400× e 1000× para analisar detalhes citoplasmáticos.</span>
            </li>
            <li className={styles.eduStep}>
              <span className={styles.eduStepNum}>3</span>
              <span><strong>Identifique organelas:</strong> clique nos marcadores numerados para ler a descrição estrutural detalhada.</span>
            </li>
          </ol>
        </div>

        {/* Card 2: Fonte e procedência */}
        <div className={styles.eduCard}>
          <div className={styles.eduCardHeader}>
            <div className={styles.eduIcon} aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <h3 className={styles.eduCardTitle}>Fonte e procedência científica</h3>
          </div>
          <p className={styles.eduCardText}>
            Acervo curado da Division of Parasitic Diseases and Malaria (CDC). As lâminas utilizam esfregaços citológicos originais, preservados sem compressão destrutiva nem interpolação por IA.
          </p>
          <div className={styles.eduChips}>
            <span className={styles.eduChip}>Curadoria CDC DPDx</span>
            <span className={styles.eduChip}>Domínio Público Verificado</span>
            <span className={styles.eduChip}>Revisão 2026</span>
          </div>
          <p className={styles.eduCardText} style={{ fontSize: "0.8rem", marginTop: 4 }}>
            Última revisão da fonte: {formatDay(currentImage.sourcePageLastReviewed)}.
          </p>
        </div>

        {/* Card 3: Comparar estágios */}
        <div className={styles.eduCard}>
          <div className={styles.eduCardHeader}>
            <div className={styles.eduIcon} aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 3 21 3 21 8" />
                <line x1="4" y1="20" x2="21" y2="3" />
                <polyline points="21 16 21 21 16 21" />
                <line x1="15" y1="15" x2="21" y2="21" />
                <line x1="4" y1="4" x2="9" y2="9" />
              </svg>
            </div>
            <h3 className={styles.eduCardTitle}>Comparar estágios do ciclo</h3>
          </div>
          <p className={styles.eduCardText}>
            Parasitos protozoários exibem morfologia variável dependendo da etapa biológica e do tecido hospedeiro.
          </p>
          <div className={styles.stageList}>
            {guide?.stageComparison ? (
              guide.stageComparison.stages.map((stg) => {
                const isCurrent = currentImage.stage.pt.toLowerCase().includes(stg.name.toLowerCase());
                return (
                  <div
                    key={stg.name}
                    className={`${styles.stageItem} ${isCurrent ? styles.stageItemActive : ""}`}
                  >
                    <span className={styles.stageItemTitle}>
                      {stg.name} {isCurrent && "· Atual"}
                    </span>
                    <span className={styles.stageItemDesc}>{stg.characteristics}</span>
                  </div>
                );
              })
            ) : (
              images.map((img) => (
                <button
                  key={img.id}
                  type="button"
                  className={`${styles.stageItem} ${img.id === currentImage.id ? styles.stageItemActive : ""}`}
                  onClick={() => setSelectedId(img.id)}
                  style={{ textAlign: "left", cursor: "pointer" }}
                >
                  <span className={styles.stageItemTitle}>
                    {img.stage.pt} {img.id === currentImage.id && "· Atual"}
                  </span>
                  <span className={styles.stageItemDesc}>{img.preparation.pt}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Seção: O que observar nesta lâmina */}
      <section className={styles.observationSection} aria-labelledby="observar-title">
        <div className={styles.sectionHeader}>
          <h2 id="observar-title" className={styles.sectionTitle}>
            O que observar nesta lâmina
          </h2>
          <p className={styles.sectionSubtitle}>
            Critérios morfológicos diagnósticos para identificação precisa ao microscópio óptico.
          </p>
        </div>

        <div className={styles.obsGrid}>
          {diagnosticCriteria.map((crit, idx) => (
            <div key={crit.title} className={styles.obsCard}>
              <span className={styles.obsNum}>0{idx + 1}</span>
              <h3 className={styles.obsTitle}>{crit.title}</h3>
              <p className={styles.obsDesc}>{crit.description}</p>
            </div>
          ))}
        </div>

        {/* CTA Banner para o Atlas */}
        <div className={styles.atlasCtaBanner}>
          <div className={styles.atlasCtaText}>
            <h3 className={styles.atlasCtaTitle}>Deseja aprofundar na linhagem deste organismo?</h3>
            <p className={styles.atlasCtaDesc}>
              Consulte a árvore filogenética completa e classificação oficial catalogada no banco NCBI Taxonomy.
            </p>
          </div>
          <Link
            href={`/atlas?q=${encodeURIComponent(organism.lookupName)}`}
            className={styles.atlasCtaBtn}
          >
            Ver ficha no Atlas do Invisível →
          </Link>
        </div>
      </section>

      {/* Seção: Outras lâminas para explorar */}
      {otherSlides.length > 0 && (
        <section className={styles.gallerySection} aria-labelledby="galeria-title">
          <div className={styles.sectionHeader}>
            <h2 id="galeria-title" className={styles.sectionTitle}>
              Outras lâminas para explorar
            </h2>
            <p className={styles.sectionSubtitle}>
              Coleção de parasitos de relevância em saúde pública catalogados no acervo do Laboratório.
            </p>
          </div>

          <div className={styles.galleryGrid}>
            {otherSlides.map((slide) => (
              <div key={slide.id} className={styles.galleryCard}>
                <div className={styles.galleryMedia}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={slide.imageUrl}
                    alt=""
                    className={styles.galleryImg}
                    loading="lazy"
                    decoding="async"
                  />
                  <span className={styles.galleryBadge}>{slide.stagePt}</span>
                </div>
                <div className={styles.galleryBody}>
                  <div className={styles.galleryInfo}>
                    <h3 className={styles.galleryOrganism}>{slide.organismName}</h3>
                    <span className={styles.galleryStage}>{slide.stagePt}</span>
                    <span className={styles.galleryPrep}>{slide.prepPt}</span>
                  </div>
                  <Link
                    href={`/laboratorio?organismo=${slide.organismSlug}&imagem=${slide.id}`}
                    className={styles.galleryAction}
                  >
                    Examinar lâmina →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Seção de Retenção de Direitos (Garantia Phase 2.2) */}
      {withheld.length > 0 && (
        <section className={styles.observationSection} aria-labelledby="retidas-title" style={{ marginTop: 48 }}>
          <div className={styles.sectionHeader}>
            <h2 id="retidas-title" className={styles.sectionTitle} style={{ fontSize: "1.5rem" }}>
              Imagens da mesma página não exibidas (portão de direitos)
            </h2>
            <p className={styles.sectionSubtitle}>
              Cada imagem é uma decisão individual. Estas micrografias trazem crédito de terceiros na legenda original do CDC, permanecendo retidas até haver licenciamento explícito documentado.
            </p>
          </div>
          <ul className={styles.withheldList}>
            {withheld.map(({ image }) => (
              <li key={image.id} className={styles.withheldItem}>
                <span className={styles.withheldTitle}>
                  {image.stage.pt}, figura {image.figureLabel.replace("Figure ", "")}
                </span>
                <span className={styles.withheldCredit}>
                  Crédito na legenda do CDC: {image.rights.thirdPartyCredit ?? "não verificado"}.
                </span>
                <a
                  href={image.sourcePageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--ink)", fontWeight: 600, fontSize: "0.84rem", textDecoration: "underline" }}
                >
                  Ver na página oficial do CDC (abre em nova aba)
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
