"use client";

import Link from "next/link";
import { StateNote } from "@/components/science/StateNote";

/** Falha inesperada: mensagem fixa, sem detalhes internos. Os provedores já degradam sozinhos. */
export default function AtlasError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="container" style={{ paddingBlock: "clamp(40px, 6vw, 96px)", display: "grid", gap: 16, maxWidth: "46rem" }}>
      <StateNote title="O Atlas não pôde ser exibido agora" tone="error">
        Algo inesperado aconteceu. Nenhum dado foi inventado para preencher a lacuna.
      </StateNote>
      <p style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button type="button" className="btn btn--mint" onClick={() => reset()}>
          Tentar de novo
        </button>
        <Link href="/ciencia" className="btn btn--outline">
          Voltar à visão geral
        </Link>
      </p>
    </div>
  );
}
