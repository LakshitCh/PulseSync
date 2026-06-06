"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import type { Track, SearchResult } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Converts a SearchResult to a Track, using sensible defaults if features are null */
function searchResultToTrack(r: SearchResult): Track & { estimated: boolean } {
  const estimated =
    r.bpm === null || r.energy === null || r.valence === null || r.danceability === null;
  return {
    id: r.id,
    spotifyId: r.spotifyId,
    title: r.title,
    artist: r.artist,
    albumArt: r.albumArt,
    previewUrl: r.previewUrl,
    bpm: r.bpm ?? 120,
    energy: r.energy ?? 0.65,
    valence: r.valence ?? 0.50,
    danceability: r.danceability ?? 0.75,
    estimated,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LETTER AVATAR (for tracks without album art)
// ─────────────────────────────────────────────────────────────────────────────
function LetterAvatar({ title, size = 32 }: { title: string; size?: number }) {
  const letter = title.charAt(0).toUpperCase();
  return (
    <div
      className="rounded-md bg-gradient-to-br from-terracotta to-terracotta-dark flex items-center justify-center shrink-0 text-white font-bold"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {letter}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────
interface SeedSearchInputProps {
  seedTracks: Track[];
  onAdd: (track: Track) => void;
  onRemove: (id: string) => void;
  maxSeeds?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function SeedSearchInput({
  seedTracks,
  onAdd,
  onRemove,
  maxSeeds = 5,
}: SeedSearchInputProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const seedIds = seedTracks.map((t) => t.id);
  const atMax = seedTracks.length >= maxSeeds;

  // ── 300ms debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // ── Fetch on debounced query change
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      setSearchError(null);
      return;
    }

    let cancelled = false;
    setSearching(true);
    setSearchError(null);

    fetch(`/api/spotify-engine?action=search&q=${encodeURIComponent(debouncedQuery)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Search error ${res.status}`);
        return res.json() as Promise<SearchResult[]>;
      })
      .then((data) => {
        if (!cancelled) {
          setResults(data);
          setDropdownOpen(true);
        }
      })
      .catch(() => {
        if (!cancelled) setSearchError("Search temporarily unavailable");
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  // ── Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleAdd = useCallback(
    (result: SearchResult) => {
      if (atMax || seedIds.includes(result.id)) return;
      onAdd(searchResultToTrack(result));
      setQuery("");
      setDebouncedQuery("");
      setResults([]);
      setDropdownOpen(false);
      inputRef.current?.focus();
    },
    [atMax, seedIds, onAdd]
  );

  return (
    <div className="space-y-3">
      {/* ── Seed chips */}
      {seedTracks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {seedTracks.map((t) => {
            const hasEstimated = (t as Track & { estimated?: boolean }).estimated;
            return (
              <div
                key={t.id}
                className="animate-chip-in flex items-center gap-2 bg-terracotta/10 border border-terracotta/30 rounded-full pl-3 pr-2 py-1.5 text-xs font-medium text-terracotta-dark"
                style={{ animationFillMode: "both" }}
              >
                <span className="font-semibold truncate max-w-[120px]">{t.title}</span>
                <span className="text-terracotta/60">·</span>
                <span className="text-terracotta/70 font-normal whitespace-nowrap">
                  {hasEstimated ? "~" : ""}{t.bpm} bpm
                </span>
                <button
                  onClick={() => onRemove(t.id)}
                  aria-label={`Remove ${t.title}`}
                  className="w-4 h-4 rounded-full bg-terracotta/20 hover:bg-terracotta/40 flex items-center justify-center transition-colors ml-0.5 shrink-0"
                >
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 10 10">
                    <path
                      d="M2 2l6 6M8 2l-6 6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Search input */}
      <div className="relative" ref={containerRef}>
        <div
          className={`flex items-center gap-3 bg-white/70 border rounded-xl px-4 py-3 transition-all duration-200 ${
            dropdownOpen
              ? "border-terracotta shadow-sm"
              : "border-stone-200 hover:border-stone-300"
          } ${atMax ? "opacity-50 pointer-events-none" : ""}`}
        >
          {/* Search or spinner icon */}
          {searching ? (
            <svg
              className="w-4 h-4 text-terracotta shrink-0 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12" cy="12" r="10"
                stroke="currentColor" strokeWidth="4"
              />
              <path
                className="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8v8z"
              />
            </svg>
          ) : (
            <svg
              className="w-4 h-4 text-stone-400 shrink-0"
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path
                strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          )}

          <input
            ref={inputRef}
            id="seed-search-input"
            type="text"
            placeholder={atMax ? "Maximum 5 seeds selected" : "Search any song or artist…"}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value.length >= 2) setDropdownOpen(true);
            }}
            onFocus={() => {
              if (results.length > 0) setDropdownOpen(true);
            }}
            disabled={atMax}
            className="flex-1 bg-transparent text-sm text-stone-700 placeholder-stone-400 outline-none min-w-0"
          />

          {/* Seed count badge */}
          <span className="text-xs text-stone-400 font-medium shrink-0">
            {seedTracks.length}/{maxSeeds}
          </span>

          {/* Clear button */}
          {query && (
            <button
              onClick={() => {
                setQuery("");
                setDebouncedQuery("");
                setResults([]);
                inputRef.current?.focus();
              }}
              className="text-stone-400 hover:text-stone-600 transition-colors shrink-0"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 14 14">
                <path
                  d="M2 2l10 10M12 2L2 12"
                  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                />
              </svg>
            </button>
          )}
        </div>

        {/* ── Error inline */}
        {searchError && (
          <div className="absolute z-40 mt-1 w-full bg-white border border-amber-200 rounded-xl shadow-md px-4 py-2.5 text-xs text-amber-700 animate-fade-in flex items-center gap-2">
            <span>⚠️</span> {searchError}
          </div>
        )}

        {/* ── Dropdown results */}
        {dropdownOpen && results.length > 0 && !searchError && (
          <div className="absolute z-40 mt-1 w-full bg-white border border-stone-200 rounded-xl shadow-xl overflow-hidden animate-fade-in">
            <div className="max-h-64 overflow-y-auto divide-y divide-stone-50">
              {results.map((r) => {
                const isAdded = seedIds.includes(r.id);
                return (
                  <button
                    key={r.id}
                    onClick={() => handleAdd(r)}
                    disabled={isAdded}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors group ${
                      isAdded
                        ? "opacity-50 cursor-default bg-stone-50"
                        : "hover:bg-terracotta-faint"
                    }`}
                  >
                    {/* Album art thumbnail */}
                    {r.albumArt ? (
                      <img
                        src={r.albumArt}
                        alt={r.title}
                        width={32}
                        height={32}
                        className="rounded-md object-cover shrink-0"
                      />
                    ) : (
                      <LetterAvatar title={r.title} size={32} />
                    )}

                    {/* Track info */}
                    <div className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-stone-700 group-hover:text-terracotta-dark truncate">
                        {r.title}
                      </span>
                      <span className="block text-xs text-stone-400 truncate">
                        {r.artist}
                      </span>
                    </div>

                    {/* Badges */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {r.bpm !== null ? (
                        <span className="text-xs font-semibold text-stone-500 bg-stone-100 rounded-md px-1.5 py-0.5">
                          {r.bpm} bpm
                        </span>
                      ) : (
                        <span className="text-xs text-stone-300 italic">no data</span>
                      )}
                      {isAdded && (
                        <svg className="w-4 h-4 text-terracotta" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── No results */}
        {dropdownOpen && results.length === 0 && debouncedQuery.length >= 2 && !searching && !searchError && (
          <div className="absolute z-40 mt-1 w-full bg-white border border-stone-200 rounded-xl shadow-xl px-4 py-3 text-sm text-stone-400 animate-fade-in">
            No tracks match &ldquo;{debouncedQuery}&rdquo;
          </div>
        )}
      </div>
    </div>
  );
}
