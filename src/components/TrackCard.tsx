"use client";

import React, { useRef, useCallback } from "react";
import type { ScoredTrack } from "@/lib/types";
import MetricBar from "./MetricBar";

interface TrackCardProps {
  track: ScoredTrack;
  index: number;
  playingId: string | null;
  onPreviewPlay: (trackId: string, previewUrl: string | null) => void;
}

// ── Image fallback when no album art is available
function AlbumArtFallback() {
  return (
    <div className="w-12 h-12 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center shrink-0">
      <svg className="w-5 h-5 text-stone-300" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
      </svg>
    </div>
  );
}

export default function TrackCard({
  track,
  index,
  playingId,
  onPreviewPlay,
}: TrackCardProps) {
  const isPlaying = playingId === track.id;
  const arcCircumference = 2 * Math.PI * 22;
  const arcOffset = arcCircumference - (track.matchPct / 100) * arcCircumference;

  const scoreColor =
    track.matchPct >= 85
      ? "text-terracotta"
      : track.matchPct >= 70
      ? "text-stone-600"
      : "text-stone-400";

  const handlePreviewClick = useCallback(() => {
    onPreviewPlay(track.id, track.previewUrl);
  }, [track.id, track.previewUrl, onPreviewPlay]);

  return (
    <div
      className="group bg-white/60 backdrop-blur-sm border border-stone-200 rounded-2xl p-4 hover:border-terracotta/40 hover:bg-white/80 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 animate-slide-up"
      style={{ animationDelay: `${index * 55}ms`, animationFillMode: "both" }}
    >
      <div className="flex items-start gap-3">
        {/* ── Score ring */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <span className="text-xs font-bold text-stone-400">#{index + 1}</span>
          <div className="relative w-14 h-14">
            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 52 52">
              <circle
                cx="26" cy="26" r="22"
                fill="none" stroke="#e7e5e4" strokeWidth="4"
              />
              <circle
                cx="26" cy="26" r="22"
                fill="none" stroke="#c96f53" strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={arcCircumference}
                strokeDashoffset={arcOffset}
                className="transition-all duration-1000 ease-out"
                style={{ transitionDelay: `${index * 70}ms` }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-xs font-bold leading-none ${scoreColor}`}>
                {track.matchPct}%
              </span>
            </div>
          </div>
        </div>

        {/* ── Info block */}
        <div className="flex-1 min-w-0">
          {/* Album art + title + BPM */}
          <div className="flex items-start gap-2.5 mb-3">
            {/* Album art */}
            {track.albumArt ? (
              <img
                src={track.albumArt}
                alt={track.title}
                width={48}
                height={48}
                className="rounded-lg object-cover shrink-0"
                loading="lazy"
              />
            ) : (
              <AlbumArtFallback />
            )}

            {/* Title + artist + BPM */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-1">
                <div className="min-w-0">
                  <h3 className="font-semibold text-stone-800 text-sm leading-tight truncate">
                    {track.title}
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5 truncate">
                    {track.artist}
                  </p>
                </div>
                <span className="inline-block px-2 py-0.5 bg-terracotta-faint text-terracotta text-xs font-bold rounded-full border border-terracotta/20 shrink-0 ml-1">
                  {track.bpm} BPM
                </span>
              </div>

              {/* Preview button (shown only if previewUrl exists) */}
              {track.previewUrl && (
                <button
                  onClick={handlePreviewClick}
                  aria-label={isPlaying ? "Pause preview" : "Play 30s preview"}
                  className={`mt-1.5 flex items-center gap-1.5 text-xs font-medium transition-colors ${
                    isPlaying
                      ? "text-terracotta"
                      : "text-stone-400 hover:text-terracotta"
                  }`}
                >
                  {isPlaying ? (
                    <>
                      <span className="flex gap-0.5 items-end h-3">
                        <span className="w-0.5 bg-terracotta rounded-full animate-[equalizer_0.6s_ease-in-out_infinite_0ms]" style={{ height: "100%" }} />
                        <span className="w-0.5 bg-terracotta rounded-full animate-[equalizer_0.6s_ease-in-out_infinite_150ms]" style={{ height: "60%" }} />
                        <span className="w-0.5 bg-terracotta rounded-full animate-[equalizer_0.6s_ease-in-out_infinite_300ms]" style={{ height: "80%" }} />
                      </span>
                      Stop preview
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 12 12">
                        <path d="M2 1.5l9 4.5-9 4.5V1.5z" />
                      </svg>
                      30s preview
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Metric bars */}
          <div className="space-y-1.5">
            <MetricBar label="Energy" value={track.energy} color="bg-terracotta" />
            <MetricBar label="Valence" value={track.valence} color="bg-amber-400" />
            <MetricBar label="Dance" value={track.danceability} color="bg-emerald-400" />
          </div>
        </div>
      </div>

      {/* ── Vibe match footer */}
      <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i < Math.ceil(track.matchPct / 20)
                    ? "bg-terracotta"
                    : "bg-stone-200"
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-stone-400">
            {track.matchPct >= 90
              ? "Exact vibe match"
              : track.matchPct >= 75
              ? "Strong vibe match"
              : track.matchPct >= 60
              ? "Moderate match"
              : "Loose match"}
          </span>
        </div>

        {/* ── Spotify Attribution Link */}
        {track.spotifyId ? (
          <a
            href={`https://open.spotify.com/track/${track.spotifyId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium text-stone-400 hover:text-stone-600 transition-colors"
            title="Open in Spotify"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.84.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.6.18-1.2.72-1.38 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.239.54-.959.72-1.56.3z"/>
            </svg>
            Spotify
          </a>
        ) : (
          <span
            className="flex items-center gap-1.5 text-xs font-medium text-stone-300 opacity-60 cursor-not-allowed"
            title="Local Engine Track"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.84.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.6.18-1.2.72-1.38 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.239.54-.959.72-1.56.3z"/>
            </svg>
            Spotify
          </span>
        )}
      </div>
    </div>
  );
}
