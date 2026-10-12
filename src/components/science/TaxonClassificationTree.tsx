"use client";

import Link from "next/link";
import { useState } from "react";
import type { TaxonRecord } from "@/lib/science/ncbi/types";
import { rankLabel } from "@/lib/science/present";
import styles from "./Atlas.module.css";

interface TaxonClassificationTreeProps {
  taxon: TaxonRecord;
  mapUsable: boolean;
}

const CANONICAL_RANKS: Array<{ id: string; label: string }> = [
  { id: "domain", label: "Domínio" },
  { id: "kingdom", label: "Reino" },
  { id: "phylum", label: "Filo" },
  { id: "class", label: "Classe" },
  { id: "order", label: "Ordem" },
  { id: "family", label: "Família" },
  { id: "genus", label: "Gênero" },
  { id: "species", label: "Espécie" },
];

export function TaxonClassificationTree({ taxon, mapUsable }: TaxonClassificationTreeProps) {
  const [copied, setCopied] = useState(false);

  // Mapeia os nós da linhagem para construir a hierarquia
  const lineageMap = new Map<string, { taxId: string; name: string }>();
  for (const node of taxon.lineage) {
    if (node.rank) {
      lineageMap.set(node.rank.toLowerCase(), { taxId: node.taxId, name: node.name });
    }
  }

  // Se o próprio táxon for espécie, gênero etc.
  if (taxon.rank) {
    lineageMap.set(taxon.rank.toLowerCase(), { taxId: taxon.taxId, name: taxon.scientificName });
  }

  const allSynonyms = Array.from(
    new Set([
      ...taxon.synonyms,
      ...taxon.otherNames.map((o) => o.name),
    ].filter((name) => name !== taxon.scientificName))
  );

  // Preenche nós canônicos
  const displayNodes = CANONICAL_RANKS.map((rank) => {
    const found = lineageMap.get(rank.id);
    const isCurrent = taxon.rank?.toLowerCase() === rank.id || (rank.id === "species" && (!taxon.rank || taxon.rank.toLowerCase() === "species"));
    return {
      rankId: rank.id,
      rankLabel: rank.label,
      name: found ? found.name : isCurrent ? taxon.scientificName : null,
      taxId: found ? found.taxId : isCurrent ? taxon.taxId : null,
      isCurrent,
    };
  }).filter((n) => n.name !== null || n.isCurrent);

  // Se não encontrar os canônicos, usa a linhagem pura do NCBI
  const fallbackNodes = taxon.lineage.map((node) => ({
    rankId: node.rank ?? "unranked",
    rankLabel: rankLabel(node.rank).text,
    name: node.name,
    taxId: node.taxId,
    isCurrent: false,
  }));

  const nodesToRender = displayNodes.length >= 4 ? displayNodes : [
    ...fallbackNodes,
    {
      rankId: taxon.rank ?? "species",
      rankLabel: rankLabel(taxon.rank).text,
      name: taxon.scientificName,
      taxId: taxon.taxId,
      isCurrent: true,
    },
  ];

  const handleCopyTaxId = async () => {
    try {
      await navigator.clipboard.writeText(taxon.taxId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback gracioso
    }
  };

  return (
    <aside className={styles.leftCol}>
      {/* Card: Classificação Taxonômica */}
      <section className={styles.treeCard} aria-labelledby="heading-classificacao">
        <h2 id="heading-classificacao" className={styles.treeCardTitle}>
          Classificação taxonômica
        </h2>

        <div className={styles.treeContainer}>
          <div className={styles.treeTrack} aria-hidden="true" />
          <ol className={styles.treeList}>
            {nodesToRender.map((node, index) => {
              const isLast = index === nodesToRender.length - 1 || node.isCurrent;
              return (
                <li
                  key={`${node.rankId}-${node.name}`}
                  className={`${styles.treeItem} ${node.isCurrent ? styles.treeItemCurrent : ""}`}
                >
                  <span className={styles.treeDot} aria-hidden="true" />
                  <div className={styles.treeItemContent}>
                    <span className={styles.treeRankName}>{node.rankLabel}</span>
                    <span className={styles.treeTaxonName}>
                      {node.isCurrent ? (
                        <strong lang="la" className={styles.currentTaxonStrong}>
                          {node.name}
                        </strong>
                      ) : node.taxId ? (
                        <Link href={`/atlas/${node.taxId}`} lang="la" className={styles.treeAncestorLink}>
                          {node.name}
                        </Link>
                      ) : (
                        <span lang="la">{node.name}</span>
                      )}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* Card: Identificadores */}
      <section className={styles.identifiersCard} aria-labelledby="heading-identificadores">
        <h2 id="heading-identificadores" className={styles.identifiersTitle}>
          Identificadores
        </h2>

        <dl className={styles.identifiersList}>
          <div className={styles.idRow}>
            <dt>NCBI Taxonomy ID</dt>
            <dd className={styles.idWithCopy}>
              <span>{taxon.taxId}</span>
              <button
                type="button"
                onClick={handleCopyTaxId}
                className={styles.copyBtn}
                aria-label="Copiar identificador TaxID do NCBI"
                title="Copiar TaxID"
              >
                {copied ? (
                  <span className={styles.copiedFeedback}>Copiado!</span>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </button>
            </dd>
          </div>

          <div className={styles.idRow}>
            <dt>GBIF (quando disponível)</dt>
            <dd>
              {mapUsable ? (
                <Link
                  href={`/onde-vivem?q=${encodeURIComponent(taxon.scientificName)}`}
                  className={styles.gbifLinkBadge}
                >
                  Ver ocorrências ↗
                </Link>
              ) : (
                <span className={styles.missingId}>—</span>
              )}
            </dd>
          </div>

          {allSynonyms.length > 0 && (
            <div className={styles.synonymsRow}>
              <dt>Outros nomes (sinônimos)</dt>
              <dd>
                <div className={styles.synonymPills}>
                  {allSynonyms.map((syn) => (
                    <span key={syn} className={styles.synonymPill} lang="la">
                      {syn}
                    </span>
                  ))}
                </div>
              </dd>
            </div>
          )}

          {taxon.division && (
            <div className={styles.idRow}>
              <dt>Divisão GenBank</dt>
              <dd>{taxon.division}</dd>
            </div>
          )}
        </dl>
      </section>
    </aside>
  );
}
