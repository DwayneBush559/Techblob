import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Techblob — Tech & AI Videos",
    template: "%s · Techblob",
  },
  description:
    "The latest technology, AI, and coding videos from the best creators, all in one stream.",
};

export const viewport: Viewport = {
  themeColor: "#0d0d0f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="sticky top-0 z-40 border-b border-surface-border bg-surface/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-3 sm:px-4">
            <Link href="/" className="text-xl font-black tracking-tight">
              TECH<span className="text-brand">BLOB</span>
            </Link>
            <nav className="ml-auto flex items-center gap-4 text-sm font-semibold text-neutral-300">
              <Link href="/?category=ai" className="hover:text-white">
                AI
              </Link>
              <Link href="/?category=tech" className="hidden hover:text-white sm:block">
                Tech
              </Link>
              <Link href="/?category=coding" className="hidden hover:text-white sm:block">
                Coding
              </Link>
              <Link href="/?category=gadgets" className="hidden hover:text-white sm:block">
                Gadgets
              </Link>
              <Link
                href="/upload"
                className="rounded bg-brand px-3 py-1.5 text-white hover:bg-brand-dark"
              >
                Submit
              </Link>
            </nav>
          </div>
        </header>
        {children}
        <footer className="border-t border-surface-border py-8 text-center text-xs text-neutral-500">
          © {new Date().getFullYear()} Techblob. Video content belongs to its creators and
          streams via official YouTube embeds.
        </footer>
      </body>
    </html>
  );
}
