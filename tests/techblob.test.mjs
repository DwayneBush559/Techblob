import { test } from "node:test";
import assert from "node:assert/strict";
import { HOUSE_ADS, HOUSE_AD_LABEL, pickHouseAd, planPremiereSlots, REPORT_SLA_HOURS, reportQueue, reportSla, TECH_CATEGORIES } from "../src/lib/techblob.ts";
import { selectPrerollAd } from "../src/lib/ads.ts";
import { PreviewRedis } from "../src/lib/preview-redis.ts";

test("the four PRD-023 categories", () => {
  assert.deepEqual(
    TECH_CATEGORIES.map((c) => c.name),
    ["AI Fails", "Terminal Speedruns", "Tool Premieres", "Builder Breakdowns"],
  );
});

test("house-ad cards: Kavaro's ten apps, labeled, https, and a stable pick per slot", () => {
  assert.deepEqual(
    HOUSE_ADS.map((a) => a.app),
    ["DateProper", "RoadRite", "PIM", "Handled", "HerTier", "Stream Echo", "SnapSort AI", "Business Copilot", "ScholarPilot", "Method AI"],
  );
  for (const a of HOUSE_ADS) {
    assert.ok(a.url.startsWith("https://www.kavarollc.com/"), a.app);
    assert.ok(a.pitch.length > 10 && a.pitch.length < 100, a.app);
  }
  assert.match(HOUSE_AD_LABEL, /Kavaro LLC/);
  assert.equal(pickHouseAd("leaderboard:2026-11-19").app, pickHouseAd("leaderboard:2026-11-19").app);
  const seen = new Set(Array.from({ length: 60 }, (_, i) => pickHouseAd(`slot:${i}`).app));
  assert.ok(seen.size >= 8, `rotation reaches ${seen.size} apps`);
});

test("no made-up pre-roll advertisers: nothing plays until a campaign is booked", () => {
  assert.equal(selectPrerollAd("cvideo123"), null);
  const booked = [{ id: "a", advertiser: "Real Co", mediaUrl: "https://cdn.example/a.mp4", clickThroughUrl: "https://example.com", skippableAfterSec: 5, durationSec: 10 }];
  assert.equal(selectPrerollAd("cvideo123", booked)?.advertiser, "Real Co");
});

test("sponsored premiere slots: weekly, labeled, booked ones marked, no price computed", () => {
  const slots = planPremiereSlots("2026-12-01T18:00:00.000Z", 3, ["2026-12-08T18:00:00.000Z"]);
  assert.deepEqual(
    slots.map((s) => s.startsAt),
    ["2026-12-01T18:00:00.000Z", "2026-12-08T18:00:00.000Z", "2026-12-15T18:00:00.000Z"],
  );
  assert.ok(slots.every((s) => s.label === "Sponsored premiere"));
  assert.deepEqual(slots.map((s) => s.booked), [false, true, false]);
  assert.ok(slots.every((s) => !("price" in s)));
  assert.throws(() => planPremiereSlots("nope", 3));
  assert.throws(() => planPremiereSlots("2026-12-01T18:00:00.000Z", 0));
});

test("reports: 24-hour review, overdue and due-soon flagged, most urgent first", () => {
  assert.equal(REPORT_SLA_HOURS, 24);
  const now = new Date("2026-11-19T12:00:00Z");
  const h = (n) => new Date(now.getTime() - n * 3_600_000);
  assert.equal(reportSla({ id: "a", createdAt: h(25), resolvedAt: null }, now).state, "overdue");
  assert.equal(reportSla({ id: "b", createdAt: h(21), resolvedAt: null }, now).state, "due_soon");
  assert.equal(reportSla({ id: "c", createdAt: h(1), resolvedAt: null }, now).state, "on_time");
  assert.equal(reportSla({ id: "d", createdAt: h(30), resolvedAt: now }, now).state, "resolved");
  const q = reportQueue(
    [
      { id: "c", createdAt: h(1), resolvedAt: null },
      { id: "a", createdAt: h(25), resolvedAt: null },
      { id: "d", createdAt: h(30), resolvedAt: now },
    ],
    now,
  );
  assert.deepEqual(q.map((r) => r.id), ["a", "c"]);
  assert.equal(q[0].minutesLeft, -60);
});

test("the preview's in-memory Redis answers like ioredis for the commands TechBlob uses", async () => {
  const r = new PreviewRedis();
  assert.equal(await r.set("lock", "1", "EX", 30, "NX"), "OK");
  assert.equal(await r.set("lock", "1", "EX", 30, "NX"), null);
  const res = await r.multi().hincrby("views:pending", "v1", 1).incr("live:v1").expire("live:v1", 60).lpush("logs", "x").exec();
  assert.deepEqual(res, [[null, 1], [null, 1], [null, 1], [null, 1]]);
  assert.deepEqual(await r.hgetall("views:pending"), { v1: "1" });
  await r.rename("views:pending", "views:flushing");
  await assert.rejects(() => r.rename("views:pending", "x"), /no such key/);
  await r.lpush("logs", "y", "z");
  assert.deepEqual(await r.lpop("logs", 2), ["z", "y"]);
  assert.equal(await r.incr("n"), 1);
});
