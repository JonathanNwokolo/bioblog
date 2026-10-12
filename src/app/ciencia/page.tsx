import type { Metadata } from "next";
import Link from "next/link";
import { ScienceShell } from "@/components/science/ScienceShell";
import { ArrowRight } from "@/components/ui/icons";
import sci from "@/components/science/Science.module.css";
import hub from "./hub.module.css";

export const metadata: Metadata = {
  title: "Ciência interativa",
  description:
    "Três experiências com dados científicos oficiais: classificação (NCBI), microscopia de referência (CDC DPDx) e registros de ocorrência (GBIF).",
};

const EXPERIENCES = [
  {
    href: "/atlas",
    title: "Atlas do Invisível",
    source: "NCBI Taxonomy",
    body: "Digite um nome científico e veja o nome aceito, os sinônimos e a posição do organismo na árvore da vida. Homônimos aparecem como incerteza, não como escolha silenciosa.",
    action: "Abrir o Atlas",
  },
  {
    href: "/laboratorio",
    title: "Laboratório Interativo",
    source: "CDC DPDx",
    body: "Micrografias de referência, uma a uma, com ampliação, legenda original e a base de uso de cada imagem. Espécie e estágio diagnóstico ficam separados.",
    action: "Abrir o Laboratório",
  },
  {
    href: "/onde-vivem",
    title: "Onde vivem?",
    source: "GBIF",
    body: "Registros de ocorrência em um mapa interativo, com o que eles não dizem: lacunas, viés de coleta e incerteza das coordenadas.",
    action: "Ver o mapa",
  },
] as const;

export default function CienciaPage() {
  return (
    <ScienceShell
      active="hub"
      title="Ciência interativa"
      lede="Dados oficiais, lidos com cuidado. Cada experiência mostra de onde vieram os dados, quando foram consultados e o que eles não permitem concluir."
    >
      <div className={sci.stack}>
        <ul className={hub.list}>
          {EXPERIENCES.map((item, index) => (
            <li key={item.href} className={hub.item}>
              <span className={hub.index} aria-hidden="true">
                {index + 1}
              </span>
              <div className={hub.body}>
                <p className={hub.source}>{item.source}</p>
                <h2 className={hub.title}>{item.title}</h2>
                <p className={hub.text}>{item.body}</p>
              </div>
              <Link href={item.href} className="btn btn--mint">
                {item.action}
                <ArrowRight />
              </Link>
            </li>
          ))}
        </ul>

        <section className={sci.panel} aria-labelledby="principios">
          <h2 id="principios" className={sci.panelTitle}>
            Como estes dados são tratados
          </h2>
          <ul className={hub.principles}>
            <li>
              <strong>Origem à vista.</strong> Cada resultado traz fonte, link para o registro original e a data da consulta.
            </li>
            <li>
              <strong>Lacuna é lacuna.</strong> O que a fonte não informa aparece como “não informado”, nunca como um valor
              plausível.
            </li>
            <li>
              <strong>Incerteza não é escondida.</strong> Nomes repetidos, correspondências aproximadas e poucos registros viram um
              aviso, não uma escolha automática.
            </li>
            <li>
              <strong>Educativo, não diagnóstico.</strong> Nada aqui orienta diagnóstico, tratamento ou avaliação de risco.
            </li>
            <li>
              <strong>Independente das publicações.</strong> O diário funciona e publica mesmo que qualquer uma dessas fontes esteja
              fora do ar.
            </li>
          </ul>
        </section>
      </div>
    </ScienceShell>
  );
}
