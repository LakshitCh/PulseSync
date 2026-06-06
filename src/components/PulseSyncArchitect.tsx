"use client";

import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import type { Track, ScoredTrack, RecommendResponse, WorkoutMode } from "@/lib/types";
import {
  centroid,
  defaultCentroid,
  scoreAndRank,
  normalize,
} from "@/lib/vectorEngine";
import type { NormalizedVector } from "@/lib/vectorEngine";
import SeedSearchInput from "./SeedSearchInput";
import VibeVectorWidget from "./VibeVectorWidget";
import TrackCard from "./TrackCard";
import SkeletonCard from "./SkeletonCard";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const MAX_RESULTS = 15;
const SKELETON_COUNT = 6;

const MODES: { key: WorkoutMode; label: string; icon: string; desc: string }[] = [
  {
    key: "chest-legs",
    label: "Chest / Legs",
    icon: "💪",
    desc: "High energy, aggressive tempo",
  },
  {
    key: "arms-back",
    label: "Arms / Back",
    icon: "🏋️",
    desc: "Steady cadence, high danceability",
  },
  {
    key: "treadmill",
    label: "Treadmill",
    icon: "🏃",
    desc: "Cadence-locked BPM matching",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function PulseSyncArchitect() {
  // ── State
  const [selectedMode, setSelectedMode] = useState<WorkoutMode>("chest-legs");
  const [seedTracks, setSeedTracks] = useState<Track[]>([]);
  const [treadmillBpm, setTreadmillBpm] = useState(140);
  const [playlist, setPlaylist] = useState<ScoredTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [fallbackReason, setFallbackReason] = useState<string>("");
  const [expandedBpm, setExpandedBpm] = useState(false);
  const [filteredOutCount, setFilteredOutCount] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ── Vibe vector (live, recomputed as seeds change)
  const vibeVector: NormalizedVector | null = useMemo(() => {
    if (seedTracks.length === 0) return null;
    return centroid(seedTracks);
  }, [seedTracks]);

  const avgBpm = useMemo(() => {
    if (seedTracks.length === 0) return 0;
    return seedTracks.reduce((s, t) => s + t.bpm, 0) / seedTracks.length;
  }, [seedTracks]);

  // ── Seed management
  const handleAddSeed = useCallback((track: Track) => {
    setSeedTracks((prev) => {
      if (prev.length >= 5 || prev.some((t) => t.id === track.id)) return prev;
      return [...prev, track];
    });
  }, []);

  const handleRemoveSeed = useCallback((id: string) => {
    setSeedTracks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Audio preview
  const handlePreviewPlay = useCallback(
    (trackId: string, previewUrl: string | null) => {
      // Stop if same track clicked again
      if (playingId === trackId) {
        audioRef.current?.pause();
        setPlayingId(null);
        return;
      }

      // Stop any currently playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      if (!previewUrl) return;

      const audio = new Audio(previewUrl);
      audio.volume = 0.75;
      audio.play().catch(() => {
        /* Autoplay blocked — silently ignore */
      });
      audio.addEventListener("ended", () => setPlayingId(null));
      audioRef.current = audio;
      setPlayingId(trackId);
    },
    [playingId]
  );

  // Stop audio on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  // ── Generate playlist
  const generatePlaylist = useCallback(async () => {
    setLoading(true);
    setGenerated(false);
    setApiError(null);
    setPlaylist([]);
    setExpandedBpm(false);

    // Stop any playing preview
    audioRef.current?.pause();
    setPlayingId(null);

    try {
      const seedSpotifyIdsForUrl = seedTracks
        .map((t) => t.spotifyId)
        .filter(Boolean);

      const seedArtistsForUrl = seedTracks
        .map((t) => t.artist)
        .filter(Boolean);

      const params = new URLSearchParams({
        action: "recommend",
        mode: selectedMode,
        bpm: String(treadmillBpm),
      });
      if (seedSpotifyIdsForUrl.length > 0) {
        params.set("seeds", seedSpotifyIdsForUrl.join(","));
      }
      if (seedArtistsForUrl.length > 0) {
        params.set("seedArtists", seedArtistsForUrl.join(","));
      }

      const res = await fetch(`/api/spotify-engine?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`API returned ${res.status}`);
      }

      const data = (await res.json()) as RecommendResponse;

      setIsFallback(data.fallback);
      setFallbackReason(data.fallbackReason ?? "");

      // ── Client-side vector scoring
      const center =
        seedTracks.length > 0 ? centroid(seedTracks) : defaultCentroid(selectedMode);

      // Exclude seeds from recommendation pool.
      // IMPORTANT: only add non-empty spotifyIds to the exclusion set;
      // adding "" would block every static-fallback track (all have spotifyId:"").
      const seedLocalIds = new Set(seedTracks.map((t) => t.id));
      const seedSpotifyIdSet = new Set(
        seedTracks.filter((t) => t.spotifyId !== "").map((t) => t.spotifyId)
      );
      const pool = data.tracks.filter(
        (t) =>
          !seedLocalIds.has(t.id) &&
          (t.spotifyId === "" || !seedSpotifyIdSet.has(t.spotifyId))
      );

      const result = scoreAndRank(pool, center, selectedMode, treadmillBpm);

      setFilteredOutCount(result.filteredOutCount);
      setExpandedBpm(result.expanded);
      setPlaylist(result.tracks.slice(0, MAX_RESULTS));
      setGenerated(true);
    } catch (err) {
      setApiError(
        err instanceof Error ? err.message : "Unexpected error. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [seedTracks, selectedMode, treadmillBpm]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-canvas font-sans">
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;600;700;800&display=swap');
        @keyframes equalizer {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(0.3); }
        }
      `}</style>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-stone-300 bg-canvas/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-bold text-stone-800 tracking-tight">
              <span className="text-terracotta">Pulse</span>Sync
            </h1>
            <p className="text-xs text-stone-400 mt-0.5 font-medium tracking-wide">
              Kinetic Playlist Architect
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isFallback && generated && (
              <span className="hidden sm:flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                Curated dataset
              </span>
            )}
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  loading ? "bg-amber-400 animate-pulse" : "bg-terracotta animate-pulse-soft"
                }`}
              />
              <span className="text-xs text-stone-500 font-medium">
                {loading ? "Processing…" : "ML Engine Active"}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        {/* ── HERO ───────────────────────────────────────────────────────────── */}
        <section className="animate-fade-in">
          <h2 className="font-display text-3xl font-bold text-stone-800 leading-tight">
            Build your{" "}
            <span className="text-terracotta italic">perfect</span> workout
            <br />
            playlist with AI
          </h2>
          <p className="mt-2 text-stone-500 text-sm leading-relaxed max-w-xl">
            Seed up to 5 tracks from Spotify's global catalog, pick your gym
            split, and let our AI engine find the perfect sonic matches to your vibe.
          </p>
        </section>

        {/* ── STEP 1: GYM SPLIT ─────────────────────────────────────────────── */}
        <section
          className="space-y-3 animate-fade-in"
          style={{ animationDelay: "60ms" }}
        >
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-terracotta text-white text-xs flex items-center justify-center font-bold">
              1
            </span>
            <h3 className="font-semibold text-stone-700 text-sm uppercase tracking-wider">
              Select Gym Split
            </h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {MODES.map((m) => (
              <button
                key={m.key}
                id={`mode-${m.key}`}
                onClick={() => setSelectedMode(m.key)}
                className={`relative p-4 rounded-2xl border text-left transition-all duration-200 hover:shadow-md ${
                  selectedMode === m.key
                    ? "border-terracotta bg-terracotta/10 shadow-sm"
                    : "border-stone-200 bg-white/50 hover:border-stone-300 hover:bg-white/70"
                }`}
              >
                {selectedMode === m.key && (
                  <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-terracotta" />
                )}
                <div className="text-xl mb-2">{m.icon}</div>
                <div
                  className={`text-xs font-bold uppercase tracking-wide ${
                    selectedMode === m.key ? "text-terracotta" : "text-stone-600"
                  }`}
                >
                  {m.label}
                </div>
                <div className="text-xs text-stone-400 mt-1 leading-snug">
                  {m.desc}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* ── TREADMILL BPM SLIDER ───────────────────────────────────────────── */}
        {selectedMode === "treadmill" && (
          <section
            className="space-y-3 animate-slide-up"
            style={{ animationFillMode: "both" }}
          >
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-terracotta text-white text-xs flex items-center justify-center font-bold">
                ↗
              </span>
              <h3 className="font-semibold text-stone-700 text-sm uppercase tracking-wider">
                Target Running Cadence
              </h3>
            </div>
            <div className="bg-white/70 border border-stone-200 rounded-2xl p-5">
              <div className="flex items-end justify-between mb-3">
                <div>
                  <span className="font-display text-3xl font-bold text-stone-800">
                    {treadmillBpm <= 110
                      ? "🐢 Power Walk"
                      : treadmillBpm <= 130
                      ? "🚶 Light Jog"
                      : treadmillBpm <= 150
                      ? "🏃 Paced Run"
                      : "🐆 Full Sprint"}
                  </span>
                  <div className="mt-1">
                    <span className="text-terracotta text-sm font-bold">Target: {treadmillBpm}</span>
                    <span className="text-stone-400 text-xs font-medium ml-1">BPM</span>
                  </div>
                </div>
                <span className="text-xs text-stone-400 bg-stone-100 rounded-full px-2.5 py-1 mb-6">
                  ±5 BPM tolerance
                </span>
              </div>
              <input
                id="treadmill-bpm-slider"
                type="range"
                min={80}
                max={200}
                value={treadmillBpm}
                onChange={(e) => setTreadmillBpm(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #c96f53 0%, #c96f53 ${
                    ((treadmillBpm - 80) / 120) * 100
                  }%, #e7e5e4 ${
                    ((treadmillBpm - 80) / 120) * 100
                  }%, #e7e5e4 100%)`,
                }}
              />
              <div className="flex justify-between mt-1">
                <span className="text-xs text-stone-400">80 BPM</span>
                <span className="text-xs text-stone-400">200 BPM</span>
              </div>
            </div>
          </section>
        )}

        {/* ── STEP 2: SEED SONGS ────────────────────────────────────────────── */}
        <section
          className="space-y-3 animate-fade-in"
          style={{ animationDelay: "120ms" }}
        >
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-terracotta text-white text-xs flex items-center justify-center font-bold">
              2
            </span>
            <h3 className="font-semibold text-stone-700 text-sm uppercase tracking-wider">
              Seed Songs{" "}
              <span className="text-stone-400 font-normal normal-case tracking-normal">
                (up to 5 — optional)
              </span>
            </h3>
          </div>

          <SeedSearchInput
            seedTracks={seedTracks}
            onAdd={handleAddSeed}
            onRemove={handleRemoveSeed}
            maxSeeds={5}
          />

          {/* Vibe vector widget (live preview) */}
          {vibeVector && (
            <VibeVectorWidget vector={vibeVector} avgBpm={avgBpm} />
          )}
        </section>

        {/* ── GENERATE BUTTON ───────────────────────────────────────────────── */}
        <section
          className="animate-fade-in"
          style={{ animationDelay: "200ms" }}
        >
          <button
            id="generate-playlist-btn"
            onClick={generatePlaylist}
            disabled={loading}
            className="w-full py-4 rounded-2xl font-display font-bold text-white bg-terracotta hover:bg-terracotta-dark active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg text-base tracking-wide flex items-center justify-center gap-3"
          >
            {loading ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25" cx="12" cy="12" r="10"
                    stroke="currentColor" strokeWidth="4"
                  />
                  <path
                    className="opacity-75" fill="currentColor"
                    d="M4 12a8 8 0 018-8v8z"
                  />
                </svg>
                Querying catalog &amp; scoring vectors…
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5" fill="none"
                  viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path
                    strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                  />
                </svg>
                Generate Workout Playlist
              </>
            )}
          </button>
        </section>

        {/* ── API ERROR ─────────────────────────────────────────────────────── */}
        {apiError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 flex items-center gap-2 animate-fade-in">
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            {apiError}
          </div>
        )}

        {/* ── SKELETON LOADING ──────────────────────────────────────────────── */}
        {loading && (
          <section className="space-y-4 animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-terracotta text-white text-xs flex items-center justify-center font-bold">
                3
              </span>
              <h3 className="font-semibold text-stone-700 text-sm uppercase tracking-wider">
                Generating…
              </h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          </section>
        )}

        {/* ── RESULTS ───────────────────────────────────────────────────────── */}
        {generated && !loading && (
          <section className="space-y-4 animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-terracotta text-white text-xs flex items-center justify-center font-bold">
                  3
                </span>
                <h3 className="font-semibold text-stone-700 text-sm uppercase tracking-wider">
                  Your Playlist
                </h3>
              </div>
              <div className="flex items-center gap-2 text-xs text-stone-400">
                <span className="w-2 h-2 rounded-full bg-terracotta" />
                {playlist.length} tracks ·{" "}
                {MODES.find((m) => m.key === selectedMode)?.label}
              </div>
            </div>

            {/* Fallback banner */}
            {isFallback && fallbackReason && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 animate-fade-in">
                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{fallbackReason}</span>
              </div>
            )}

            {/* Auto-expanded BPM window notice */}
            {expandedBpm && (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 text-xs text-blue-600 animate-fade-in">
                <span>ℹ️</span>
                No tracks found within ±5 BPM — expanded window to ±10 BPM automatically.
              </div>
            )}

            {/* Filtered out notice */}
            {filteredOutCount > 0 && (
              <p className="text-xs text-stone-400 px-1">
                {filteredOutCount} track{filteredOutCount !== 1 ? "s" : ""} filtered out by{" "}
                {MODES.find((m) => m.key === selectedMode)?.label} constraints.
              </p>
            )}

            {/* No results */}
            {playlist.length === 0 ? (
              <div className="bg-white/60 border border-stone-200 rounded-2xl p-8 text-center">
                <div className="text-3xl mb-3">🎵</div>
                <p className="text-stone-600 font-medium">
                  No tracks match the current filters
                </p>
                <p className="text-stone-400 text-xs mt-1">
                  {selectedMode === "treadmill"
                    ? `No tracks within ±10 BPM of ${treadmillBpm} BPM — try adjusting the slider.`
                    : "Try different seed songs or switch your gym split."}
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {playlist.map((track, i) => (
                  <TrackCard
                    key={track.id}
                    track={track}
                    index={i}
                    playingId={playingId}
                    onPreviewPlay={handlePreviewPlay}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── FOOTER ────────────────────────────────────────────────────────── */}
        <footer className="text-center pt-6 pb-2 border-t border-stone-200">
          <p className="text-xs text-stone-400">
            PulseSync · Kinetic Playlist Architect · Portfolio ML Project
          </p>
          <p className="text-stone-300 text-sm mt-1">
            Smart Audio Matching &middot; Real-Time Vibe Analysis &middot; Spotify Web API
          </p>
        </footer>
      </main>
    </div>
  );
}
