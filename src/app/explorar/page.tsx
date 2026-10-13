import type { Metadata } from "next";
import { CinematicExperience } from "./CinematicExperience";

export const metadata: Metadata = {
  title: "Além das Lentes — Travessia guiada pela rolagem | Microcosmos",
  description:
    "Travessia visual guiada pela rolagem: da objetiva do microscópio ao micromundo, com acesso ao Atlas, ao Laboratório e ao mapa de ocorrências.",
};

export default function ExplorarPage() {
  return <CinematicExperience />;
}
