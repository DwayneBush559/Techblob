/**
 * Pre-roll ad decisions. No outside advertiser is booked, so no pre-roll plays and the player goes straight to the
 * video. (The earlier pool showed made-up brands with stock clips from an outside host.) TechBlob's display slots
 * carry Kavaro house-ad cards instead: see AdBanner and src/lib/techblob.ts. When a real campaign is signed, add it to
 * BOOKED (or swap this body for a VAST/VMAP call) without touching the player.
 */
export interface PrerollAd {
  id: string;
  advertiser: string;
  /** MP4 the player plays before the content */
  mediaUrl: string;
  /** Where a click on the ad navigates */
  clickThroughUrl: string;
  /** Seconds before the Skip button appears */
  skippableAfterSec: number;
  durationSec: number;
}

const BOOKED: PrerollAd[] = [];

/** Rotates booked campaigns by video and hour; null when nothing is booked. */
export function selectPrerollAd(videoId: string, booked: PrerollAd[] = BOOKED): PrerollAd | null {
  if (booked.length === 0) return null;
  const seed = `${videoId}:${Math.floor(Date.now() / 3_600_000)}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return booked[Math.abs(hash) % booked.length] ?? null;
}
