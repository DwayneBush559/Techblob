"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

// Shared by /login and /signup. On success we hard-navigate (not router.push)
// so the header's session widget re-fetches with the new cookie.

const inputClass =
  "w-full rounded border border-surface-border bg-surface px-3 py-2.5 text-sm outline-none placeholder:text-neutral-600 focus:border-brand";

function safeNext(raw: string | null): string {
  // Only allow same-site relative paths — never absolute URLs.
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/";
}

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const next = safeNext(useSearchParams().get("next"));
  const [identifier, setIdentifier] = useState(""); // login: email or username
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "login" ? { identifier, password } : { email, username, password },
        ),
        signal: AbortSignal.timeout(15_000),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      window.location.assign(next);
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const switchHref = `${mode === "login" ? "/signup" : "/login"}?next=${encodeURIComponent(next)}`;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {mode === "login" ? (
        <div>
          <label htmlFor="auth-id" className="mb-1 block text-sm font-semibold text-neutral-300">
            Email or username
          </label>
          <input
            id="auth-id"
            required
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className={inputClass}
          />
        </div>
      ) : (
        <>
          <div>
            <label htmlFor="auth-email" className="mb-1 block text-sm font-semibold text-neutral-300">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="auth-username" className="mb-1 block text-sm font-semibold text-neutral-300">
              Username
            </label>
            <input
              id="auth-username"
              required
              autoComplete="username"
              pattern="[A-Za-z0-9_]{3,32}"
              title="3–32 letters, numbers, or underscores"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-neutral-500">3–32 letters, numbers, or underscores.</p>
          </div>
        </>
      )}

      <div>
        <label htmlFor="auth-password" className="mb-1 block text-sm font-semibold text-neutral-300">
          Password
        </label>
        <input
          id="auth-password"
          type="password"
          required
          minLength={mode === "signup" ? 8 : 1}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
        {mode === "signup" && (
          <p className="mt-1 text-xs text-neutral-500">At least 8 characters.</p>
        )}
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-dark disabled:opacity-60"
      >
        {busy
          ? mode === "login"
            ? "Signing in…"
            : "Creating account…"
          : mode === "login"
            ? "Sign In"
            : "Create Account"}
      </button>

      {error && (
        <div className="rounded border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <p className="text-sm text-neutral-400">
        {mode === "login" ? "New to Techblob? " : "Already have an account? "}
        <Link href={switchHref} className="font-semibold text-brand hover:underline">
          {mode === "login" ? "Create an account" : "Sign in"}
        </Link>
      </p>
    </form>
  );
}
