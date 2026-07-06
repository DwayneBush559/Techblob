import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getFeedPage } from "@/lib/feed";
import { getTrendingFeed } from "@/lib/trending";
import InfiniteFeed from "@/components/InfiniteFeed";
import TrendingSidebar from "@/components/TrendingSidebar";
import AdBanner from "@/components/AdBanner";

export const revalidate = 30;

async function getCategory(slug: string) {
  return prisma.category.findUnique({ where: { slug } }).catch(() => null);
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const category = await getCategory(params.slug);
  if (!category) return { title: "Category not found" };
  return {
    title: `${category.name} Videos`,
    description: `The latest ${category.name} videos on Techblob.`,
  };
}

export default async function CategoryPage({ params }: { params: { slug: string } }) {
  const category = await getCategory(params.slug);
  if (!category) notFound();

  const [firstPage, trending] = await Promise.all([
    getFeedPage({ category: category.slug }),
    getTrendingFeed().catch(() => []),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-3 py-4 sm:px-4">
      <AdBanner slot="leaderboard" className="mb-4 hidden md:flex" />
      <AdBanner slot="mobileBanner" className="mb-4 md:hidden" />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section>
          <h1 className="mb-3 text-lg font-black uppercase tracking-wide">
            {category.name} <span className="text-brand">Videos</span>
          </h1>
          {firstPage.items.length === 0 ? (
            <p className="rounded-lg bg-surface-raised px-4 py-8 text-center text-sm text-neutral-400">
              No videos in this category yet — check back soon.
            </p>
          ) : (
            <InfiniteFeed
              initialItems={firstPage.items}
              initialCursor={firstPage.nextCursor}
              category={category.slug}
            />
          )}
        </section>

        <TrendingSidebar items={trending} />
      </div>
    </main>
  );
}
