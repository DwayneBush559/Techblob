import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import SubmitForm from "@/components/SubmitForm";
import AdBanner from "@/components/AdBanner";

export const metadata: Metadata = {
  title: "Submit a Video",
  description: "Share a great tech, AI, or coding video with the Techblob community.",
};

export const revalidate = 300;

export default async function UploadPage() {
  const categories = await prisma.category
    .findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    })
    .catch(() => []);

  return (
    <main className="mx-auto max-w-2xl px-3 py-8 sm:px-4">
      <h1 className="text-2xl font-black uppercase tracking-wide">Submit a Video</h1>
      <p className="mt-2 text-sm text-neutral-400">
        Found a great tech, AI, or coding video? Drop the YouTube link below — we&apos;ll pull
        the title and thumbnail automatically and it goes straight into the stream.
      </p>

      <div className="mt-6 rounded-lg bg-surface-raised p-4 sm:p-6">
        <SubmitForm categories={categories} />
      </div>

      <p className="mt-4 text-xs text-neutral-500">
        Videos play as official YouTube embeds — creators keep full credit and monetization.
        Direct file uploads are coming soon.
      </p>

      <AdBanner slot="leaderboard" className="mt-8 hidden md:flex" />
      <AdBanner slot="mobileBanner" className="mt-8 md:hidden" />
    </main>
  );
}
