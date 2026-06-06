// ─────────────────────────────────────────────────────────────────────────────
// VECTOR DISTANCE ENGINE — pure TypeScript, zero external dependencies.
// Fully unit-testable in isolation. No React, no fetch, no side effects.
// ─────────────────────────────────────────────────────────────────────────────

import type { Track, ScoredTrack, WorkoutMode } from "./types";

// ── BPM Normalization ─────────────────────────────────────────────────────────
// Problem: raw BPM values (70–200) would dwarf the 0.0–1.0 decimal features in
// the Euclidean distance formula. Without normalization, a BPM difference of 100
// contributes 100² = 10,000 to the squared sum, while all three decimal features
// together contribute at most 1² + 1² + 1² = 3 — making BPM ~3,333× more
// influential. Min-max normalization maps BPM into the same [0.0, 1.0] range.
const BPM_MIN = 60;   // floor: below this is ambient/spoken word
const BPM_MAX = 220;  // ceiling: above this is drum & bass territory

function normalizeBpm(bpm: number): number {
  return Math.max(0, Math.min(1, (bpm - BPM_MIN) / (BPM_MAX - BPM_MIN)));
}

// ── Normalized Vector ─────────────────────────────────────────────────────────

export interface NormalizedVector {
  bpm: number;          // 0.0–1.0 (min-max normalized from raw BPM)
  energy: number;       // 0.0–1.0
  valence: number;      // 0.0–1.0
  danceability: number; // 0.0–1.0
}

/** Converts a raw Track into a unit-range vector for distance math. */
export function normalize(track: Track): NormalizedVector {
  return {
    bpm: normalizeBpm(track.bpm),
    energy: track.energy,
    valence: track.valence,
    danceability: track.danceability,
  };
}

// ── Distance ──────────────────────────────────────────────────────────────────

/**
 * Euclidean distance between two normalized 4D vectors.
 * All four dimensions now have equal geometric weight (each 0.0–1.0).
 * Maximum possible distance in this space = √4 = 2.0
 */
export function euclideanDistance(
  a: NormalizedVector,
  b: NormalizedVector
): number {
  return Math.sqrt(
    Math.pow(a.bpm - b.bpm, 2) +
      Math.pow(a.energy - b.energy, 2) +
      Math.pow(a.valence - b.valence, 2) +
      Math.pow(a.danceability - b.danceability, 2)
  );
}

// ── Centroid (Taste Profile) ──────────────────────────────────────────────────

/**
 * Averages the normalized vectors of all seed tracks to produce the
 * user's "Target Vibe Vector" — the centroid of their taste profile.
 * Tracks with invalid BPM values are excluded from the average.
 */
export function centroid(tracks: Track[]): NormalizedVector {
  const valid = tracks.filter((t) => t.bpm > 0);
  if (valid.length === 0) return defaultCentroid("chest-legs");

  const n = valid.length;
  const normalized = valid.map(normalize);

  return {
    bpm: normalized.reduce((s, v) => s + v.bpm, 0) / n,
    energy: normalized.reduce((s, v) => s + v.energy, 0) / n,
    valence: normalized.reduce((s, v) => s + v.valence, 0) / n,
    danceability: normalized.reduce((s, v) => s + v.danceability, 0) / n,
  };
}

/**
 * Default centroid coordinates when no seeds are selected.
 * Pre-tuned per workout mode to make cold-start recommendations useful.
 */
export function defaultCentroid(mode: WorkoutMode): NormalizedVector {
  if (mode === "chest-legs")
    return { bpm: 0.60, energy: 0.85, valence: 0.35, danceability: 0.65 };
  if (mode === "arms-back")
    return { bpm: 0.50, energy: 0.70, valence: 0.50, danceability: 0.82 };
  // treadmill — BPM is handled by hard-filter; center on moderate energy
  return { bpm: 0.50, energy: 0.68, valence: 0.50, danceability: 0.78 };
}

// ── Mode Shift ────────────────────────────────────────────────────────────────

/**
 * Applies a gym-split modifier to the centroid, nudging the target vector
 * toward the physiological ideal for that workout type.
 * Applied AFTER the user's taste centroid is computed, so personal taste
 * still anchors the base and the mode refines the direction.
 */
export function applyModeShift(
  base: NormalizedVector,
  mode: WorkoutMode,
  treadmillBpm?: number
): NormalizedVector {
  const clamp = (v: number) => Math.max(0, Math.min(1, v));

  if (mode === "chest-legs") {
    return {
      ...base,
      energy: clamp(base.energy + 0.15),
      valence: clamp(base.valence - 0.12),
    };
  }

  if (mode === "arms-back") {
    return {
      ...base,
      danceability: clamp(base.danceability + 0.15),
    };
  }

  // treadmill: freeze BPM dimension to the target cadence
  if (treadmillBpm !== undefined) {
    return {
      ...base,
      bpm: normalizeBpm(treadmillBpm),
    };
  }

  return base;
}

// ── Hard Mode Filters ─────────────────────────────────────────────────────────

/**
 * Returns only the tracks that pass the hard physiological constraints
 * for the selected workout mode. Applied before distance scoring so that
 * matchPct percentages are relative to the filtered pool only.
 */
export function applyModeFilter(
  tracks: Track[],
  mode: WorkoutMode,
  treadmillBpm?: number
): Track[] {
  if (mode === "chest-legs") {
    return tracks.filter((t) => t.energy > 0.75 && t.valence < 0.45);
  }

  if (mode === "arms-back") {
    return tracks.filter((t) => t.danceability > 0.70);
  }

  if (mode === "treadmill" && treadmillBpm !== undefined) {
    const primary = tracks.filter((t) => Math.abs(t.bpm - treadmillBpm) <= 5);
    // Auto-expand to ±10 BPM if the strict window yields nothing
    if (primary.length === 0) {
      return tracks.filter((t) => Math.abs(t.bpm - treadmillBpm) <= 10);
    }
    return primary;
  }

  return tracks;
}

// ── Main Scoring Pipeline ─────────────────────────────────────────────────────

export interface ScoreAndRankResult {
  tracks: ScoredTrack[];
  filteredOutCount: number;  // tracks excluded by hard mode filter
  expanded: boolean;         // true if treadmill window was auto-expanded to ±10
}

/**
 * Full scoring pipeline:
 * 1. Apply hard mode filter
 * 2. Compute centroid + mode shift to get final target vector
 * 3. Normalize each candidate and compute Euclidean distance
 * 4. Convert distances to match percentages (relative to pool max)
 * 5. Sort ascending by distance (closest match first)
 */
export function scoreAndRank(
  candidates: Track[],
  seedCentroid: NormalizedVector,
  mode: WorkoutMode,
  treadmillBpm?: number
): ScoreAndRankResult {
  // 1. Hard filter
  const filteredOut = candidates.length;
  const filtered = applyModeFilter(candidates, mode, treadmillBpm);
  const filteredOutCount = filteredOut - filtered.length;

  // Detect if treadmill auto-expanded
  let expanded = false;
  if (mode === "treadmill" && treadmillBpm !== undefined) {
    const strict = candidates.filter((t) => Math.abs(t.bpm - treadmillBpm) <= 5);
    expanded = strict.length === 0 && filtered.length > 0;
  }

  // 2. Apply mode shift to centroid
  const target = applyModeShift(seedCentroid, mode, treadmillBpm);

  // 3. Compute distances
  const scored = filtered.map((t): ScoredTrack => ({
    ...t,
    distance: euclideanDistance(normalize(t), target),
    matchPct: 0,
  }));

  // 4. Normalise distances → matchPct
  // Use a constant max distance rather than relative pool max.
  // The absolute max possible Euclidean distance across 4 normalized [0, 1] dims is 2.0.
  // We use 1.5 as our practical cap so the scaling feels natural and utilizes the 0-100% range.
  const MAX_POSSIBLE_DIST = 1.5;
  for (const s of scored) {
    s.matchPct = Math.max(0, Math.round((1 - s.distance / MAX_POSSIBLE_DIST) * 100));
  }

  // 5. Sort ascending by distance
  scored.sort((a, b) => a.distance - b.distance);

  return { tracks: scored, filteredOutCount, expanded };
}
