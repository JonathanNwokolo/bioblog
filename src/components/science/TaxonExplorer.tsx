"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { ShownDpdxImage } from "@/lib/science/dpdx/registry";
import type { TaxonRecord } from "@/lib/science/ncbi/types";
import type { OrganismCuration } from "@/lib/science/editorial-curation";
import { ncbiTaxonUrl } from "@/lib/science/present";
import styles from "./Atlas.module.css";

interface TaxonExplorerProps {
  taxon: TaxonRecord;
  curation: OrganismCuration | null;
  dpdxImages: ShownDpdxImage[];
  mapUsable: boolean;
}

type TabKey = "overview" | "morphology" | "lifecycle" | "hosts" | "distribution" | "references";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "overview", label: "Visão geral" },
  { key: "morphology", label: "Morfologia" },
  { key: "lifecycle", label: "Ciclo de vida" },
  { key: "hosts", label: "Hospedeiros" },
  { key: "distribution", label: "Distribuição" },
  { key: "references", label: "Referências" },
];

export function TaxonExplorer({ taxon, curation, dpdxImages, mapUsable }: TaxonExplorerProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [zoomImage, setZoomImage] = useState<ShownDpdxImage | null>(null);

  // Textos editoriais verificados ou gerados a partir do registro do NCBI
  const overviewText =
    curation?.overview ??
    `${taxon.scientificName} é um organismo catalogado no banco taxonômico do NCBI sob a divisão ${taxon.division ?? "não informada"}. O registro mantém sua posição filogenética oficial e histórico de nomenclatura aceita.`;

  const scientificImportance =
    curation?.scientificImportance ??
    `Classificação e referências de sequência de ${taxon.scientificName} registradas pelo NCBI para pesquisa genômica e biologia comparada.`;

  return (
    <div className={styles.centerCol}>
      {/* Navegação por abas editorial */}
      <nav className={styles.tabsNav} aria-label="Seções do táxon">
        <div role="tablist" className={styles.tabList}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                id={`tab-${tab.key}`}
                aria-selected={isActive}
                aria-controls={`panel-${tab.key}`}
                className={`${styles.tabBtn} ${isActive ? styles.tabBtnActive : ""}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Painel: Visão Geral */}
      {activeTab === "overview" && (
        <div id="panel-overview" role="tabpanel" aria-labelledby="tab-overview" className={styles.tabContent}>
          <section className={styles.articleSection}>
            <h2 className={styles.editorialHeading}>Sobre esta espécie</h2>
            <p className={styles.editorialBody}>{overviewText}</p>
          </section>

          {/* Card de Importância Científica */}
          <div className={styles.calloutCard} role="region" aria-label="Importância científica">
            <div className={styles.calloutIcon} aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 2v7.31L4.69 17.5a2 2 0 0 0 1.62 3h11.38a2 2 0 0 0 1.62-3L14 9.31V2" />
                <path d="M8.5 2h7" />
                <path d="M7 16h10" />
              </svg>
            </div>
            <div className={styles.calloutText}>
              <h3 className={styles.calloutTitle}>Importância científica</h3>
              <p className={styles.calloutDesc}>{scientificImportance}</p>
            </div>
          </div>

          {/* Galeria de imagens microscópicas */}
          <section className={styles.gallerySection}>
            <h3 className={styles.galleryHeading}>Galeria de imagens</h3>
            {dpdxImages.length > 0 ? (
              <div className={styles.galleryGrid}>
                {dpdxImages.map((img) => (
                  <figure key={img.id} className={styles.galleryCard}>
                    <div className={styles.imageThumbWrap}>
                      <Image
                        src={img.imageUrl}
                        alt={img.alt}
                        width={img.width}
                        height={img.height}
                        className={styles.galleryImage}
                      />
                      <button
                        type="button"
                        className={styles.zoomPill}
                        onClick={() => setZoomImage(img)}
                        aria-label={`Ampliar imagem: ${img.stage.pt}`}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="11" cy="11" r="8" />
                          <line x1="21" y1="21" x2="16.65" y2="16.65" />
                          <line x1="11" y1="8" x2="11" y2="14" />
                          <line x1="8" y1="11" x2="14" y2="11" />
                        </svg>
                      </button>
                      <span className={styles.scaleBarBadge} aria-label="Escala micrométrica aproximada">
                        10 µm
                      </span>
                    </div>
                    <figcaption className={styles.galleryCaption}>
                      <strong className={styles.captionTitle}>{img.stage.pt}</strong>
                      <span className={styles.captionPrep}>{img.preparation.pt}</span>
                      <a
                        href={img.sourcePageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.captionSource}
                      >
                        Fonte: CDC DPDx ↗
                      </a>
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <div className={styles.emptyGalleryNote}>
                <p>
                  Micrografias clínicas para este táxon ainda não foram cadastradas no acervo do CDC DPDx revisado.
                  Imagens fotográficas adicionais aguardam curadoria editorial da autora.
                </p>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Painel: Morfologia */}
      {activeTab === "morphology" && (
        <div id="panel-morphology" role="tabpanel" aria-labelledby="tab-morphology" className={styles.tabContent}>
          <section className={styles.articleSection}>
            <h2 className={styles.editorialHeading}>Características morfológicas</h2>
            <p className={styles.editorialBody}>
              {curation?.morphologySummary ??
                "Informações morfológicas específicas para este táxon não constam nos dados de taxonomia pura do NCBI e aguardam documentação de bancada."}
            </p>
            {dpdxImages.length > 0 && (
              <div className={styles.stageList} style={{ marginTop: 20 }}>
                <h3 className={styles.subsectionHeading}>Estágios diagnósticos documentados</h3>
                <ul className={styles.stageItems}>
                  {dpdxImages.map((img) => (
                    <li key={img.id} className={styles.stageItem}>
                      <strong>{img.stage.pt}</strong>: {img.captionPt}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Painel: Ciclo de vida */}
      {activeTab === "lifecycle" && (
        <div id="panel-lifecycle" role="tabpanel" aria-labelledby="tab-lifecycle" className={styles.tabContent}>
          <section className={styles.articleSection}>
            <h2 className={styles.editorialHeading}>Ciclo de vida e transmissão</h2>
            <p className={styles.editorialBody}>
              {curation?.lifeCycleSummary ??
                "O ciclo biológico detalhado e mecanismos de transmissão dependem de referências especializadas em parasitologia clínica e não são inferidos a partir do NCBI Taxonomy."}
            </p>
            <div className={styles.editorialDisclaimer} style={{ marginTop: 16 }}>
              Nota: Esquemas visuais de ciclo de vida requerem validação e revisão pela biomédica responsável.
            </div>
          </section>
        </div>
      )}

      {/* Painel: Hospedeiros */}
      {activeTab === "hosts" && (
        <div id="panel-hosts" role="tabpanel" aria-labelledby="tab-hosts" className={styles.tabContent}>
          <section className={styles.articleSection}>
            <h2 className={styles.editorialHeading}>Hospedeiros e vetores</h2>
            <p className={styles.editorialBody}>
              {curation?.hostsSummary ??
                "Relações de hospedeiros vertebrados ou vetores invertebrados não são categorizadas no registro padrão do NCBI Taxonomy."}
            </p>
          </section>
        </div>
      )}

      {/* Painel: Distribuição */}
      {activeTab === "distribution" && (
        <div id="panel-distribution" role="tabpanel" aria-labelledby="tab-distribution" className={styles.tabContent}>
          <section className={styles.articleSection}>
            <h2 className={styles.editorialHeading}>Distribuição geográfica</h2>
            <p className={styles.editorialBody}>
              Para consultar registros reais de coleta, georreferenciamento e amostragem deste organismo em escala global, acesse a experiência geográfica interativa.
            </p>
            {mapUsable ? (
              <div style={{ marginTop: 20 }}>
                <Link
                  href={`/onde-vivem?q=${encodeURIComponent(taxon.scientificName)}`}
                  className="btn btn--mint"
                >
                  Explorar ocorrências em Onde Vivem? →
                </Link>
              </div>
            ) : (
              <p className={styles.editorialDisclaimer} style={{ marginTop: 16 }}>
                Este táxon está em um nível taxonômico amplo; mapas de ocorrência requerem o gênero ou espécie.
              </p>
            )}
          </section>
        </div>
      )}

      {/* Painel: Referências */}
      {activeTab === "references" && (
        <div id="panel-references" role="tabpanel" aria-labelledby="tab-references" className={styles.tabContent}>
          <section className={styles.articleSection}>
            <h2 className={styles.editorialHeading}>Fontes e referências oficiais</h2>
            <ul className={styles.referenceList} style={{ marginTop: 16 }}>
              <li>
                <strong>NCBI Taxonomy Database:</strong> Registro permanente TaxID {taxon.taxId}.{" "}
                <a
                  href={ncbiTaxonUrl(taxon.taxId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.captionSource}
                >
                  Acessar registro no NCBI ↗
                </a>
              </li>
              {taxon.division && (
                <li>
                  <strong>Divisão GenBank:</strong> {taxon.division}
                </li>
              )}
              {taxon.updateDate && (
                <li>
                  <strong>Última atualização registrada:</strong> {taxon.updateDate}
                </li>
              )}
            </ul>
          </section>
        </div>
      )}

      {/* Modal de Zoom para Micrografias */}
      {zoomImage && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Visualização ampliada">
          <div className={styles.modalContent}>
            <button
              type="button"
              className={styles.modalCloseBtn}
              onClick={() => setZoomImage(null)}
              aria-label="Fechar visualização ampliada"
            >
              ✕
            </button>
            <Image
              src={zoomImage.imageUrl}
              alt={zoomImage.alt}
              width={zoomImage.width * 2}
              height={zoomImage.height * 2}
              className={styles.modalImage}
            />
            <div className={styles.modalCaption}>
              <h4>{zoomImage.stage.pt} ({zoomImage.taxonLabelInCaption})</h4>
              <p>{zoomImage.captionPt}</p>
              <span className={styles.captionSource}>Fonte oficial: CDC DPDx</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
