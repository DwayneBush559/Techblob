/**
 * Standalone view-flush worker for long-lived deployments (ECS, Fly, VPS).
 * Runs the same flushViewsToPostgres() the cron route uses, on a loop.
 *
 *   npm run views:flush
 *
 * On serverless (Vercel), skip this and use the /api/cron/flush-views route
 * with Vercel Cron instead — both paths share the Redis lock, so running
 * both by accident is still safe.
 */
import { flushViewsToPostgres } from "../src/lib/views";

const INTERVAL_MS = 30_000;
let shuttingDown = false;

async function loop(): Promise<void> {
  while (!shuttingDown) {
    const startedAt = Date.now();
    try {
      const result = await flushViewsToPostgres();
      if (!result.skipped && (result.viewsFlushed > 0 || result.logsInserted > 0)) {
        console.log(
          `[flush] ${result.viewsFlushed} views -> ${result.videosUpdated} videos, ` +
            `${result.logsInserted} log rows, ${Date.now() - startedAt}ms`,
        );
      }
    } catch (err) {
      console.error("[flush] cycle failed", err);
    }
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
}

process.on("SIGTERM", () => {
  shuttingDown = true;
});
process.on("SIGINT", () => {
  shuttingDown = true;
});

loop()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
