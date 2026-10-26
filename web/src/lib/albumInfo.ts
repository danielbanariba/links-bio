// What the now-playing view needs about an album that a card does not carry: its
// tracks (start times in the one video), the meta line and the genre chip. Built
// per album at build time as a small static file (pages/metal-archive/album/
// [id].json.ts -> /metal-archive/album/<id>.json, not in the sitemap) and fetched
// by the Player only when that album starts, so the pages stay as they are.
// Browser-safe: no database here.

export interface AlbumTrack {
  name: string;
  /** Start in the video, in seconds; 0 for every track when the list has no timestamps. */
  seconds: number;
}

export interface AlbumInfo {
  tracks: AlbumTrack[];
  /** "Full Album · 2024 · Australia", may be empty. */
  meta: string;
  /** The album's genre page; null without a genre. */
  genre: { label: string; href: string } | null;
  /** The album's length in whole minutes, when the database knows it. */
  minutes: number | null;
}

export const albumInfoUrl = (albumId: string) => `/metal-archive/album/${albumId}.json`;

/** The parsed file, or null when it is not an AlbumInfo (never trusted blindly). */
export function parseAlbumInfo(raw: unknown): AlbumInfo | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.tracks)) return null;
  const tracks = r.tracks
    .filter((t): t is AlbumTrack => !!t && typeof t.name === 'string' && typeof t.seconds === 'number')
    .map((t) => ({ name: t.name, seconds: t.seconds }));
  const g = r.genre as { label?: unknown; href?: unknown } | null;
  const genre =
    g && typeof g.label === 'string' && typeof g.href === 'string' && g.href.startsWith('/metal-archive/')
      ? { label: g.label, href: g.href }
      : null;
  return {
    tracks,
    meta: typeof r.meta === 'string' ? r.meta : '',
    genre,
    minutes: typeof r.minutes === 'number' && r.minutes > 0 ? r.minutes : null,
  };
}

const cache = new Map<string, Promise<AlbumInfo | null>>();

/**
 * The album's info, fetched once per album and session. Null for an unknown id,
 * a failed request or a bad file; a failure is not cached, so a later start of
 * the same album tries again.
 */
export function loadAlbumInfo(albumId: string): Promise<AlbumInfo | null> {
  if (!/^\d+$/.test(albumId)) return Promise.resolve(null);
  let pending = cache.get(albumId);
  if (!pending) {
    pending = fetch(albumInfoUrl(albumId))
      .then((res) => (res.ok ? res.json() : null))
      .then(parseAlbumInfo)
      .catch(() => null)
      .then((info) => {
        if (!info) cache.delete(albumId);
        return info;
      });
    cache.set(albumId, pending);
  }
  return pending;
}
