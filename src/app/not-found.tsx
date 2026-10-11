import Link from "next/link";

export default function NotFound() {
  return (
    <section style={{ padding: "clamp(64px, 10vw, 140px) 0" }}>
      <div className="container" style={{ display: "grid", gap: 20, maxWidth: "40rem" }}>
        <h1 style={{ fontSize: "var(--step-4)", fontWeight: 800, lineHeight: 1, letterSpacing: "-0.04em" }}>
          Esta lâmina não está aqui.
        </h1>
        <p style={{ color: "var(--ink-soft)", fontSize: "var(--step-1)" }}>
          O endereço que você abriu não existe ou foi movido. O diário e a página inicial continuam
          no mesmo lugar.
        </p>
        <p style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <Link href="/" className="btn btn--mint">
            Voltar ao início
          </Link>
          <Link href="/diario" className="btn btn--outline">
            Abrir o diário
          </Link>
        </p>
      </div>
    </section>
  );
}
