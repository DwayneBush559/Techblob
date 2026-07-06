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

const NAV_LINKS = [
  { href: "/trending", label: "Trending", always: true },
  { href: "/category/ai", label: "AI", always: true },
  { href: "/category/tech", label: "Tech", always: false },
  { href: "/category/coding", label: "Coding", always: false },
  { href: "/category/gadgets", label: "Gadgets", always: false },
  { href: "/channels", label: "Channels", always: false },
];

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
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`hover:text-white ${link.always ? "" : "hidden md:block"}`}
                >
                  {link.label}
                </Link>
              ))}
              <Link href="/search" aria-label="Search" className="hover:text-white">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" strokeLinecap="round" />
                </svg>
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
        <footer className="mt-8 border-t border-surface-border py-8">
          <div className="mx-auto max-w-7xl px-3 sm:px-4">
            <nav className="mb-4 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-neutral-400">
              <Link href="/" className="hover:text-white">Home</Link>
              <Link href="/trending" className="hover:text-white">Trending</Link>
              <Link href="/channels" className="hover:text-white">Channels</Link>
              <Link href="/search" className="hover:text-white">Search</Link>
              <Link href="/upload" className="hover:text-white">Submit a Video</Link>
              <Link href="/about" className="hover:text-white">About</Link>
            </nav>
            <p className="text-center text-xs text-neutral-500">
              © {new Date().getFullYear()} Techblob. Video content belongs to its creators and
              streams via official YouTube embeds.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
