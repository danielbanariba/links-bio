// What a typed query finds on the Browse page (islands/Search.tsx), over the
// browse-index entries: albums ranked by how well they match, the bands that have
// a page, the genre and country pages, and the top result. Pure and browser-safe.
//
// A match scores 3 when the text starts with the query, 2 when one of its words
// does, 1 when it only contains it. An album's title and band count three times
// its genre or country, so "death" puts the band Deathtopia and the album "Path of
// Death" before every Death Metal album; equal scores go to the most viewed.
import { countryFlag, countryLabel, genreLabel } from './labels.js';
import { slugify } from './slug.js';
import { isLiveRecording } from './live.js';
import { displayTitle } from './title.js';
import { coverMode } from './coverDisplay.js';
import type { BrowseEntry } from './types.js';

/** Fired on document each time the Search island rewrites the URL in place
 *  (history.replaceState fires nothing), so components/ArchiveChrome.astro can
 *  re-mark Search, Genres or Countries in the sidebar. */
export const SEARCH_URL_EVENT = 'ma:search-url';

/** Lowercase, without accents: "Motörhead" and "motorhead" are the same query. */
export function normalize(s: string | null | undefined): string {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** 3: starts with the query; 2: a word starts with it; 1: contains it; 0: no match. */
export function matchScore(text: string | null | undefined, n: string): number {
  const t = normalize(text);
  if (!t || !n) return 0;
  if (t.startsWith(n)) return 3;
  if (t.split(/[^\p{L}\p{N}]+/u).some((w) => w.startsWith(n))) return 2;
  return t.includes(n) ? 1 : 0;
}

const byViews = (a: { views?: number | null; id: number }, b: { views?: number | null; id: number }) =>
  (b.views ?? 0) - (a.views ?? 0) || b.id - a.id;

/** The albums that match, best first. Empty for an empty query. */
export function searchAlbums<T extends BrowseEntry>(entries: T[], q: string): T[] {
  const n = normalize(q);
  if (!n) return [];
  const scored: { a: T; s: number }[] = [];
  for (const a of entries) {
    const s = Math.max(
      matchScore(displayTitle(a.album_title), n) * 3,
      matchScore(a.band_name, n) * 3,
      matchScore(a.genre, n),
      matchScore(genreLabel(a.genre), n),
      matchScore(a.country, n),
      matchScore(countryLabel(a.country), n),
      a.year && String(a.year) === n ? 2 : 0,
    );
    if (s > 0) scored.push({ a, s });
  }
  return scored.sort((x, y) => y.s - x.s || byViews(x.a, y.a)).map((x) => x.a);
}

export interface BandHit {
  name: string;
  albums: number;
  views: number;
  /** The most viewed album's square crop, else the most viewed album's frame. */
  cover: string;
  href: string;
}

/**
 * The bands whose name matches, best first: only the ones with a page, which the
 * build makes for two or more albums under the exact same name.
 */
export function searchBands(entries: BrowseEntry[], q: string): BandHit[] {
  const n = normalize(q);
  if (!n) return [];
  const groups = new Map<string, BrowseEntry[]>();
  for (const a of entries) {
    if (!a.band_name || matchScore(a.band_name, n) === 0) continue;
    const list = groups.get(a.band_name);
    if (list) list.push(a);
    else groups.set(a.band_name, [a]);
  }
  const hits: (BandHit & { s: number })[] = [];
  for (const [name, list] of groups) {
    if (list.length < 2) continue;
    const ranked = list.slice().sort(byViews);
    const best = ranked.find((a) => coverMode(a.cover) === 'square') ?? ranked[0];
    hits.push({
      name,
      albums: list.length,
      views: list.reduce((sum, a) => sum + (a.views ?? 0), 0),
      cover: best.cover || best.thumb,
      href: `/metal-archive/band/${slugify(name)}`,
      s: matchScore(name, n),
    });
  }
  return hits
    .sort((a, b) => b.s - a.s || b.views - a.views || a.name.localeCompare(b.name))
    .map(({ s: _s, ...hit }) => hit);
}

export interface FacetHit {
  kind: 'genre' | 'country';
  value: string;
  label: string;
  flag: string;
  count: number;
  href: string;
}

/**
 * The genre and country pages whose name matches, in English or as stored. Counted
 * without live sets, like the pages themselves, so a value only a live set has
 * (it has no page) is not offered. Values that share a slug share a page.
 */
export function searchFacets(entries: BrowseEntry[], q: string): FacetHit[] {
  const n = normalize(q);
  if (!n) return [];
  const hits: (FacetHit & { s: number })[] = [];
  for (const kind of ['genre', 'country'] as const) {
    const groups = new Map<string, Map<string, number>>();
    for (const a of entries) {
      const value = (kind === 'genre' ? a.genre : a.country)?.trim();
      if (!value || isLiveRecording(a.album_title)) continue;
      const slug = slugify(value);
      const values = groups.get(slug) ?? new Map<string, number>();
      values.set(value, (values.get(value) ?? 0) + 1);
      groups.set(slug, values);
    }
    for (const [slug, values] of groups) {
      const [value] = [...values.entries()].sort((x, y) => y[1] - x[1])[0];
      const label = kind === 'genre' ? genreLabel(value) : countryLabel(value);
      const s = Math.max(...[...values.keys()].map((v) => matchScore(v, n)), matchScore(label, n));
      if (s === 0) continue;
      const count = [...values.values()].reduce((sum, c) => sum + c, 0);
      hits.push({
        kind,
        value,
        label,
        flag: kind === 'country' ? countryFlag(value) : '',
        count,
        href: `/metal-archive/${kind}/${slug}`,
        s,
      });
    }
  }
  return hits.sort((a, b) => b.s - a.s || b.count - a.count).map(({ s: _s, ...hit }) => hit);
}

export type TopResult = { kind: 'band'; band: BandHit } | { kind: 'album'; album: BrowseEntry };

/**
 * The band when its name starts with the query (the band is what was typed),
 * else the best album; null without a query or a match.
 */
export function topResult(q: string, bands: BandHit[], albums: BrowseEntry[]): TopResult | null {
  const n = normalize(q);
  if (!n) return null;
  const band = bands[0];
  if (band && normalize(band.name).startsWith(n)) return { kind: 'band', band };
  if (albums[0]) return { kind: 'album', album: albums[0] };
  return band ? { kind: 'band', band } : null;
}
