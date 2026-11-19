// Ad slots. With no outside advertiser booked, each slot shows a Kavaro house-ad card (one of Kavaro's ten apps),
// labeled as Kavaro's own. Sizes mirror standard IAB units so a real ad unit can replace the card later.
import { HOUSE_AD_LABEL, pickHouseAd } from "@/lib/techblob";

const SLOT_SIZES: Record<string, { w: number; h: number }> = {
  leaderboard: { w: 728, h: 90 },
  mobileBanner: { w: 320, h: 100 },
  mediumRectangle: { w: 300, h: 250 },
  halfPage: { w: 300, h: 600 },
  inFeed: { w: 0, h: 0 },
};

interface AdBannerProps {
  slot: keyof typeof SLOT_SIZES;
  className?: string;
}

export default function AdBanner({ slot, className = "" }: AdBannerProps) {
  const size = SLOT_SIZES[slot] ?? SLOT_SIZES.mediumRectangle!;
  const ad = pickHouseAd(`${slot}:${new Date().toISOString().slice(0, 10)}`);
  return (
    <a
      href={ad.url}
      target="_blank"
      rel="noopener noreferrer"
      data-ad-slot={slot}
      data-house-ad={ad.app}
      aria-label={`${ad.app}: ${ad.pitch} (${HOUSE_AD_LABEL})`}
      className={`flex items-center justify-center overflow-hidden rounded border border-surface-border bg-surface-raised hover:border-brand ${className}`}
      style={slot === "inFeed" ? { minHeight: "8rem" } : { maxWidth: size.w, minHeight: Math.min(size.h, 250), margin: "0 auto", width: "100%" }}
    >
      <div className="p-4 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">{HOUSE_AD_LABEL}</p>
        <p className="mt-1 text-sm font-black text-white">{ad.app}</p>
        <p className="mt-0.5 text-xs text-neutral-300">{ad.pitch}</p>
      </div>
    </a>
  );
}
