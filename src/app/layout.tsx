import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "StreetView — Videos First",
    template: "%s · StreetView",
  },
  description: "The latest viral videos, music premieres, and street culture.",
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
              STREET<span className="text-brand">VIEW</span>
            </Link>
            <nav className="ml-auto flex items-center gap-4 text-sm font-semibold text-neutral-300">
              <Link href="/?category=music" className="hover:text-white">
                Music
              </Link>
              <Link href="/?category=news" className="hidden hover:text-white sm:block">
                News
              </Link>
              <Link href="/?category=fights" className="hidden hover:text-white sm:block">
                Wild
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
          © {new Date().getFullYear()} StreetView. All rights reserved.
        </footer>
      </body>
    </html>
  );
}
