"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SessionUserDto } from "@/lib/types";

// Session widget for the sticky header. The layout stays a static server
// component; this asks /api/auth/me after hydration so every page keeps ISR.

export default function HeaderUser() {
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUserDto | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { signal: AbortSignal.timeout(10_000) })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((data: { user: SessionUserDto | null }) => {
        if (!cancelled) setUser(data.user);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSignOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // cookie may still be set; reload will re-check
    }
    window.location.reload();
  }

  // Reserve the space while loading so the header doesn't jump.
  if (user === undefined) return <span className="inline-block w-16" aria-hidden />;

  if (!user) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(pathname ?? "/")}`}
        className="hover:text-white"
      >
        Sign in
      </Link>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <span className="hidden max-w-28 truncate text-neutral-200 sm:inline" title={user.username}>
        {user.username}
      </span>
      <button
        type="button"
        onClick={onSignOut}
        className="text-neutral-400 hover:text-white"
        title={`Signed in as ${user.username}`}
      >
        Sign out
      </button>
    </span>
  );
}
