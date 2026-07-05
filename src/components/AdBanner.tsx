// Display-ad placeholder slots. In production each slot mounts a GPT
// (Google Publisher Tag) or Prebid unit keyed by `slot`; sizes here mirror
// standard IAB units so the swap is a drop-in.

const SLOT_SIZES: Record<string, { w: number; h: number; label: string }> = {
  leaderboard: { w: 728, h: 90, label: "728×90 Leaderboard" },
  mobileBanner: { w: 320, h: 100, label: "320×100 Mobile Banner" },
  mediumRectangle: { w: 300, h: 250, label: "300×250 MPU" },
  halfPage: { w: 300, h: 600, label: "300×600 Half Page" },
  inFeed: { w: 0, h: 0, label: "Native In-Feed" },
};

interface AdBannerProps {
  slot: keyof typeof SLOT_SIZES;
  className?: string;
}

export default function AdBanner({ slot, className = "" }: AdBannerProps) {
  const size = SLOT_SIZES[slot] ?? SLOT_SIZES.mediumRectangle!;

  return (
    <div
      data-ad-slot={slot}
      aria-label="Advertisement"
      className={`flex items-center justify-center overflow-hidden rounded border border-dashed border-surface-border bg-surface-raised ${className}`}
      style={
        slot === "inFeed"
          ? { minHeight: "10rem" }
          : { maxWidth: size.w, minHeight: Math.min(size.h, 250), margin: "0 auto", width: "100%" }
      }
    >
      <div className="p-4 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
          Advertisement
        </p>
        <p className="mt-1 text-xs text-neutral-600">{size.label}</p>
      </div>
    </div>
  );
}
