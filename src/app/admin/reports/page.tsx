import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { REPORT_SLA_HOURS, reportQueue } from "@/lib/techblob";
import ResolveButtons from "./resolve-buttons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Report queue" };

const STATE_LABEL = { overdue: "Overdue", due_soon: "Due soon", on_time: "On time", resolved: "Resolved" } as const;

/** Staff only: open reports, most urgent first, each with the time left on its 24-hour review. */
export default async function ReportQueuePage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) notFound();
  const rows = await prisma.report.findMany({
    where: { resolvedAt: null },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: { id: true, reason: true, details: true, videoId: true, commentId: true, createdAt: true, resolvedAt: true, video: { select: { title: true, slug: true } } },
  });
  const queue = reportQueue(rows);
  return (
    <main className="mx-auto max-w-4xl px-3 py-8 sm:px-4">
      <h1 className="text-2xl font-black">Report queue</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Every report is reviewed within {REPORT_SLA_HOURS} hours. {queue.filter((r) => r.state === "overdue").length} overdue, {queue.length} open.
      </p>
      <ul className="mt-4 space-y-3">
        {queue.length === 0 ? <li className="text-sm text-neutral-400">No open reports.</li> : null}
        {queue.map((r) => (
          <li key={r.id} className="rounded border border-surface-border p-3 text-sm">
            <p>
              <span className={r.state === "overdue" ? "font-bold text-red-400" : r.state === "due_soon" ? "font-bold text-amber-300" : "text-neutral-300"}>
                {STATE_LABEL[r.state]}
              </span>{" "}
              · {r.minutesLeft >= 0 ? `${Math.floor(r.minutesLeft / 60)}h ${r.minutesLeft % 60}m left` : `${Math.ceil(-r.minutesLeft / 60)}h late`} · {r.reason}
            </p>
            <p className="text-neutral-400">
              {r.commentId ? "Comment on " : "Video "}
              {r.video ? <a href={`/watch/${r.video.slug}`} className="underline">{r.video.title}</a> : "(removed)"}
              {r.details ? ` · "${r.details}"` : ""}
            </p>
            <ResolveButtons id={r.id} />
          </li>
        ))}
      </ul>
    </main>
  );
}
