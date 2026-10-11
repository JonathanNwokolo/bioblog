import { Diary } from "@/components/diary/Diary";
import { ExploreEntry } from "@/components/explore/ExploreEntry";
import { FeaturedParasite } from "@/components/featured/FeaturedParasite";
import { Hero } from "@/components/hero/Hero";
import { Trajectory } from "@/components/trajectory/Trajectory";

/** Ordem fixa da homepage (docs/approved-homepage-composition.md). O rodapé vem do layout. */
export default function HomePage() {
  return (
    <>
      <Hero />
      <Trajectory />
      <Diary />
      <FeaturedParasite />
      <ExploreEntry />
    </>
  );
}
