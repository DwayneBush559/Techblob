// TechBlob's product rules (PRD-023): the four tech categories, Kavaro house-ad cards, sponsored premiere slots and
// the 24-hour report queue. Pure functions, so the pages, the API and the tests share one copy.

export const TECH_CATEGORIES = [
  { slug: "ai-fails", name: "AI Fails" },
  { slug: "terminal-speedruns", name: "Terminal Speedruns" },
  { slug: "tool-premieres", name: "Tool Premieres" },
  { slug: "builder-breakdowns", name: "Builder Breakdowns" },
] as const;

export interface HouseAd {
  app: string;
  pitch: string;
  url: string;
}

/**
 * Cross-promotion cards for Kavaro's own apps, shown in TechBlob's ad slots while no outside advertiser is booked.
 * One line each, taken from the portfolio's product definitions; every card links to the company site and is
 * labeled as Kavaro's own.
 */
export const HOUSE_ADS: HouseAd[] = [
  { app: "DateProper", pitch: "Video-first dating that ends in a real date plan.", url: "https://www.kavarollc.com/" },
  { app: "RoadRite", pitch: "Mobile detailing, window tint and roadside help from local pros.", url: "https://www.kavarollc.com/" },
  { app: "PIM", pitch: "Creative production help: green-screen editing, shooters and camera-friendly venues.", url: "https://www.kavarollc.com/" },
  { app: "Handled", pitch: "Post a job and get bids from local pros.", url: "https://www.kavarollc.com/" },
  { app: "HerTier", pitch: "Find beauty pros by their real work and book again in a tap.", url: "https://www.kavarollc.com/" },
  { app: "Stream Echo", pitch: "Send your live stream to more places at once, from your desktop.", url: "https://www.kavarollc.com/" },
  { app: "SnapSort AI", pitch: "Sort your screenshots and saved videos on your phone, privately.", url: "https://www.kavarollc.com/" },
  { app: "Business Copilot", pitch: "Build business credit and find grants, step by step.", url: "https://www.kavarollc.com/" },
  { app: "ScholarPilot", pitch: "Find scholarships you qualify for and track every deadline.", url: "https://www.kavarollc.com/" },
  { app: "Method AI", pitch: "Verified methods and skills you can put to work.", url: "https://www.kavarollc.com/" },
];

export const HOUSE_AD_LABEL = "From Kavaro LLC, the company behind TechBlob";

/** A stable card per slot and page that still rotates across the ten apps: same key, same card. */
export function pickHouseAd(key: string): HouseAd {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return HOUSE_ADS[(h >>> 0) % HOUSE_ADS.length] ?? HOUSE_ADS[0]!;
}

export interface PremiereSlot {
  startsAt: string;
  label: "Sponsored premiere";
  booked: boolean;
}

/**
 * Weekly sponsored premiere slots in Tool Premieres, from `startIso` for `weeks` weeks, one per week at the same
 * weekday and time. Every slot carries the "Sponsored premiere" label viewers see; pricing is the founder's to set,
 * so none is computed here.
 */
export function planPremiereSlots(startIso: string, weeks: number, bookedIso: string[] = []): PremiereSlot[] {
  const start = Date.parse(startIso);
  if (!Number.isFinite(start) || !Number.isInteger(weeks) || weeks < 1 || weeks > 52) throw new Error("Give a start time and 1 to 52 weeks.");
  const taken = new Set(bookedIso.map((d) => new Date(d).toISOString()));
  return Array.from({ length: weeks }, (_, i) => {
    const startsAt = new Date(start + i * 7 * 86_400_000).toISOString();
    return { startsAt, label: "Sponsored premiere" as const, booked: taken.has(startsAt) };
  });
}

export const REPORT_SLA_HOURS = 24;
export const REPORT_REASONS = ["Spam or scam", "Harassment or hate", "Violence or threats", "Sexual content", "Copyright (use the DMCA page)", "Something else"] as const;

export interface ReportRow {
  id: string;
  createdAt: Date;
  resolvedAt: Date | null;
}

/** Time left on a report's 24-hour review, and whether it is overdue or due within 4 hours. */
export function reportSla(r: ReportRow, now = new Date()): { dueAt: Date; minutesLeft: number; state: "resolved" | "overdue" | "due_soon" | "on_time" } {
  const dueAt = new Date(r.createdAt.getTime() + REPORT_SLA_HOURS * 3_600_000);
  const minutesLeft = Math.round((dueAt.getTime() - now.getTime()) / 60_000);
  const state = r.resolvedAt ? "resolved" : minutesLeft < 0 ? "overdue" : minutesLeft <= 240 ? "due_soon" : "on_time";
  return { dueAt, minutesLeft, state };
}

/** The open queue, most urgent first. */
export function reportQueue<T extends ReportRow>(rows: T[], now = new Date()): (T & ReturnType<typeof reportSla>)[] {
  return rows
    .filter((r) => !r.resolvedAt)
    .map((r) => ({ ...r, ...reportSla(r, now) }))
    .sort((a, b) => a.minutesLeft - b.minutesLeft);
}
