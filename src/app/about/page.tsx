import Link from "next/link";
import type { Metadata } from "next";
import { CHANNELS } from "@/lib/youtube";

export const metadata: Metadata = {
  title: "About",
  description: "What Techblob is and how it works.",
};

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-2xl px-3 py-8 sm:px-4">
      <h1 className="text-2xl font-black uppercase tracking-wide">
        About <span className="text-brand">Techblob</span>
      </h1>

      <div className="mt-4 space-y-4 text-sm leading-relaxed text-neutral-300">
        <p>
          Techblob is one stream for the best technology, AI, and coding videos on the
          internet. Instead of bouncing between subscriptions, the newest uploads from{" "}
          {CHANNELS.length} hand-picked creators land here automatically, sorted into{" "}
          <Link href="/category/ai" className="text-brand underline">AI</Link>,{" "}
          <Link href="/category/tech" className="text-brand underline">Tech</Link>,{" "}
          <Link href="/category/coding" className="text-brand underline">Coding</Link>, and{" "}
          <Link href="/category/gadgets" className="text-brand underline">Gadgets</Link>.
        </p>
        <p>
          Every video plays through the official YouTube embed. That means creators keep
          their views, ads, and monetization — Techblob is a discovery layer, not a rehost.
          Each video page links straight back to the original on YouTube.
        </p>
        <p>
          Found something great that isn&apos;t here?{" "}
          <Link href="/upload" className="text-brand underline">
            Submit it
          </Link>{" "}
          — paste a YouTube link and it joins the stream. The{" "}
          <Link href="/trending" className="text-brand underline">
            Trending
          </Link>{" "}
          page ranks what Techblob visitors actually watched over the last 48 hours.
        </p>
        <p>
          Browse the full roster on the{" "}
          <Link href="/channels" className="text-brand underline">
            Channels
          </Link>{" "}
          page.
        </p>
      </div>
    </main>
  );
}
