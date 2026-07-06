"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { CommentDto, CommentPageDto, SessionUserDto } from "@/lib/types";

// ---------------------------------------------------------------------------
// Watch-page comments. The page itself stays ISR; everything session- or
// time-sensitive (who am I, the comment list) loads client-side.
// ---------------------------------------------------------------------------

function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

function Avatar({ username, avatarUrl }: { username: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-raised text-sm font-bold uppercase text-neutral-400">
      {username.slice(0, 1)}
    </span>
  );
}

function CommentForm({
  videoId,
  parentId,
  placeholder,
  autoFocus,
  onPosted,
}: {
  videoId: string;
  parentId?: string;
  placeholder: string;
  autoFocus?: boolean;
  onPosted: (comment: CommentDto, parentId: string | null) => void;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/videos/${videoId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, ...(parentId ? { parentId } : {}) }),
        signal: AbortSignal.timeout(15_000),
      });
      const data = (await res.json().catch(() => ({}))) as {
        comment?: CommentDto;
        parentId?: string | null;
        error?: string;
      };
      if (!res.ok || !data.comment) {
        setError(data.error ?? "Couldn't post that. Try again.");
        return;
      }
      setBody("");
      onPosted(data.comment, data.parentId ?? null);
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        rows={parentId ? 2 : 3}
        maxLength={2000}
        autoFocus={autoFocus}
        className="w-full resize-y rounded border border-surface-border bg-surface px-3 py-2.5 text-sm outline-none placeholder:text-neutral-600 focus:border-brand"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy || !body.trim()}
          className="rounded bg-brand px-4 py-1.5 text-sm font-bold text-white transition hover:bg-brand-dark disabled:opacity-60"
        >
          {busy ? "Posting…" : parentId ? "Reply" : "Comment"}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </form>
  );
}

function CommentItem({
  comment,
  videoId,
  user,
  onPosted,
}: {
  comment: CommentDto;
  videoId: string;
  user: SessionUserDto | null;
  onPosted: (c: CommentDto, parentId: string | null) => void;
}) {
  const [replying, setReplying] = useState(false);

  return (
    <li className="flex gap-3">
      <Avatar username={comment.author.username} avatarUrl={comment.author.avatarUrl} />
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="font-semibold">{comment.author.username}</span>{" "}
          <span className="text-xs text-neutral-500">{timeAgo(comment.createdAt)}</span>
        </p>
        <p className="mt-0.5 whitespace-pre-line break-words text-sm text-neutral-200">
          {comment.body}
        </p>
        {user && comment.replies && (
          <button
            type="button"
            onClick={() => setReplying((v) => !v)}
            className="mt-1 text-xs font-semibold text-neutral-400 hover:text-white"
          >
            {replying ? "Cancel" : "Reply"}
          </button>
        )}
        {replying && (
          <div className="mt-2">
            <CommentForm
              videoId={videoId}
              parentId={comment.id}
              placeholder={`Reply to ${comment.author.username}…`}
              autoFocus
              onPosted={(c, parentId) => {
                setReplying(false);
                onPosted(c, parentId);
              }}
            />
          </div>
        )}
        {comment.replies && comment.replies.length > 0 && (
          <ul className="mt-3 space-y-3 border-l border-surface-border pl-4">
            {comment.replies.map((r) => (
              <CommentItem key={r.id} comment={r} videoId={videoId} user={user} onPosted={onPosted} />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

export default function CommentsSection({
  videoId,
  slug,
  initialCount,
}: {
  videoId: string;
  slug: string;
  initialCount: number;
}) {
  const [user, setUser] = useState<SessionUserDto | null>(null);
  const [items, setItems] = useState<CommentDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(initialCount);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [loadingMore, setLoadingMore] = useState(false);

  const loadPage = useCallback(
    async (cursor: string | null) => {
      const url = cursor
        ? `/api/videos/${videoId}/comments?cursor=${encodeURIComponent(cursor)}`
        : `/api/videos/${videoId}/comments`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`comments fetch failed: ${res.status}`);
      return (await res.json()) as CommentPageDto;
    },
    [videoId],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [me, page] = await Promise.all([
          fetch("/api/auth/me", { signal: AbortSignal.timeout(15_000) })
            .then((r) => (r.ok ? r.json() : { user: null }))
            .catch(() => ({ user: null })) as Promise<{ user: SessionUserDto | null }>,
          loadPage(null),
        ]);
        if (cancelled) return;
        setUser(me.user);
        setItems(page.items);
        setNextCursor(page.nextCursor);
        setTotalCount(page.totalCount);
        setPhase("ready");
      } catch {
        if (!cancelled) setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPage]);

  async function onLoadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await loadPage(nextCursor);
      setItems((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
      setTotalCount(page.totalCount);
    } catch {
      // keep the button; the user can retry
    } finally {
      setLoadingMore(false);
    }
  }

  function onPosted(comment: CommentDto, parentId: string | null) {
    setTotalCount((n) => n + 1);
    if (!parentId) {
      setItems((prev) => [{ ...comment, replies: [] }, ...prev]);
      return;
    }
    setItems((prev) =>
      prev.map((c) =>
        c.id === parentId ? { ...c, replies: [...(c.replies ?? []), comment] } : c,
      ),
    );
  }

  const signInHref = `/login?next=${encodeURIComponent(`/watch/${slug}`)}`;

  return (
    <section className="mt-6" id="comments">
      <h2 className="text-base font-bold">
        {totalCount.toLocaleString()} {totalCount === 1 ? "Comment" : "Comments"}
      </h2>

      <div className="mt-3">
        {user ? (
          <CommentForm
            videoId={videoId}
            placeholder={`Comment as ${user.username}…`}
            onPosted={onPosted}
          />
        ) : (
          <p className="rounded border border-surface-border bg-surface-raised px-4 py-3 text-sm text-neutral-400">
            <Link href={signInHref} className="font-semibold text-brand hover:underline">
              Sign in
            </Link>{" "}
            to join the conversation.
          </p>
        )}
      </div>

      {phase === "loading" && (
        <p className="mt-4 text-sm text-neutral-500">Loading comments…</p>
      )}
      {phase === "error" && (
        <p className="mt-4 text-sm text-neutral-500">Comments couldn&apos;t load. Refresh to retry.</p>
      )}
      {phase === "ready" && items.length === 0 && (
        <p className="mt-4 text-sm text-neutral-500">No comments yet. Start the conversation.</p>
      )}

      <ul className="mt-4 space-y-5">
        {items.map((c) => (
          <CommentItem key={c.id} comment={c} videoId={videoId} user={user} onPosted={onPosted} />
        ))}
      </ul>

      {nextCursor && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loadingMore}
          className="mt-5 w-full rounded border border-surface-border bg-surface-raised px-4 py-2 text-sm font-semibold text-neutral-300 transition hover:text-white disabled:opacity-60"
        >
          {loadingMore ? "Loading…" : "Load more comments"}
        </button>
      )}
    </section>
  );
}
