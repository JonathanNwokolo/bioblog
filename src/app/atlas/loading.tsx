import { LoadingNote } from "@/components/science/StateNote";

export default function Loading() {
  return (
    <div className="container" style={{ paddingBlock: "clamp(40px, 6vw, 96px)" }}>
      <LoadingNote label="Carregando o Atlas do Invisível…" />
    </div>
  );
}
