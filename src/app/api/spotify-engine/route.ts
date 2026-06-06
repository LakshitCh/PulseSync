import { NextRequest, NextResponse } from "next/server";
import type { Track, SearchResult, RecommendResponse, WorkoutMode } from "@/lib/types";
import {
  getAccessToken,
  spotifySearch,
} from "@/lib/spotify";
import type { SpotifyTrackItem } from "@/lib/spotify";
import staticDataset from "@/data/tracks-dataset.json";

// ─────────────────────────────────────────────────────────────────────────────
// FALLBACK STATIC DATASET
// Used when Spotify credentials are absent or search completely fails.
// ─────────────────────────────────────────────────────────────────────────────
const STATIC_TRACKS = staticDataset as Track[];

function staticFallbackSearch(query: string): SearchResult[] {
  const q = query.toLowerCase();
  return STATIC_TRACKS.filter(
    (t) =>
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q)
  ).map((t): SearchResult => ({ ...t }));
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE ESTIMATION
// Since /audio-features is deprecated for new apps (403), we estimate BPM and
// audio vectors from available track metadata signals. These are approximations
// informed by known genre correlations, not real Spotify analysis values.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a base audio profile for a search query keyword.
 * Each keyword is associated with typical genre characteristics.
 */
function queryProfile(query: string): {
  bpm: number;
  energy: number;
  valence: number;
  danceability: number;
} {
  const q = query.toLowerCase();
  if (q.includes("trap") || q.includes("drill"))
    return { bpm: 145, energy: 0.84, valence: 0.32, danceability: 0.76 };
  if (q.includes("hip hop") || q.includes("rap"))
    return { bpm: 100, energy: 0.72, valence: 0.48, danceability: 0.82 };
  if (q.includes("r&b") || q.includes("soul"))
    return { bpm: 92, energy: 0.55, valence: 0.62, danceability: 0.80 };
  if (q.includes("afrobeats") || q.includes("afro pop"))
    return { bpm: 108, energy: 0.68, valence: 0.72, danceability: 0.88 };
  if (q.includes("electronic") || q.includes("edm") || q.includes("dance"))
    return { bpm: 128, energy: 0.88, valence: 0.60, danceability: 0.85 };
  if (q.includes("pop"))
    return { bpm: 118, energy: 0.65, valence: 0.68, danceability: 0.78 };
  if (q.includes("rock") || q.includes("metal"))
    return { bpm: 140, energy: 0.92, valence: 0.28, danceability: 0.52 };
  if (q.includes("reggaeton") || q.includes("latin"))
    return { bpm: 96, energy: 0.74, valence: 0.76, danceability: 0.90 };
  if (q.includes("running") || q.includes("cardio"))
    return { bpm: 150, energy: 0.80, valence: 0.52, danceability: 0.76 };
  // Default: modern hip hop/pop hybrid
  return { bpm: 120, energy: 0.70, valence: 0.52, danceability: 0.78 };
}

/**
 * Applies track-level adjustments to the genre base profile.
 * These use available Spotify metadata to nudge the estimate:
 * - explicit: more likely to be harder/higher energy (rap/trap)
 * - duration_ms: very short = intro/skit (low energy), very long = epic/high energy
 * - popularity: higher popularity tracks tend toward higher valence and danceability
 */
function estimateFeatures(
  item: SpotifyTrackItem & { explicit?: boolean; popularity?: number; duration_ms?: number },
  queryKey: string
): { bpm: number; energy: number; valence: number; danceability: number } {
  const base = queryProfile(queryKey);

  // Clamp helper
  const clamp = (v: number) => Math.max(0.1, Math.min(0.97, v));

  // Small random variance generator to prevent duplicates across tracks
  const r = () => (Math.random() - 0.5) * 0.15; // +/- 0.075 variance

  // Explicit content adjustment (+energy, -valence)
  const explicitMod = item.explicit ? 0.06 : 0;

  // Popularity adjustment (0–100 → ±0.08 on valence/dance)
  const popularity = item.popularity ?? 50;
  const popMod = (popularity - 50) / 100 * 0.12; // -0.06 to +0.06

  // Duration adjustment: < 120s = skit (lower energy), > 240s = epic (higher energy)
  const durationMs = item.duration_ms ?? 200000;
  const durationMod =
    durationMs < 120_000 ? -0.10
    : durationMs > 270_000 ? 0.05
    : 0;

  const bpmVariance = Math.floor((Math.random() - 0.5) * 20);

  return {
    bpm: base.bpm + (item.explicit ? 8 : 0) + (durationMs > 270_000 ? 10 : 0) + bpmVariance,
    energy: clamp(base.energy + explicitMod + durationMod + r()),
    valence: clamp(base.valence + popMod - explicitMod * 0.5 + r()),
    danceability: clamp(base.danceability + popMod * 0.5 + r()),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE → MULTI-QUERY MAP
// Multiple complementary queries per mode — run in parallel and deduplicate.
// Each individual query uses limit=10 (Spotify dev-mode max).
// ─────────────────────────────────────────────────────────────────────────────
const MODE_QUERIES: Record<WorkoutMode, string[]> = {
  "chest-legs": [
    "trap banger hard 2024",
    "hip hop aggressive energy",
    "drill workout gym heavy",
    "rap power intensity",
    "hip hop hard hitting bass",
    "phonk workout hard",
    "metalcore intensity gym",
    "hardstyle gym pump",
    "memphis rap bass",
    "heavy rock lifting",
    "nu metal angry",
    "hardcore rap gym",
    "trap metal screaming",
    "deathcore PR",
    "grime aggressive UK"
  ],
  "arms-back": [
    "r&b hip hop groove pump",
    "hip hop smooth rhythm soul",
    "afrobeats hip hop dance",
    "r&b modern 2024 hits",
    "hip hop flow rhythm bass",
    "neo soul chill pump",
    "lofi hip hop beats",
    "dancehall rhythm workout",
    "synthwave retrowave chill",
    "liquid drum and bass",
    "chill house vibes",
    "funk rock rhythm",
    "jazzy hip hop groove",
    "reggaeton smooth dance",
    "alt r&b late night"
  ],
  treadmill: [
    "running cardio hip hop",
    "electronic dance workout running",
    "hip hop high energy 2024",
    "pop dance cardio beats",
    "running motivation hip hop",
    "tech house pace",
    "trance running 140bpm",
    "drum and bass sprint",
    "indie pop upbeat cardio",
    "synth pop runner",
    "eurodance 90s cardio",
    "bass house shuffle",
    "high bpm happy hardcore",
    "pop punk running",
    "uptempo latin cardio"
  ],
};

const MODE_MODIFIERS: Record<WorkoutMode, string[]> = {
  "chest-legs": ["trap workout", "high intensity", "hard hits", "gym heavy", "power"],
  "arms-back": ["groove", "smooth rhythm", "flow", "dance", "soul pump"],
  treadmill: ["running", "cardio", "high energy", "pace", "workout beats"],
};

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE HANDLER
// GET /api/spotify-engine?action=search&q={query}
// GET /api/spotify-engine?action=recommend&seeds={ids}&mode={mode}&bpm={bpm}
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const action = searchParams.get("action");

  // ── Search action ────────────────────────────────────────────────────────
  if (action === "search") {
    const q = searchParams.get("q")?.trim() ?? "";
    if (q.length < 2) {
      return NextResponse.json<SearchResult[]>([], { status: 200 });
    }

    try {
      const token = await getAccessToken();
      // Use limit=10 — enforced by Spotify dev-mode
      const items = await spotifySearch(token, q, 10);

      // Since /audio-features is deprecated, estimate from query context
      const results: SearchResult[] = items.map((item) => {
        const estimated = estimateFeatures(item as SpotifyTrackItem & {
          explicit?: boolean; popularity?: number; duration_ms?: number;
        }, q);
        const images = item.album.images;
        const albumArt = images.length > 0
          ? (images[images.length - 1]?.url ?? images[0]?.url ?? "")
          : "";

        return {
          id: item.id,
          spotifyId: item.id,
          title: item.name,
          artist: item.artists.map((a) => a.name).join(", "),
          albumArt,
          previewUrl: item.preview_url,
          bpm: estimated.bpm,
          energy: estimated.energy,
          valence: estimated.valence,
          danceability: estimated.danceability,
        };
      });

      return NextResponse.json<SearchResult[]>(results);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[spotify-engine/search]", msg);
      return NextResponse.json<SearchResult[]>(staticFallbackSearch(q));
    }
  }

  // ── Recommend action ─────────────────────────────────────────────────────
  if (action === "recommend") {
    const mode = (searchParams.get("mode") ?? "chest-legs") as WorkoutMode;
    const seedArtistsStr = searchParams.get("seedArtists") ?? "";
    const seedArtists = seedArtistsStr ? seedArtistsStr.split(",").map(a => a.trim()).filter(Boolean) : [];

    let queries: string[] = [];

    if (seedArtists.length > 0) {
      // Dynamic Contextual Query Generator
      const modifiers = MODE_MODIFIERS[mode];
      seedArtists.forEach(artist => {
        // Pick 2 random modifiers for each seed artist
        const shuffledMods = [...modifiers].sort(() => 0.5 - Math.random());
        queries.push(`${artist} ${shuffledMods[0]}`);
        queries.push(`${artist} ${shuffledMods[1]}`);
      });
      // Cap at 10 total queries to avoid crazy parallel loads
      queries = queries.slice(0, 10);
    } else {
      // Cold-Start: Pick 5 random fallback queries using math randomizer
      const fallbacks = MODE_QUERIES[mode] ?? MODE_QUERIES["chest-legs"];
      queries = [...fallbacks].sort(() => 0.5 - Math.random()).slice(0, 5);
    }

    try {
      const token = await getAccessToken();

      // Run all queries in parallel — each with limit=10
      const searchPromises = queries.map((q) =>
        spotifySearch(token, q, 10).catch(() => [] as SpotifyTrackItem[])
      );
      const searchResults = await Promise.all(searchPromises);

      // Flatten and deduplicate by track ID
      const seen = new Set<string>();
      const allItems: Array<SpotifyTrackItem & { _queryKey: string }> = [];
      searchResults.forEach((items, idx) => {
        items.forEach((item) => {
          if (!seen.has(item.id)) {
            seen.add(item.id);
            allItems.push({ ...item, _queryKey: queries[idx] });
          }
        });
      });

      if (allItems.length === 0) {
        return NextResponse.json<RecommendResponse>({
          tracks: STATIC_TRACKS,
          fallback: true,
          fallbackReason: "Spotify returned no tracks. Showing curated dataset.",
        });
      }

      // Estimate audio features from track metadata + query context
      const liveTracks: Track[] = allItems.map((item): Track => {
        const estimated = estimateFeatures(item as SpotifyTrackItem & {
          explicit?: boolean; popularity?: number; duration_ms?: number;
        }, item._queryKey);

        const images = item.album.images;
        const albumArt = images.length > 0
          ? (images[images.length - 1]?.url ?? images[0]?.url ?? "")
          : "";

        return {
          id: item.id,
          spotifyId: item.id,
          title: item.name,
          artist: item.artists.map((a) => a.name).join(", "),
          albumArt,
          previewUrl: item.preview_url,
          bpm: estimated.bpm,
          energy: estimated.energy,
          valence: estimated.valence,
          danceability: estimated.danceability,
        };
      });

      // Merge with static dataset so scoring has the curated anchors too
      const staticAsPool: Track[] = STATIC_TRACKS.map((t) => ({ ...t }));
      const staticIds = new Set(staticAsPool.map((t) => t.id));
      // Avoid duplicate ids between Spotify tracks and static tracks
      const liveOnly = liveTracks.filter((t) => !staticIds.has(t.id));

      const combinedPool = [...liveOnly, ...staticAsPool];

      return NextResponse.json<RecommendResponse>({
        tracks: combinedPool,
        fallback: false,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[spotify-engine/recommend]", msg);

      const reason =
        msg === "SPOTIFY_CREDENTIALS_MISSING"
          ? "Spotify credentials not configured. Add them to .env.local for live recommendations."
          : "Spotify API unavailable. Showing curated dataset.";

      return NextResponse.json<RecommendResponse>({
        tracks: STATIC_TRACKS,
        fallback: true,
        fallbackReason: reason,
      });
    }
  }

  // ── Unknown action ───────────────────────────────────────────────────────
  return NextResponse.json(
    {
      error: `Unknown action: ${action ?? "(none)"}. Use ?action=search or ?action=recommend`,
    },
    { status: 400 }
  );
}
