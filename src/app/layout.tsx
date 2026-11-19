import type { Metadata, Viewport } from "next";
import Link from "next/link";
import HeaderUser from "@/components/HeaderUser";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "TechBlob — Tech & AI Videos",
    template: "%s · TechBlob",
  },
  description:
    "AI fails, terminal speedruns, tool premieres and builder breakdowns, in one stream. By Kavaro LLC.",
};

export const viewport: Viewport = {
  themeColor: "#0d0d0f",
  width: "device-width",
  initialScale: 1,
};

const NAV_LINKS = [
  { href: "/trending", label: "Trending", always: true },
  { href: "/category/ai-fails", label: "AI Fails", always: true },
  { href: "/category/terminal-speedruns", label: "Terminal Speedruns", always: false },
  { href: "/category/tool-premieres", label: "Tool Premieres", always: false },
  { href: "/category/builder-breakdowns", label: "Builder Breakdowns", always: false },
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
              <HeaderUser />
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
              <Link href="/legal/privacy" className="hover:text-white">Privacy</Link>
              <Link href="/legal/terms" className="hover:text-white">Terms</Link>
              <Link href="/legal/dmca" className="hover:text-white">DMCA</Link>
              <Link href="/legal/delete-account" className="hover:text-white">Delete account</Link>
              <Link href="/legal/support" className="hover:text-white">Support</Link>
            </nav>
            <p className="text-center text-xs text-neutral-500">
              © {new Date().getFullYear()} Kavaro LLC. TechBlob is for adults 18 and over. Videos belong to their
              creators; YouTube videos play through YouTube&apos;s official embed. Contact: info@kavarollc.com
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
