"use client";

import { useState } from "react";
import { REPORT_REASONS } from "@/lib/techblob";

/** Report a video or a comment. Staff review every report within 24 hours. */
export default function ReportButton({ videoId, commentId }: { videoId?: string; commentId?: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "signin" | "error">("idle");
  const [message, setMessage] = useState("");

  async function send() {
    setState("sending");
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId, commentId, reason }),
    }).catch(() => null);
    if (res?.status === 401) return setState("signin");
    const data = (await res?.json().catch(() => ({}))) as { message?: string; error?: string };
    if (res?.ok) {
      setState("sent");
      setMessage(data.message ?? "Thanks. We review every report within 24 hours.");
    } else {
      setState("error");
      setMessage(data.error ?? "Couldn't send the report.");
    }
  }

  if (state === "sent") return <span className="text-xs text-neutral-400">{message}</span>;
  if (state === "signin") {
    return (
      <a href="/login" className="text-xs font-semibold text-brand underline">
        Sign in to report
      </a>
    );
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-semibold text-neutral-400 hover:text-white">
        Report
      </button>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-xs">
      <label className="sr-only" htmlFor={`reason-${videoId ?? commentId}`}>
        Reason
      </label>
      <select id={`reason-${videoId ?? commentId}`} value={reason} onChange={(e) => setReason(e.target.value)} className="rounded bg-surface-raised px-2 py-1 text-neutral-200">
        {REPORT_REASONS.map((r) => (
          <option key={r}>{r}</option>
        ))}
      </select>
      <button type="button" disabled={state === "sending"} onClick={send} className="rounded bg-brand px-2 py-1 font-bold text-white">
        {state === "sending" ? "Sending…" : "Send report"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-neutral-400">
        Cancel
      </button>
      {state === "error" ? <span className="text-red-400">{message}</span> : null}
    </span>
  );
}
