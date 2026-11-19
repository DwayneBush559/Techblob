"use client";

import { useState } from "react";

export default function ResolveButtons({ id }: { id: string }) {
  const [done, setDone] = useState<string | null>(null);
  async function act(action: "remove" | "keep") {
    const res = await fetch(`/api/reports/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    setDone(res.ok ? (action === "remove" ? "Removed" : "Kept") : "Failed");
  }
  if (done) return <p className="mt-2 text-xs text-neutral-400">{done}</p>;
  return (
    <div className="mt-2 flex gap-2">
      <button type="button" onClick={() => act("remove")} className="rounded bg-red-700 px-3 py-1 text-xs font-bold text-white">Remove</button>
      <button type="button" onClick={() => act("keep")} className="rounded border border-surface-border px-3 py-1 text-xs font-bold">Keep</button>
    </div>
  );
}
