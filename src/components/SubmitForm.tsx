"use client";

import { useState } from "react";
import Link from "next/link";

interface CategoryOption {
  id: string;
  name: string;
}

type SubmitState =
  | { phase: "idle" }
  | { phase: "submitting" }
  | { phase: "success"; message: string; slug?: string }
  | { phase: "error"; message: string };

export default function SubmitForm({ categories }: { categories: CategoryOption[] }) {
  const [url, setUrl] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [state, setState] = useState<SubmitState>({ phase: "idle" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state.phase === "submitting") return;
    setState({ phase: "submitting" });

    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          ...(categoryId ? { categoryId } : {}),
        }),
        signal: AbortSignal.timeout(15_000),
      });
      const data = (await res.json().catch(() => ({}))) as {
        status?: string;
        slug?: string;
        message?: string;
        error?: string;
      };

      if (!res.ok) {
        setState({ phase: "error", message: data.error ?? "Submission failed. Try again." });
        return;
      }

      setState({
        phase: "success",
        message: data.message ?? "Submitted!",
        slug: data.slug,
      });
      setUrl("");
    } catch {
      setState({ phase: "error", message: "Network error — check your connection and try again." });
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="yt-url" className="mb-1 block text-sm font-semibold text-neutral-300">
          YouTube link
        </label>
        <input
          id="yt-url"
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          className="w-full rounded border border-surface-border bg-surface px-3 py-2.5 text-sm outline-none placeholder:text-neutral-600 focus:border-brand"
        />
        <p className="mt-1 text-xs text-neutral-500">
          Any youtube.com, youtu.be, or Shorts link works.
        </p>
      </div>

      <div>
        <label htmlFor="yt-category" className="mb-1 block text-sm font-semibold text-neutral-300">
          Category <span className="font-normal text-neutral-500">(optional)</span>
        </label>
        <select
          id="yt-category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full rounded border border-surface-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand"
        >
          <option value="">Pick one…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={state.phase === "submitting"}
        className="w-full rounded bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-dark disabled:opacity-60 sm:w-auto sm:px-8"
      >
        {state.phase === "submitting" ? "Checking with YouTube…" : "Submit Video"}
      </button>

      {state.phase === "success" && (
        <div className="rounded border border-green-800 bg-green-950/40 px-4 py-3 text-sm text-green-300">
          {state.message}{" "}
          {state.slug && (
            <Link href={`/watch/${state.slug}`} className="font-semibold underline">
              Watch it here →
            </Link>
          )}
        </div>
      )}
      {state.phase === "error" && (
        <div className="rounded border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {state.message}
        </div>
      )}
    </form>
  );
}
