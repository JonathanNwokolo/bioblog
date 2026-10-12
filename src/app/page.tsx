import { Diary } from "@/components/diary/Diary";
import { ExploreEntry } from "@/components/explore/ExploreEntry";
import { FeaturedParasite } from "@/components/featured/FeaturedParasite";
import { Hero } from "@/components/hero/Hero";
import { Trajectory } from "@/components/trajectory/Trajectory";
import { safelyListPublishedPosts } from "@/lib/cms/repository";

/** Ordem fixa da homepage (docs/approved-homepage-composition.md). O rodapé vem do layout. */
export default async function HomePage() {
  const diary = await safelyListPublishedPosts();
  return (
    <>
      <Hero />
      <Trajectory />
      <Diary posts={diary.posts} error={diary.error} />
      <FeaturedParasite />
      <ExploreEntry />
    </>
  );
}
