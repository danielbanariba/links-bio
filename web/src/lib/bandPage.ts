// The band page's numbers, from its albums (getAlbumsByBand): which ones are
// Popular, and the facts in the hero and the About card. Pure, so the ranking
// and the sums can be checked without a database.
import { NO_GENRE } from './cardMeta.js';
import { coverMode } from './coverDisplay.js';

interface Ranked {
  id: number;
  views?: number | null;
}

/**
 * The band's albums by YouTube views, most first; an album not counted yet
 * counts as 0, and a tie goes to the newer upload (the higher id).
 */
export function rankPopular<T extends Ranked>(albums: T[], limit = 5): T[] {
  return [...albums].sort((a, b) => (b.views ?? 0) - (a.views ?? 0) || b.id - a.id).slice(0, limit);
}

interface SummaryAlbum extends Ranked {
  year: number | null;
  genre: string | null;
  country: string | null;
  cover: string;
}

export interface BandSummary<T> {
  /** YouTube views of every album together. */
  views: number;
  /** First and last year, without the database's 0 for "unknown"; null when none is known. */
  firstYear: number | null;
  lastYear: number | null;
  /** Raw genre values, the most frequent first, without the "no genre" placeholder. */
  genres: string[];
  /** Raw country values, the most frequent first. */
  countries: string[];
  /** The album whose cover fills the hero: the most viewed with a square crop, else the most viewed. */
  best: T | null;
}

/** Values by how many albums have them, most first; ties keep the albums' order. */
function byFrequency(values: (string | null)[]): string[] {
  const counts = new Map<string, number>();
  for (const v of values) {
    const s = v?.trim();
    if (s) counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  return [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)!);
}

export function bandSummary<T extends SummaryAlbum>(albums: T[]): BandSummary<T> {
  const years = albums.map((a) => a.year).filter((y): y is number => !!y && y > 0);
  const ranked = rankPopular(albums, albums.length);
  return {
    views: albums.reduce((sum, a) => sum + (a.views ?? 0), 0),
    firstYear: years.length ? Math.min(...years) : null,
    lastYear: years.length ? Math.max(...years) : null,
    genres: byFrequency(albums.map((a) => (a.genre === NO_GENRE ? null : a.genre))),
    countries: byFrequency(albums.map((a) => a.country)),
    best: ranked.find((a) => coverMode(a.cover) === 'square') ?? ranked[0] ?? null,
  };
}
