// Single read-only better-sqlite3 connection for the entire Astro build.
// ALL DB access goes through this module — no inline DB opens in pages.
//
// Path resolution: env REFLEX_DB > ../reflex.db (cwd-relative, works when
// `npm run build` runs from web/) > ./reflex.db.
// NOTE: import.meta.url is unreliable once Astro bundles this into dist/.prerender/
// so we use process.cwd()-relative paths (proven by the spike POC).

import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { thumb } from './thumb.js';
import type { Album, Card, Track, SimilarBand, Facet, GenreShowcase, BrowseEntry } from './types.js';

const candidates = [
  process.env.REFLEX_DB,
  resolve(process.cwd(), '../reflex.db'),
  resolve(process.cwd(), 'reflex.db'),
].filter(Boolean) as string[];

const DB_PATH = candidates.find((p) => existsSync(p));
if (!DB_PATH) {
  throw new Error(`reflex.db not found. Tried: ${candidates.join(', ')}`);
}

const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });

// Columns used for Card projections — keeps SELECT minimal.
const CARD_COLS = `id, band_name, album_title, genre, year, country, album_artwork_url, youtube_video_id`;

// Live-recording detection. These are Daniel's OWN live sets (e.g.
// "Megametal (Live in Honduras...)"), not official studio albums, so they must
// be visually separated: excluded from the main home/browse feeds and shown in
// their own "Live Recordings" section. Match is case-insensitive (SQLite LIKE
// is case-insensitive for ASCII) on the album title containing "live in" or
// an opening "(live".
const LIVE_MATCH = `(album_title LIKE '%live in%' OR album_title LIKE '%(live%')`;
// Reusable predicate to EXCLUDE live recordings from the main feeds.
const NOT_LIVE = `NOT ${LIVE_MATCH}`;

// True when an album title denotes a live recording (used by browse tagging).
export function isLiveRecording(title: string | null | undefined): boolean {
  if (!title) return false;
  const t = title.toLowerCase();
  return t.includes('live in') || t.includes('(live');
}

function toCard(row: any): Card {
  return {
    id: row.id,
    band_name: row.band_name,
    album_title: row.album_title,
    genre: row.genre ?? null,
    year: row.year ?? null,
    country: row.country ?? null,
    thumb: thumb(row.album_artwork_url),
    youtube_video_id: row.youtube_video_id ?? null,
  };
}

// ─── Home page queries ────────────────────────────────────────────────────────

// Featured hero — random featured album (fallback: any random album).
export function getFeaturedAlbum(): (Card & { description: string | null; youtube_url: string | null }) | null {
  let row: any = db
    .prepare(`SELECT ${CARD_COLS}, description, youtube_url FROM albums WHERE featured = 1 ORDER BY RANDOM() LIMIT 1`)
    .get();
  if (!row) {
    row = db.prepare(`SELECT ${CARD_COLS}, description, youtube_url FROM albums ORDER BY RANDOM() LIMIT 1`).get();
  }
  if (!row) return null;
  return { ...toCard(row), description: row.description ?? null, youtube_url: row.youtube_url ?? null };
}

// "This week in the archive" — last 7 days by upload_date, fallback to 30 days.
// Kept available for reuse; the home page no longer renders this carousel.
export function getThisWeek(): Card[] {
  let rows: any[] = db
    .prepare(
      `SELECT ${CARD_COLS} FROM albums
       WHERE upload_date >= datetime('now', '-7 days')
       ORDER BY upload_date DESC LIMIT 8`
    )
    .all();
  if (rows.length < 4) {
    rows = db
      .prepare(
        `SELECT ${CARD_COLS} FROM albums
         WHERE upload_date >= datetime('now', '-30 days')
         ORDER BY upload_date DESC LIMIT 8`
      )
      .all();
  }
  return rows.map(toCard);
}

// Editor's picks — featured albums, latest first. Live recordings excluded.
export function getEditorPicks(): Card[] {
  const rows: any[] = db
    .prepare(`SELECT ${CARD_COLS} FROM albums WHERE featured = 1 AND ${NOT_LIVE} ORDER BY upload_date DESC LIMIT 8`)
    .all();
  return rows.map(toCard);
}

// Hidden gems — non-featured, low view count, random order. Live recordings excluded.
export function getHiddenGems(): Card[] {
  const rows: any[] = db
    .prepare(
      `SELECT ${CARD_COLS} FROM albums
       WHERE featured = 0 AND (views IS NULL OR views < 500) AND ${NOT_LIVE}
       ORDER BY RANDOM() LIMIT 8`
    )
    .all();
  return rows.map(toCard);
}

// Live recordings — Daniel's own live sets, surfaced in their own home section.
export function getLiveRecordings(limit = 12): Card[] {
  const rows: any[] = db
    .prepare(
      `SELECT ${CARD_COLS} FROM albums
       WHERE ${LIVE_MATCH}
       ORDER BY year DESC, upload_date DESC LIMIT ?`
    )
    .all(limit);
  return rows.map(toCard);
}

// Country rotation — random selection of distinct countries with one random
// (non-live) album each. Only countries that actually have a non-live album are
// considered, so the sampled album below can never be null.
export function getCountryRotation(n = 6): Array<{ country: string; album: Card }> {
  const countries: any[] = db
    .prepare(
      `SELECT country FROM albums
       WHERE country IS NOT NULL AND country != '' AND ${NOT_LIVE}
       GROUP BY country ORDER BY RANDOM() LIMIT ?`
    )
    .all(n);
  return countries
    .map((c) => {
      const row: any = db
        .prepare(`SELECT ${CARD_COLS} FROM albums WHERE country = ? AND ${NOT_LIVE} ORDER BY RANDOM() LIMIT 1`)
        .get(c.country);
      return row ? { country: c.country, album: toCard(row) } : null;
    })
    .filter((x): x is { country: string; album: Card } => x !== null);
}

// Top N genres by album count, 8 random albums each. Live recordings are
// excluded from both the genre ranking and the sampled covers so showcases
// stay official-album only.
export function getGenreShowcases(n = 2): GenreShowcase[] {
  const genres: any[] = db
    .prepare(
      `SELECT genre, COUNT(id) c FROM albums
       WHERE genre != '' AND genre IS NOT NULL AND ${NOT_LIVE}
       GROUP BY genre ORDER BY c DESC LIMIT ?`
    )
    .all(n);
  return genres.map((g) => {
    const albums: any[] = db
      .prepare(`SELECT ${CARD_COLS} FROM albums WHERE genre = ? AND ${NOT_LIVE} ORDER BY RANDOM() LIMIT 8`)
      .all(g.genre);
    return { genre: g.genre, count: g.c, albums: albums.map(toCard) };
  });
}

// ─── Album detail queries ─────────────────────────────────────────────────────

export function getAlbum(id: number): Album | null {
  // Column list mirrors the albums schema exactly. duration_minutes (NOT
  // "duration") and all six streaming URLs are required by the detail page +
  // streaming links section.
  const row: any = db
    .prepare(
      `SELECT id, band_name, album_title, genre, year, country,
              album_artwork_url, youtube_video_id, youtube_url,
              description, release_type, views, featured, upload_date,
              duration_minutes,
              spotify_url, bandcamp_url, apple_music_url,
              metal_archives_url, facebook_url, instagram_url
       FROM albums WHERE id = ?`
    )
    .get(id);
  return row ?? null;
}

export function getTracks(albumId: number): Track[] {
  return db
    .prepare(
      `SELECT track_number, track_name, timestamp
       FROM tracks WHERE album_id = ? ORDER BY track_number`
    )
    .all(albumId) as Track[];
}

export function getSimilarBands(albumId: number): SimilarBand[] {
  // The DB column is similar_band_name (see models/similar_band.py); alias it to
  // band_name so callers get a clean shape.
  const rows: any[] = db
    .prepare(`SELECT id, album_id, similar_band_name FROM similar_bands WHERE album_id = ? ORDER BY id`)
    .all(albumId);
  return rows.map((r) => ({ id: r.id, album_id: r.album_id, band_name: r.similar_band_name ?? '' }));
}

// Similar albums — same genre, excluding the current album, random order.
export function getSimilarAlbums(genre: string | null, excludeId: number): Card[] {
  if (!genre) return [];
  const rows: any[] = db
    .prepare(
      `SELECT ${CARD_COLS} FROM albums
       WHERE genre = ? AND id != ? ORDER BY RANDOM() LIMIT 8`
    )
    .all(genre, excludeId);
  return rows.map(toCard);
}

// "Keep exploring" — random albums excluding the current one.
export function getMoreToExplore(excludeId: number): Card[] {
  const rows: any[] = db
    .prepare(`SELECT ${CARD_COLS} FROM albums WHERE id != ? ORDER BY RANDOM() LIMIT 8`)
    .all(excludeId);
  return rows.map(toCard);
}

// ─── Facet queries (getStaticPaths for genre/country/year pages) ──────────────

export function getAlbumsByGenre(genre: string): Card[] {
  const rows: any[] = db
    .prepare(`SELECT ${CARD_COLS} FROM albums WHERE genre = ? ORDER BY band_name`)
    .all(genre);
  return rows.map(toCard);
}

export function getAlbumsByCountry(country: string): Card[] {
  const rows: any[] = db
    .prepare(`SELECT ${CARD_COLS} FROM albums WHERE country = ? ORDER BY band_name`)
    .all(country);
  return rows.map(toCard);
}

export function getAlbumsByYear(year: number): Card[] {
  const rows: any[] = db
    .prepare(`SELECT ${CARD_COLS} FROM albums WHERE year = ? ORDER BY band_name`)
    .all(year);
  return rows.map(toCard);
}

export function getAllGenres(): Facet[] {
  return db
    .prepare(
      `SELECT genre AS value, COUNT(id) AS count FROM albums
       WHERE genre IS NOT NULL AND genre != ''
       GROUP BY genre ORDER BY count DESC`
    )
    .all() as Facet[];
}

export function getAllCountries(): Facet[] {
  return db
    .prepare(
      `SELECT country AS value, COUNT(id) AS count FROM albums
       WHERE country IS NOT NULL AND country != ''
       GROUP BY country ORDER BY count DESC`
    )
    .all() as Facet[];
}

export function getAllYears(): Facet[] {
  return db
    .prepare(
      `SELECT year AS value, COUNT(id) AS count FROM albums
       WHERE year IS NOT NULL
       GROUP BY year ORDER BY year DESC`
    )
    .all() as Facet[];
}

// ─── Album navigation ─────────────────────────────────────────────────────────

// All album IDs — used by album/[id].astro getStaticPaths().
export function getAllAlbumIds(): number[] {
  const rows: any[] = db.prepare(`SELECT id FROM albums ORDER BY id`).all();
  return rows.map((r) => r.id);
}

// ─── Band queries ─────────────────────────────────────────────────────────────

// Bands that have 2+ albums — used for band page getStaticPaths() and to know
// which band names are clickable on album detail pages.
export interface BandEntry {
  band_name: string;
  count: number;
}

export function getBandsWithMultipleAlbums(): BandEntry[] {
  return db
    .prepare(
      `SELECT band_name, COUNT(id) AS count FROM albums
       WHERE band_name IS NOT NULL AND band_name != ''
       GROUP BY band_name HAVING count >= 2 ORDER BY band_name`
    )
    .all() as BandEntry[];
}

// All albums for a given band, newest-first so the most recent work is prominent.
// Live recordings are included but separated on the band page.
export function getAlbumsByBand(bandName: string): Card[] {
  const rows: any[] = db
    .prepare(
      `SELECT ${CARD_COLS} FROM albums
       WHERE band_name = ? ORDER BY year DESC, upload_date DESC`
    )
    .all(bandName);
  return rows.map(toCard);
}

// Returns the number of albums by the given band. Used on album detail pages to
// decide whether the band name should be a clickable link.
export function getBandAlbumCount(bandName: string): number {
  const row: any = db
    .prepare(`SELECT COUNT(id) AS count FROM albums WHERE band_name = ?`)
    .get(bandName);
  return row?.count ?? 0;
}

// ─── Browse index ─────────────────────────────────────────────────────────────

// Lightweight index for the client-side Search island.
// Written to public/browse-index.json during build.
export function getBrowseIndex(): BrowseEntry[] {
  const rows: any[] = db
    .prepare(
      `SELECT id, band_name, album_title, genre, country, year, release_type, album_artwork_url
       FROM albums ORDER BY band_name`
    )
    .all();
  return rows.map((r) => ({
    id: r.id,
    band_name: r.band_name,
    album_title: r.album_title,
    genre: r.genre ?? null,
    country: r.country ?? null,
    year: r.year ?? null,
    release_type: r.release_type ?? null,
    thumb: thumb(r.album_artwork_url),
  }));
}
