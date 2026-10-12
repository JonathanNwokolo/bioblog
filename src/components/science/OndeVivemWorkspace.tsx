"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { OccurrenceMap, type MapPoint } from "@/components/science/OccurrenceMap";
import { SourceDetails } from "@/components/science/SourceDetails";
import { getOrganismCuration } from "@/lib/science/editorial-curation";
import type { GbifTaxon } from "@/lib/science/gbif/types";
import type { Provenance } from "@/lib/science/types";
import { basisLabel, countryName, exclusionLabel, formatCount, formatMeters } from "@/lib/science/present";
import { GBIF_LICENCE_LABELS, GBIF_SAMPLING } from "@/lib/science/config";
import styles from "./Map.module.css";
import sci from "./Science.module.css";

export interface OndeVivemWorkspaceProps {
  taxon: GbifTaxon;
  allPoints: MapPoint[];
  totalGeoreferenced: number;
  sampled: boolean;
  fetchedCount: number;
  sampleCountries: string[];
  topDataset: { share: number; title: string | null } | null;
  countries: { name: string; count: number }[];
  datasets: { datasetKey: string; title: string; records: number; doi: string | null; citation: string | null }[];
  licences: { name: string; count: number }[];
  excluded: Record<string, number>;
  minRequired: number;
  provenance: Provenance;
  ncbiTaxId: string | null;
  crosswalkData?: {
    linked: boolean;
    agreement: string;
    evidence: string[];
    ncbiName: string | null;
    ncbiRank: string | null;
  } | null;
}

type TabType = "distribuicao" | "registros" | "metadados" | "incertezas";

const LIMITATION =
  "Os pontos representam registros disponíveis no GBIF, sujeitos a lacunas e incertezas. Eles não mostram necessariamente toda a distribuição da espécie, prevalência de doença ou risco de infecção.";

function getOrganismThumbnail(scientificName: string, taxId: string | null): string {
  const norm = scientificName.toLowerCase();
  if (norm.includes("trypanosoma cruzi") || taxId === "5693") {
    return "/images/dpdx/tcruzi-trypomastigote-giemsa.jpg";
  }
  if (norm.includes("giardia") || taxId === "5741") {
    return "/images/dpdx/giardia-trophozoite-trichrome.jpg";
  }
  if (norm.includes("plasmodium") || taxId === "5833" || taxId === "5855") {
    return "/images/dpdx/pfalciparum-rings-thin.jpg";
  }
  if (norm.includes("entamoeba") || taxId === "5759") {
    return "/images/dpdx/ehistolytica-trophozoite-trichrome.jpg";
  }
  return "/images/science/ncbi-thumbnail.jpg";
}

export function OndeVivemWorkspace({
  taxon,
  allPoints,
  totalGeoreferenced,
  sampled,
  fetchedCount,
  sampleCountries,
  topDataset,
  countries,
  datasets,
  licences,
  excluded,
  minRequired,
  provenance,
  ncbiTaxId,
  crosswalkData,
}: OndeVivemWorkspaceProps) {
  // Curadoria editorial se disponível
  const curation = useMemo(() => getOrganismCuration(taxon.acceptedName, [taxon.canonicalName]), [taxon]);

  // Faixa temporal dos pontos
  const { minYearFound, maxYearFound } = useMemo(() => {
    const years = allPoints.map((p) => p.year).filter((y): y is number => y !== null);
    if (years.length === 0) return { minYearFound: 1900, maxYearFound: new Date().getFullYear() };
    return {
      minYearFound: Math.min(...years),
      maxYearFound: Math.max(...years),
    };
  }, [allPoints]);

  // Estados dos filtros interativos
  const [activeTab, setActiveTab] = useState<TabType>("distribuicao");
  const [minYearFilter, setMinYearFilter] = useState<number>(minYearFound);
  const [selectedBases, setSelectedBases] = useState<Set<string>>(new Set());
  const [coordPrecision, setCoordPrecision] = useState<"all" | "precise_10km" | "precise_1km">("all");
  const [datasetFilter, setDatasetFilter] = useState<string>("all");

  // Contagem de registros por basisOfRecord no conjunto completo
  const basisCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of allPoints) {
      const b = p.basisOfRecord ?? "UNKNOWN";
      map.set(b, (map.get(b) ?? 0) + 1);
    }
    return map;
  }, [allPoints]);

  const uniqueBases = useMemo(() => Array.from(basisCounts.keys()), [basisCounts]);

  // Filtros aplicados em tempo real
  const filteredPoints = useMemo(() => {
    return allPoints.filter((p) => {
      // Filtro de ano
      if (p.year !== null && p.year < minYearFilter) return false;

      // Filtro de base de registro
      if (selectedBases.size > 0) {
        const b = p.basisOfRecord ?? "UNKNOWN";
        if (!selectedBases.has(b)) return false;
      }

      // Filtro de precisão de coordenadas
      if (coordPrecision === "precise_10km") {
        if (p.uncertaintyMeters === null || p.uncertaintyMeters > 10_000) return false;
      } else if (coordPrecision === "precise_1km") {
        if (p.uncertaintyMeters === null || p.uncertaintyMeters > 1_000) return false;
      }

      // Filtro de conjunto de dados
      if (datasetFilter !== "all") {
        const dTitle = p.datasetTitle ?? p.datasetName;
        if (dTitle !== datasetFilter) return false;
      }

      return true;
    });
  }, [allPoints, minYearFilter, selectedBases, coordPrecision, datasetFilter]);

  // Reset de filtros
  const handleResetFilters = () => {
    setMinYearFilter(minYearFound);
    setSelectedBases(new Set());
    setCoordPrecision("all");
    setDatasetFilter("all");
  };

  const toggleBasis = (baseKey: string) => {
    setSelectedBases((prev) => {
      const next = new Set(prev);
      if (next.has(baseKey)) {
        next.delete(baseKey);
      } else {
        next.add(baseKey);
      }
      return next;
    });
  };

  // Métricas dinâmicas computadas a partir de filteredPoints
  const mappedCount = filteredPoints.length;
  const mappedCountriesCount = useMemo(() => {
    const cSet = new Set<string>();
    for (const p of filteredPoints) {
      if (p.country) cSet.add(p.country);
    }
    return cSet.size;
  }, [filteredPoints]);

  const mappedDatasetsCount = useMemo(() => {
    const dSet = new Set<string>();
    for (const p of filteredPoints) {
      const d = p.datasetTitle ?? p.datasetName;
      if (d) dSet.add(d);
    }
    return dSet.size;
  }, [filteredPoints]);

  const mappedYearSpan = useMemo(() => {
    const years = filteredPoints.map((p) => p.year).filter((y): y is number => y !== null);
    if (years.length === 0) return "Indisponível";
    const mn = Math.min(...years);
    const mx = Math.max(...years);
    return mn === mx ? `${mn}` : `${mn} – ${mx}`;
  }, [filteredPoints]);

  // Distribuição por país dos pontos filtrados
  const filteredCountryBars = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of filteredPoints) {
      const c = p.country ?? "Não informado";
      map.set(c, (map.get(c) ?? 0) + 1);
    }
    const sorted = Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    const top = sorted[0]?.count ?? 1;
    return { list: sorted.slice(0, 6), top };
  }, [filteredPoints]);

  // Distribuição por tipo/ambiente dos pontos filtrados
  const filteredBasisBars = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of filteredPoints) {
      const b = basisLabel(p.basisOfRecord) ?? "Não especificado";
      map.set(b, (map.get(b) ?? 0) + 1);
    }
    const sorted = Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    const top = sorted[0]?.count ?? 1;
    return { list: sorted.slice(0, 5), top };
  }, [filteredPoints]);

  // 3 registros recentes catalogados
  const recentPoints = useMemo(() => {
    return [...filteredPoints]
      .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
      .slice(0, 3);
  }, [filteredPoints]);

  const organismThumbnail = getOrganismThumbnail(taxon.acceptedName, ncbiTaxId);
  const atlasLinkHref = ncbiTaxId ? `/atlas/${ncbiTaxId}` : `/atlas?q=${encodeURIComponent(taxon.acceptedName)}`;

  return (
    <div className={styles.workspaceGrid}>
      {/* =========================================================================
          COLUNA ESQUERDA: Organismo Selecionado e Filtros Interativos
          ========================================================================= */}
      <aside className={styles.sidebarCol} aria-label="Painel de filtros e organismo">
        {/* Card: Organismo Selecionado */}
        <section className={styles.organismCard} aria-labelledby="sidebar-organism-title">
          <div className={styles.cardTopRow}>
            <span id="sidebar-organism-title" className={styles.cardSectionTitle}>
              ORGANISMO SELECIONADO
            </span>
            <Link href="/onde-vivem" className={styles.changeBtn} title="Buscar outro organismo">
              Trocar
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </Link>
          </div>

          <div className={styles.organismThumbWrap}>
            <Image
              src={organismThumbnail}
              alt={`Micrografia científica de ${taxon.acceptedName}`}
              fill
              className={styles.organismThumb}
              sizes="310px"
              priority
            />
          </div>

          <div className={styles.organismInfo}>
            <h2 className={styles.organismName}>
              <i lang="la">{taxon.acceptedName}</i>
            </h2>
            <span className={styles.organismCategory}>
              {curation?.subtitle ?? `${taxon.rank.toLowerCase()} · ${taxon.classification.family ?? "Trypanosomatidae"}`}
            </span>
            <div className={styles.badgeRow}>
              {ncbiTaxId && (
                <span className={styles.badgeNcbi}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  NCBI TaxID: {ncbiTaxId}
                </span>
              )}
              <span className={styles.badgeGbif}>GBIF Key: {taxon.acceptedKey}</span>
            </div>
          </div>

          <p className={styles.organismDesc}>
            {curation?.overview ??
              "Organismo com registros de ocorrência georreferenciados catalogados no Sistema Global de Informação sobre Biodiversidade (GBIF)."}
          </p>

          <Link href={atlasLinkHref} className={styles.atlasLink}>
            Explorar no Atlas do Invisível
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        </section>

        {/* Card: Filtros de Ocorrência */}
        <section className={styles.filterCard} aria-labelledby="sidebar-filters-title">
          <div className={styles.cardTopRow}>
            <span id="sidebar-filters-title" className={styles.cardSectionTitle}>
              FILTROS DE OCORRÊNCIA
            </span>
            <button type="button" onClick={handleResetFilters} className={styles.clearBtn}>
              Limpar
            </button>
          </div>

          {/* Filtro: Intervalo de Anos */}
          <div className={styles.filterGroup}>
            <label htmlFor="year-range" className={styles.filterGroupTitle}>
              A partir do ano: <strong style={{ color: "#7c3aed" }}>{minYearFilter}</strong>
            </label>
            <input
              id="year-range"
              type="range"
              min={minYearFound}
              max={maxYearFound}
              value={minYearFilter}
              onChange={(e) => setMinYearFilter(Number(e.target.value))}
              className={styles.rangeSlider}
            />
            <div className={styles.rangeInputs}>
              <span>{minYearFound}</span>
              <span>{maxYearFound}</span>
            </div>
          </div>

          {/* Filtro: Tipo de Registro */}
          <div className={styles.filterGroup}>
            <span className={styles.filterGroupTitle}>Tipo de Registro</span>
            <div className={styles.checkboxList}>
              {uniqueBases.map((baseKey) => {
                const count = basisCounts.get(baseKey) ?? 0;
                const isChecked = selectedBases.has(baseKey);
                return (
                  <label key={baseKey} className={styles.checkboxItem}>
                    <span className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleBasis(baseKey)}
                      />
                      {basisLabel(baseKey === "UNKNOWN" ? null : baseKey) ?? "Não especificado"}
                    </span>
                    <span className={styles.filterCount}>{formatCount(count)}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Filtro: Precisão da Coordenada */}
          <div className={styles.filterGroup}>
            <label htmlFor="coord-precision" className={styles.filterGroupTitle}>
              Incerteza da Coordenada
            </label>
            <select
              id="coord-precision"
              value={coordPrecision}
              onChange={(e) => setCoordPrecision(e.target.value as "all" | "precise_10km" | "precise_1km")}
              className={styles.selectInput}
            >
              <option value="all">Qualquer incerteza informada</option>
              <option value="precise_10km">&lt; 10 km (Alta precisão)</option>
              <option value="precise_1km">&lt; 1 km (Localidade exata)</option>
            </select>
          </div>

          {/* Filtro: Conjunto de Dados */}
          {datasets.length > 0 && (
            <div className={styles.filterGroup}>
              <label htmlFor="dataset-select" className={styles.filterGroupTitle}>
                Conjunto de Dados
              </label>
              <select
                id="dataset-select"
                value={datasetFilter}
                onChange={(e) => setDatasetFilter(e.target.value)}
                className={styles.selectInput}
              >
                <option value="all">Todos os conjuntos ({datasets.length})</option>
                {datasets.map((d) => (
                  <option key={d.datasetKey} value={d.title}>
                    {d.title.length > 34 ? `${d.title.slice(0, 32)}…` : d.title} ({d.records})
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            className={styles.applyFilterBtn}
            onClick={() => setActiveTab("distribuicao")}
          >
            Filtros Ativos ({formatCount(mappedCount)})
          </button>
        </section>
      </aside>

      {/* =========================================================================
          COLUNA DIREITA: Navegação por Abas, Mapa Interativo, Métricas e Análise
          ========================================================================= */}
      <main className={styles.mainCol} aria-label="Espaço de trabalho de distribuição">
        {/* Abas Superiores */}
        <nav className={styles.tabsNav} aria-label="Abas de visualização científica">
          <div className={styles.tabList} role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "distribuicao"}
              className={`${styles.tabBtn} ${activeTab === "distribuicao" ? styles.tabBtnActive : ""}`}
              onClick={() => setActiveTab("distribuicao")}
            >
              Distribuição Global
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "registros"}
              className={`${styles.tabBtn} ${activeTab === "registros" ? styles.tabBtnActive : ""}`}
              onClick={() => setActiveTab("registros")}
            >
              Registros no Mapa ({formatCount(mappedCount)})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "metadados"}
              className={`${styles.tabBtn} ${activeTab === "metadados" ? styles.tabBtnActive : ""}`}
              onClick={() => setActiveTab("metadados")}
            >
              Metadados GBIF & Fontes
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "incertezas"}
              className={`${styles.tabBtn} ${activeTab === "incertezas" ? styles.tabBtnActive : ""}`}
              onClick={() => setActiveTab("incertezas")}
            >
              Incertezas & Viés Científico
            </button>
          </div>
        </nav>

        {/* CONTEÚDO DA ABA 1: Distribuição Global (Principal) */}
        {activeTab === "distribuicao" && (
          <>
            {/* Mapa Interativo Estilizado com Tema Dark Satélite e Overlays */}
            <OccurrenceMap points={filteredPoints} taxonName={taxon.acceptedName} showRecordList={false} />

            {/* Banner de Atenção Científica e Incerteza */}
            <section className={styles.noticeBanner} role="note" aria-label="Aviso sobre interpretação de dados">
              <div className={styles.noticeIcon} aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div className={styles.noticeContent}>
                <h3 className={styles.noticeTitle}>
                  Atenção Científica: Presença não equivale a risco epidemiológico direto
                </h3>
                <p className={styles.noticeText}>
                  Registros pontuais refletem locais de coleta em campo ou espécimes de coleções biológicas históricas. A
                  ausência de pontos em uma região não comprova ausência do táxon: decorre frequentemente de lacunas de amostragem
                  sistemática.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("incertezas")}
                  className={styles.noticeLink}
                  style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
                >
                  Ver documentação completa sobre incerteza geográfica →
                </button>
              </div>
            </section>

            {/* Grid de Métricas (4 Cards) */}
            <section className={styles.metricCardsGrid} aria-label="Estatísticas do conjunto exibido">
              {/* Card 1: Registros Mapeados */}
              <div className={styles.metricCard}>
                <div className={styles.metricIconCircle} aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="22" y1="12" x2="18" y2="12" />
                    <line x1="6" y1="12" x2="2" y2="12" />
                    <line x1="12" y1="6" x2="12" y2="2" />
                    <line x1="12" y1="22" x2="12" y2="18" />
                  </svg>
                </div>
                <div className={styles.metricBody}>
                  <span className={styles.metricLabel}>Registros Mapeados</span>
                  <strong className={styles.metricNumber}>{formatCount(mappedCount)}</strong>
                </div>
              </div>

              {/* Card 2: Países com Coleta */}
              <div className={styles.metricCard}>
                <div className={styles.metricIconCircle} aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M2 12h20" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                </div>
                <div className={styles.metricBody}>
                  <span className={styles.metricLabel}>Países com Coleta</span>
                  <strong className={styles.metricNumber}>{formatCount(mappedCountriesCount)}</strong>
                </div>
              </div>

              {/* Card 3: Bases de Dados */}
              <div className={styles.metricCard}>
                <div className={styles.metricIconCircle} aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <ellipse cx="12" cy="5" rx="9" ry="3" />
                    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                  </svg>
                </div>
                <div className={styles.metricBody}>
                  <span className={styles.metricLabel}>Bases de Dados</span>
                  <strong className={styles.metricNumber}>{formatCount(mappedDatasetsCount)}</strong>
                </div>
              </div>

              {/* Card 4: Intervalo Temporal */}
              <div className={styles.metricCard}>
                <div className={styles.metricIconCircle} aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <div className={styles.metricBody}>
                  <span className={styles.metricLabel}>Intervalo Temporal</span>
                  <strong className={styles.metricNumber}>{mappedYearSpan}</strong>
                </div>
              </div>
            </section>

            {/* Grid de Decomposição (2 Cards: Países e Ambientes) */}
            <section className={styles.breakdownsGrid} aria-label="Decomposição taxonômica e geográfica">
              {/* Card 1: Distribuição por País */}
              <div className={styles.breakdownCard}>
                <h3 className={styles.breakdownTitle}>Distribuição por País</h3>
                <ul className={styles.barList}>
                  {filteredCountryBars.list.map((c) => (
                    <li key={c.name} className={styles.barRow}>
                      <span className={styles.barLabel}>{c.name}</span>
                      <span className={styles.barTrack} aria-hidden="true">
                        <span
                          className={styles.barFill}
                          style={{ width: `${Math.max(3, (c.count / filteredCountryBars.top) * 100)}%` }}
                        />
                      </span>
                      <span className={styles.barNum}>{formatCount(c.count)}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => setActiveTab("registros")}
                  className={styles.viewAllLink}
                  style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
                >
                  Ver todos os países na lista de registros →
                </button>
              </div>

              {/* Card 2: Ambiente e Tipo de Registro */}
              <div className={styles.breakdownCard}>
                <h3 className={styles.breakdownTitle}>Ambiente e Tipo de Registro</h3>
                <ul className={styles.barList}>
                  {filteredBasisBars.list.map((b) => (
                    <li key={b.name} className={styles.barRow}>
                      <span className={styles.barLabel}>{b.name}</span>
                      <span className={styles.barTrack} aria-hidden="true">
                        <span
                          className={styles.barFill}
                          style={{
                            width: `${Math.max(3, (b.count / filteredBasisBars.top) * 100)}%`,
                            backgroundColor: "#8b5cf6",
                          }}
                        />
                      </span>
                      <span className={styles.barNum}>{formatCount(b.count)}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => setActiveTab("metadados")}
                  className={styles.viewAllLink}
                  style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
                >
                  Ver documentação de metodologia GBIF →
                </button>
              </div>
            </section>

            {/* Linha Inferior com 3 Cards Editoriais e de Contexto */}
            <section className={styles.bottomRowGrid} aria-label="Contexto biológico e registros recentes">
              {/* Card 1: Registros Recentes */}
              <div className={styles.recentCard}>
                <div className={styles.recentHeader}>
                  <h3 className={styles.recentTitle}>Registros Recentes Catalogados</h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab("registros")}
                    className={styles.viewAllLink}
                    style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
                  >
                    Ver todos
                  </button>
                </div>
                <ul className={styles.recentList}>
                  {recentPoints.map((pt) => (
                    <li key={pt.gbifId} className={styles.recentItem}>
                      <div className={styles.recentThumbWrap}>
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "#241e1b",
                            color: "#80f9c7",
                          }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                        </div>
                      </div>
                      <div className={styles.recentInfo}>
                        <strong className={styles.recentLocation}>{pt.country ?? "Localidade não informada"}</strong>
                        <span className={styles.recentMeta}>
                          {pt.year ? `Ano ${pt.year}` : "Data não informada"} · {pt.lat.toFixed(2)}°, {pt.lon.toFixed(2)}°
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Card 2: Contexto do Vetor: Barbeiro */}
              <div className={styles.contextCard}>
                <div className={styles.contextBackdrop} />
                <div className={styles.contextContent}>
                  <span className={styles.contextEyebrow}>ECOLOGIA DE VETORES</span>
                  <h3 className={styles.contextTitle}>Transmissão Vetorial & Barbeiros</h3>
                  <p className={styles.contextDesc}>
                    Hemípteros hematófagos da subfamília Triatominae (como <em>Triatoma infestans</em> e <em>Panstrongylus</em>)
                    sustentam os ciclos enzoótico e peridomiciliar.
                  </p>
                  <Link href="/atlas" className={styles.contextLink}>
                    Explorar vetores no Atlas →
                  </Link>
                </div>
              </div>

              {/* Card 3: Explorar Biodiversidade Relacionada */}
              <div className={styles.exploreCard}>
                <div className={styles.exploreHeader}>
                  <div className={styles.exploreIcon} aria-hidden="true">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </div>
                  <span className={styles.exploreEyebrow}>REDE ECOLÓGICA</span>
                  <h3 className={styles.exploreTitle}>Mamíferos Reservatórios</h3>
                  <p className={styles.exploreDesc}>
                    Didelfídeos (gambás), dasipodídeos (tatus) e roedores silvestres conectam ambientes de mata a áreas de
                    transição habitacional humana.
                  </p>
                </div>
                <Link href={atlasLinkHref} className={styles.exploreBtn}>
                  Ver Relações no Atlas
                </Link>
              </div>
            </section>
          </>
        )}

        {/* CONTEÚDO DA ABA 2: Lista Completa de Registros no Mapa */}
        {activeTab === "registros" && (
          <section className={sci.panel} aria-label="Lista de registros">
            <h3 className={sci.panelTitle}>Registros Individuais ({formatCount(filteredPoints.length)})</h3>
            <p className={sci.hint} style={{ marginTop: 6 }}>
              Relação completa de ocorrências georreferenciadas aprovadas no controle de integridade espacial.
            </p>
            <div style={{ marginTop: 16 }}>
              <OccurrenceMap points={filteredPoints} taxonName={taxon.acceptedName} showRecordList={true} />
            </div>
          </section>
        )}

        {/* CONTEÚDO DA ABA 3: Metadados GBIF & Fontes */}
        {activeTab === "metadados" && (
          <div className={sci.stack}>
            <SourceDetails
              provenance={provenance}
              open
              limitations={
                <>
                  <p>{LIMITATION}</p>
                  <p style={{ marginTop: 6 }}>
                    <strong>Amostragem:</strong> {formatCount(fetchedCount)} registros avaliados entre{" "}
                    {formatCount(totalGeoreferenced)} com coordenadas no GBIF Backbone.
                  </p>
                </>
              }
              extra={[
                {
                  label: "Amostra avaliada",
                  value: `${formatCount(fetchedCount)} avaliados; mínimo exigido: ${GBIF_SAMPLING.minReliableOccurrences}`,
                },
                ...(Object.keys(excluded).length > 0
                  ? [
                      {
                        label: "Registros Excluídos",
                        value: (
                          <ul className={styles.exclusions}>
                            {Object.entries(excluded).map(([code, count]) => (
                              <li key={code}>
                                <span>{exclusionLabel(code)}</span>
                                <span className={styles.num}>{formatCount(count)}</span>
                              </li>
                            ))}
                          </ul>
                        ),
                      },
                    ]
                  : []),
                {
                  label: "Licenças de Uso",
                  value:
                    licences.map((l) => `${GBIF_LICENCE_LABELS[l.name] ?? l.name}: ${formatCount(l.count)}`).join("; ") ||
                    "não informadas",
                },
                {
                  label: "Conjuntos de Dados Citados",
                  value: (
                    <ol className={styles.citations}>
                      {datasets.map((d) => (
                        <li key={d.datasetKey}>
                          {d.citation ?? d.title}
                          {d.doi ? (
                            <>
                              {" "}
                              <a href={`https://doi.org/${encodeURIComponent(d.doi)}`} target="_blank" rel="noopener noreferrer">
                                doi:{d.doi}
                                <span className="visually-hidden"> (abre em nova aba)</span>
                              </a>
                            </>
                          ) : null}{" "}
                          <span>({formatCount(d.records)} no mapa)</span>
                        </li>
                      ))}
                    </ol>
                  ),
                },
              ]}
            />
          </div>
        )}

        {/* CONTEÚDO DA ABA 4: Incertezas & Viés Científico */}
        {activeTab === "incertezas" && (
          <div className={sci.stack}>
            <section className={sci.panel}>
              <h3 className={sci.panelTitle}>Compreendendo o Viés e a Incerteza Espacial</h3>
              <ul className={sci.stack} style={{ marginTop: 14, color: "var(--ink-soft)" }}>
                <li>
                  <strong style={{ color: "var(--ink)" }}>Pontos não são limites de distribuição:</strong> Cada coordenada
                  documenta um evento em que um espécime foi coletado, observado ou sequenciado. Áreas sem pontos refletem
                  ausência de dados publicados, não comprovação de ausência do parasita.
                </li>
                <li>
                  <strong style={{ color: "var(--ink)" }}>Concentração de Amostragem:</strong> Estudos acadêmicos e projetos de
                  vigilância epidemiológica frequentemente coletam massivamente em regiões pontuais.
                </li>
                {topDataset && topDataset.share >= 0.5 && (
                  <li>
                    <strong style={{ color: "#b91c1c" }}>Dominância de conjunto único:</strong> {Math.round(topDataset.share * 100)}%
                    dos registros georreferenciados provêm de &quot;{topDataset.title ?? "um mesmo conjunto"}&quot;.
                  </li>
                )}
                <li>
                  <strong style={{ color: "var(--ink)" }}>Precisão das Coordenadas:</strong> Diversos registros históricos
                  utilizam centroides municipais ou coordenadas com incerteza na ordem de dezenas de quilômetros.
                </li>
              </ul>
            </section>

            {crosswalkData && (
              <section className={sci.panel}>
                <h3 className={sci.panelTitle}>Correspondência Taxonômica GBIF ↔ NCBI</h3>
                <p className={sci.hint} style={{ marginTop: 6 }}>
                  Status: <strong>{crosswalkData.agreement}</strong>
                </p>
                <ul className={sci.stack} style={{ marginTop: 10, color: "var(--ink-soft)" }}>
                  {crosswalkData.evidence.map((ev, i) => (
                    <li key={i}>{ev}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
