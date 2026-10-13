/**
 * /explorar vive no fluxo normal do documento (Fase 2.3.2).
 *
 * Antes, este layout cobria o site com uma camada `position: fixed` e a rota
 * travava a rolagem global. Agora a rolagem real governa a experiência: o
 * layout apenas oculta o cabeçalho do site (a jornada tem a própria barra
 * superior) e deixa a trilha rolar até o rodapé.
 */
export default function ExplorarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style>{"#topo{display:none}"}</style>
      {children}
    </>
  );
}
