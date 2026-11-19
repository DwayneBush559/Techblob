"use client";

import Link from "next/link";
import { useState } from "react";

export default function AccountPage() {
  const [state, setState] = useState<"idle" | "deleting" | "error">("idle");
  const [message, setMessage] = useState("");

  async function del() {
    const typed = window.prompt("This deletes your account, comments, submissions, reports and blocks. It can't be undone. Type DELETE to confirm.");
    if (typed?.trim() !== "DELETE") return;
    setState("deleting");
    const res = await fetch("/api/account", { method: "DELETE" }).catch(() => null);
    if (res?.ok) {
      window.location.href = "/?deleted=1";
      return;
    }
    const data = (await res?.json().catch(() => ({}))) as { error?: string };
    setState("error");
    setMessage(res?.status === 401 ? "Sign in first." : data.error ?? "Couldn't delete the account.");
  }

  return (
    <main className="mx-auto max-w-2xl px-3 py-8 sm:px-4">
      <h1 className="text-2xl font-black">Account</h1>
      <div className="mt-4 space-y-4 text-sm text-neutral-300">
        <p>
          Read the <Link href="/legal/privacy" className="text-brand underline">Privacy Policy</Link>,{" "}
          <Link href="/legal/terms" className="text-brand underline">Terms</Link> and{" "}
          <Link href="/legal/dmca" className="text-brand underline">DMCA policy</Link>. Questions: info@kavarollc.com.
        </p>
        <section className="rounded border border-red-900/60 p-4">
          <h2 className="font-bold text-white">Delete account</h2>
          <p className="mt-1">Removes your account and everything tied to it right away, and signs you out.</p>
          <button type="button" onClick={del} disabled={state === "deleting"} className="mt-3 rounded bg-red-700 px-4 py-2 font-bold text-white hover:bg-red-600">
            {state === "deleting" ? "Deleting…" : "Delete account"}
          </button>
          {state === "error" ? <p className="mt-2 text-red-400">{message}</p> : null}
        </section>
      </div>
    </main>
  );
}
