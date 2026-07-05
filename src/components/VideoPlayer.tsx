"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { VideoSourceDto, ViewEvent } from "@/lib/types";

// ---------------------------------------------------------------------------
// Custom HTML5 player with:
//  * simulated pre-roll ad phase (countdown, skip button, click-through)
//  * view analytics: "start" on first content play, milestones at 25/50/75%,
//    100% on ended — each fired exactly once per mount, final state flushed
//    with sendBeacon on pagehide so abandons still report
//  * custom controls: play/pause, seek + buffered bar, volume/mute, quality
//    selector (resumes position), fullscreen, keyboard shortcuts
// ---------------------------------------------------------------------------

interface PrerollAd {
  id: string;
  advertiser: string;
  mediaUrl: string;
  clickThroughUrl: string;
  skippableAfterSec: number;
  durationSec: number;
}

interface VideoPlayerProps {
  videoId: string;
  title: string;
  poster?: string | null;
  sources: VideoSourceDto[];
  autoPlay?: boolean;
}

type Phase = "idle" | "ad" | "content";

const MILESTONES = [25, 50, 75] as const;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

/** Beacon-first delivery: survives navigation, never throws. */
function sendViewEvent(videoId: string, event: ViewEvent): void {
  const url = `/api/videos/${videoId}/view`;
  const payload = JSON.stringify({ event });
  try {
    if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      const ok = navigator.sendBeacon(url, new Blob([payload], { type: "text/plain" }));
      if (ok) return;
    }
    void fetch(url, {
      method: "POST",
      body: payload,
      headers: { "Content-Type": "application/json" },
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Analytics must never break playback.
  }
}

export default function VideoPlayer({
  videoId,
  title,
  poster,
  sources,
  autoPlay = false,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [ad, setAd] = useState<PrerollAd | null>(null);
  const [adSecondsLeft, setAdSecondsLeft] = useState(0);
  const [adSkippableIn, setAdSkippableIn] = useState(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Quality: default to highest available.
  const sortedSources = useMemo(
    () => [...sources].sort((a, b) => b.bitrateKbps - a.bitrateKbps),
    [sources],
  );
  const [activeSource, setActiveSource] = useState<VideoSourceDto | null>(
    sortedSources[0] ?? null,
  );
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false);
  const resumeTimeRef = useRef(0);
  const resumePlayingRef = useRef(false);

  // Analytics fire-once guards
  const firedRef = useRef<Set<ViewEvent>>(new Set());
  const furthestPctRef = useRef(0);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fireOnce = useCallback(
    (event: ViewEvent) => {
      if (firedRef.current.has(event)) return;
      firedRef.current.add(event);
      sendViewEvent(videoId, event);
    },
    [videoId],
  );

  // -------------------------------------------------------------------------
  // Ad fetch: happens on first user intent to play (not on mount) so the
  // homepage can render hundreds of players cheaply.
  // -------------------------------------------------------------------------
  const startPlayback = useCallback(async () => {
    if (phase !== "idle") return;
    setError(null);

    let fetchedAd: PrerollAd | null = null;
    try {
      const res = await fetch(`/api/ads/preroll?videoId=${videoId}`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = (await res.json()) as { ad: PrerollAd | null };
        fetchedAd = data.ad;
      }
    } catch {
      // Ad server slow/down → go straight to content. Never block the video.
    }

    if (fetchedAd) {
      setAd(fetchedAd);
      setAdSecondsLeft(fetchedAd.durationSec);
      setAdSkippableIn(fetchedAd.skippableAfterSec);
      setPhase("ad");
    } else {
      setPhase("content");
    }
  }, [phase, videoId]);

  useEffect(() => {
    if (autoPlay) void startPlayback();
  }, [autoPlay, startPlayback]);

  // When the phase changes, (re)load the <video> element's source and play.
  useEffect(() => {
    const el = videoRef.current;
    if (!el || phase === "idle") return;

    if (phase === "ad" && ad) {
      el.src = ad.mediaUrl;
      el.currentTime = 0;
    } else if (phase === "content" && activeSource) {
      el.src = activeSource.url;
      if (resumeTimeRef.current > 0) {
        el.currentTime = resumeTimeRef.current;
        resumeTimeRef.current = 0;
      }
    }

    el.play().catch(() => {
      // Autoplay blocked (mobile without gesture) — surface the play button.
      setIsPlaying(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, ad, activeSource]);

  const endAd = useCallback(() => {
    setAd(null);
    setPhase("content");
  }, []);

  const skipAd = useCallback(() => {
    if (adSkippableIn <= 0) endAd();
  }, [adSkippableIn, endAd]);

  // -------------------------------------------------------------------------
  // <video> event wiring
  // -------------------------------------------------------------------------
  const onTimeUpdate = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;

    if (phase === "ad") {
      const remaining = Math.max(0, Math.ceil((ad?.durationSec ?? el.duration) - el.currentTime));
      setAdSecondsLeft(remaining);
      setAdSkippableIn(Math.max(0, Math.ceil((ad?.skippableAfterSec ?? 0) - el.currentTime)));
      return;
    }

    setCurrentTime(el.currentTime);
    if (el.buffered.length > 0) {
      setBuffered(el.buffered.end(el.buffered.length - 1));
    }

    // Milestone tracking (content only)
    if (el.duration > 0) {
      const pct = (el.currentTime / el.duration) * 100;
      for (const m of MILESTONES) {
        if (pct >= m) {
          furthestPctRef.current = Math.max(furthestPctRef.current, m);
          fireOnce(`milestone_${m}` as ViewEvent);
        }
      }
    }
  }, [phase, ad, fireOnce]);

  const onEnded = useCallback(() => {
    if (phase === "ad") {
      endAd();
      return;
    }
    furthestPctRef.current = 100;
    fireOnce("milestone_100");
    setIsPlaying(false);
  }, [phase, endAd, fireOnce]);

  const onPlay = useCallback(() => {
    setIsPlaying(true);
    if (phase === "content") fireOnce("start");
  }, [phase, fireOnce]);

  const onMediaError = useCallback(() => {
    if (phase === "ad") {
      // Broken ad creative must never block content.
      endAd();
      return;
    }
    setError("Playback failed. Check your connection and try again.");
    setIsPlaying(false);
  }, [phase, endAd]);

  // Flush furthest progress when the tab is hidden/closed mid-watch.
  useEffect(() => {
    const flush = () => {
      const pct = furthestPctRef.current;
      if (pct >= 25) fireOnce(`milestone_${pct}` as ViewEvent);
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [fireOnce]);

  // -------------------------------------------------------------------------
  // Controls
  // -------------------------------------------------------------------------
  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (phase === "idle") {
      void startPlayback();
      return;
    }
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  }, [phase, startPlayback]);

  const seekTo = useCallback(
    (time: number) => {
      const el = videoRef.current;
      if (!el || phase !== "content") return; // seeking disabled during ads
      el.currentTime = Math.min(Math.max(time, 0), el.duration || 0);
    },
    [phase],
  );

  const changeVolume = useCallback((v: number) => {
    const el = videoRef.current;
    if (!el) return;
    const clamped = Math.min(Math.max(v, 0), 1);
    el.volume = clamped;
    el.muted = clamped === 0;
    setVolume(clamped);
    setIsMuted(clamped === 0);
  }, []);

  const toggleMute = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setIsMuted(el.muted);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await container.requestFullscreen();
      }
    } catch {
      // iOS Safari: fall back to the native video fullscreen API.
      const el = videoRef.current as (HTMLVideoElement & {
        webkitEnterFullscreen?: () => void;
      }) | null;
      el?.webkitEnterFullscreen?.();
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const changeQuality = useCallback(
    (source: VideoSourceDto) => {
      const el = videoRef.current;
      setQualityMenuOpen(false);
      if (!el || source.url === activeSource?.url) return;
      resumeTimeRef.current = el.currentTime;
      resumePlayingRef.current = !el.paused;
      setActiveSource(source);
    },
    [activeSource],
  );

  // Keyboard shortcuts (content phase only, when the player has focus)
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const el = videoRef.current;
      if (!el) return;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowRight":
          seekTo(el.currentTime + 10);
          break;
        case "ArrowLeft":
          seekTo(el.currentTime - 10);
          break;
        case "m":
          toggleMute();
          break;
        case "f":
          void toggleFullscreen();
          break;
      }
    },
    [togglePlay, seekTo, toggleMute, toggleFullscreen],
  );

  // Auto-hide controls during playback
  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setControlsVisible(false);
    }, 2500);
  }, []);

  useEffect(() => {
    return () => {
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    };
  }, []);

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={`Video player: ${title}`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseMove={showControls}
      onTouchStart={showControls}
      className="group relative aspect-video w-full overflow-hidden rounded-lg bg-black outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <video
        ref={videoRef}
        poster={poster ?? undefined}
        playsInline
        preload="metadata"
        className="h-full w-full"
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
        onPlay={onPlay}
        onPause={() => setIsPlaying(false)}
        onLoadedMetadata={() => {
          const el = videoRef.current;
          if (el && phase === "content") {
            setDuration(el.duration);
            if (resumePlayingRef.current) {
              resumePlayingRef.current = false;
              el.play().catch(() => {});
            }
          }
        }}
        onError={onMediaError}
        onClick={phase === "ad" ? undefined : togglePlay}
      />

      {/* ------------------------- Idle overlay ------------------------- */}
      {phase === "idle" && (
        <button
          type="button"
          onClick={() => void startPlayback()}
          aria-label={`Play ${title}`}
          className="absolute inset-0 flex items-center justify-center bg-black/40 transition hover:bg-black/30"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand text-white shadow-lg sm:h-20 sm:w-20">
            <svg viewBox="0 0 24 24" fill="currentColor" className="ml-1 h-8 w-8">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </button>
      )}

      {/* -------------------------- Ad overlay -------------------------- */}
      {phase === "ad" && ad && (
        <>
          <a
            href={ad.clickThroughUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="absolute inset-0"
            aria-label={`Advertisement by ${ad.advertiser} — opens in a new tab`}
          />
          <div className="pointer-events-none absolute left-3 top-3 rounded bg-black/70 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-yellow-400">
            Ad · {ad.advertiser} · {adSecondsLeft}s
          </div>
          <div className="absolute bottom-4 right-3">
            {adSkippableIn > 0 ? (
              <div className="rounded bg-black/70 px-3 py-2 text-sm text-white">
                Skip in {adSkippableIn}
              </div>
            ) : (
              <button
                type="button"
                onClick={skipAd}
                className="rounded bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-neutral-200"
              >
                Skip Ad ▸
              </button>
            )}
          </div>
        </>
      )}

      {/* ------------------------- Error overlay ------------------------ */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 px-6 text-center">
          <p className="text-sm text-neutral-200">{error}</p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              videoRef.current?.load();
              videoRef.current?.play().catch(() => {});
            }}
            className="rounded bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            Retry
          </button>
        </div>
      )}

      {/* ------------------------ Content controls ---------------------- */}
      {phase === "content" && !error && (
        <div
          className={`absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/90 to-transparent px-3 pb-2 pt-8 transition-opacity duration-200 ${
            controlsVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          {/* Seek bar */}
          <div
            role="slider"
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={Math.floor(duration)}
            aria-valuenow={Math.floor(currentTime)}
            tabIndex={0}
            className="relative h-4 cursor-pointer touch-none"
            onPointerDown={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = (e.clientX - rect.left) / rect.width;
              seekTo(ratio * duration);
            }}
          >
            <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded bg-white/20">
              <div
                className="absolute h-full rounded bg-white/40"
                style={{ width: `${bufferedPct}%` }}
              />
              <div
                className="absolute h-full rounded bg-brand"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div
              className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand"
              style={{ left: `${progressPct}%` }}
            />
          </div>

          <div className="flex items-center gap-3 text-white">
            <button type="button" onClick={togglePlay} aria-label={isPlaying ? "Pause" : "Play"}>
              {isPlaying ? (
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
                  <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            <button type="button" onClick={toggleMute} aria-label={isMuted ? "Unmute" : "Mute"}>
              {isMuted ? (
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M16.5 12l3-3-1.4-1.4-3 3-3-3L10.7 9l3 3-3 3 1.4 1.4 3-3 3 3 1.4-1.4-3-3zM3 9v6h4l5 5V4L7 9H3z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 00-2.5-4v8a4.5 4.5 0 002.5-4z" />
                </svg>
              )}
            </button>

            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              aria-label="Volume"
              className="hidden w-20 accent-brand sm:block"
            />

            <span className="text-xs tabular-nums text-neutral-300">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <div className="ml-auto flex items-center gap-3">
              {/* Quality selector */}
              {sortedSources.length > 1 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setQualityMenuOpen((o) => !o)}
                    aria-haspopup="menu"
                    aria-expanded={qualityMenuOpen}
                    className="rounded border border-white/30 px-2 py-0.5 text-xs font-semibold"
                  >
                    {activeSource?.label ?? "Auto"}
                  </button>
                  {qualityMenuOpen && (
                    <ul
                      role="menu"
                      className="absolute bottom-8 right-0 min-w-[5rem] overflow-hidden rounded bg-surface-raised text-xs shadow-xl"
                    >
                      {sortedSources.map((s) => (
                        <li key={s.resolution} role="none">
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => changeQuality(s)}
                            className={`block w-full px-3 py-2 text-left hover:bg-white/10 ${
                              s.url === activeSource?.url ? "text-brand" : "text-neutral-200"
                            }`}
                          >
                            {s.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => void toggleFullscreen()}
                aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  {isFullscreen ? (
                    <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
                  ) : (
                    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
