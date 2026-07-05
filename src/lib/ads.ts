// ---------------------------------------------------------------------------
// Simulated ad server. In production this is a VAST/VMAP call to an ad
// exchange; the player's contract (PrerollAd) stays the same either way.
// ---------------------------------------------------------------------------

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

const AD_POOL: PrerollAd[] = [
  {
    id: "ad_energy_01",
    advertiser: "Volt Energy",
    mediaUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    clickThroughUrl: "https://example.com/volt-energy",
    skippableAfterSec: 5,
    durationSec: 15,
  },
  {
    id: "ad_sneaker_02",
    advertiser: "Apex Kicks",
    mediaUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    clickThroughUrl: "https://example.com/apex-kicks",
    skippableAfterSec: 5,
    durationSec: 15,
  },
  {
    id: "ad_mobile_03",
    advertiser: "Nova Mobile",
    mediaUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
    clickThroughUrl: "https://example.com/nova-mobile",
    skippableAfterSec: 6,
    durationSec: 15,
  },
];

/**
 * Deterministic-ish rotation keyed on videoId + hour so the same video shows
 * a stable ad within the hour (cache-friendly) but rotates over time.
 */
export function selectPrerollAd(videoId: string): PrerollAd {
  const hourBucket = Math.floor(Date.now() / 3_600_000);
  let hash = 0;
  const seed = `${videoId}:${hourBucket}`;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const ad = AD_POOL[Math.abs(hash) % AD_POOL.length];
  if (!ad) throw new Error("Ad pool is empty");
  return ad;
}
