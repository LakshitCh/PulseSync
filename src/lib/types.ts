// ─────────────────────────────────────────────────────────────────────────────
// SHARED TYPE CONTRACTS — used across lib/, api/, and components/
// ─────────────────────────────────────────────────────────────────────────────

/** A fully-resolved track with all audio features available */
export interface Track {
  id: string;          // Local ID or Spotify track ID
  spotifyId: string;   // Spotify track ID (empty string for static fallback tracks)
  title: string;
  artist: string;
  albumArt: string;    // Spotify CDN URL, or "" for fallback (shows letter avatar)
  previewUrl: string | null;
  bpm: number;
  energy: number;      // 0.0–1.0
  valence: number;     // 0.0–1.0
  danceability: number; // 0.0–1.0
}

/** Returned by the search action — audio features may be null if endpoint deprecated */
export interface SearchResult {
  id: string;
  spotifyId: string;
  title: string;
  artist: string;
  albumArt: string;
  previewUrl: string | null;
  bpm: number | null;
  energy: number | null;
  valence: number | null;
  danceability: number | null;
}

/** A scored track returned by the client-side vector engine */
export interface ScoredTrack extends Track {
  distance: number;
  matchPct: number;
}

export type WorkoutMode = "arms-back" | "chest-legs" | "treadmill";

/** Shape returned by /api/spotify-engine?action=recommend */
export interface RecommendResponse {
  tracks: Track[];
  fallback: boolean;    // true when static dataset is used
  fallbackReason?: string;
}

/** Shape returned by /api/spotify-engine?action=search */
export type SearchResponse = SearchResult[];
