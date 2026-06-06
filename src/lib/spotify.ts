// ─────────────────────────────────────────────────────────────────────────────
// SPOTIFY API HELPERS — server-side only (Node.js runtime)
// Never import this from client components.
// ─────────────────────────────────────────────────────────────────────────────

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API_BASE = "https://api.spotify.com/v1";

// ── Module-level token cache (survives warm serverless instances on Vercel)
let cachedToken: string | null = null;
let tokenExpiry = 0;

// ── Internal Spotify response shapes ─────────────────────────────────────────

interface SpotifyImage {
  url: string;
  height: number;
  width: number;
}

interface SpotifyArtist {
  name: string;
}

interface SpotifyAlbum {
  images: SpotifyImage[];
}

export interface SpotifyTrackItem {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  preview_url: string | null;
  explicit?: boolean;
  popularity?: number;
  duration_ms?: number;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

/**
 * Returns a valid Spotify access token using Client Credentials Flow.
 * Caches the token at module level (survives warm Vercel instances).
 * Throws 'SPOTIFY_CREDENTIALS_MISSING' if env vars are absent.
 */
export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("SPOTIFY_CREDENTIALS_MISSING");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Spotify token fetch failed: ${res.status} — ${body.slice(0, 120)}`);
  }

  const data = (await res.json()) as TokenResponse;
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000; // 60s safety buffer
  return cachedToken;
}

// ── Track search ──────────────────────────────────────────────────────────────

/**
 * Searches Spotify's catalog for tracks matching a query.
 *
 * IMPORTANT: Spotify developer apps in Development Mode are capped at
 * limit ≤ 10 per search request. Passing a higher value returns HTTP 400
 * "Invalid limit". This function enforces that cap automatically.
 */
export async function spotifySearch(
  token: string,
  query: string,
  limit = 10
): Promise<SpotifyTrackItem[]> {
  // Hard cap at 10 — Spotify dev-mode maximum
  const safeLimit = Math.min(limit, 10);
  const url = `${API_BASE}/search?q=${encodeURIComponent(query)}&type=track&limit=${safeLimit}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Spotify search failed: ${res.status} — ${body.slice(0, 120)}`);
  }

  const data = (await res.json()) as { tracks: { items: SpotifyTrackItem[] } };
  return data.tracks.items;
}
