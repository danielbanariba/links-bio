// Pure helper for the muted line under every album card: "country · year · genre".
// Used by components/AlbumCard.astro and the Browse results (islands/Search.tsx), so
// both render the same line. It is a plain function so the decisions can be unit
// tested without mounting a component.
//
// A missing field is skipped together with its separator, so the line never starts,
// ends or doubles up on " · ". What counts as missing:
//   - null, undefined and blank strings;
//   - year 0: the DB's sentinel for "unknown year" (album 1329). It used to print as a
//     literal "0" ("00Honduras") when a caller wrote `{a.year && ...}`; returning a string
//     here means no caller can leak the raw number;
//   - the genre placeholder the sync writes for albums with no genre (see labels.ts):
//     "Unknown genre" under a cover is noise, not information.
// Country and genre go through labels.ts, so the line is in English while the data
// keeps its raw (Spanish) values.
import { countryLabel, genreLabel } from './labels.js';

// The raw placeholder `albums.genre` holds for "no genre" (labels.ts translates it).
const NO_GENRE = 'Género desconocido';

export interface CardMetaInput {
  country?: string | null;
  year?: number | null;
  genre?: string | null;
}

export function formatCardMeta({ country, year, genre }: CardMetaInput): string {
  const rawGenre = genre?.trim() ?? '';
  const parts = [
    countryLabel(country?.trim()),
    year ? String(year) : '',
    rawGenre === NO_GENRE ? '' : genreLabel(rawGenre),
  ];
  return parts.filter(Boolean).join(' · ');
}

export interface HeroMetaInput extends CardMetaInput {
  tracks?: number | null;
  minutes?: number | null;
}

/**
 * The home hero's line, as in the prototype: "Deathcore · United States · 2016 ·
 * 9 tracks · 41 min". Genre first (the hero is about one album, and the genre is
 * what a listener decides on), then the tracklist's size. Same rules for what is
 * missing as formatCardMeta; 0 tracks or 0 minutes means unknown.
 */
export function heroMeta({ genre, country, year, tracks, minutes }: HeroMetaInput): string {
  const rawGenre = genre?.trim() ?? '';
  const parts = [
    rawGenre === NO_GENRE ? '' : genreLabel(rawGenre),
    countryLabel(country?.trim()),
    year ? String(year) : '',
    tracks ? `${tracks} ${tracks === 1 ? 'track' : 'tracks'}` : '',
    minutes ? `${Math.round(minutes)} min` : '',
  ];
  return parts.filter(Boolean).join(' · ');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * "30 Jul 2026" from the database's "2026-07-30 01:00:08.000000". Read from the
 * text, not through Date, so the day never moves with the build machine's time
 * zone. '' when the value is missing or not a date.
 */
export function formatUploadDay(value: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  if (!m) return '';
  const month = MONTHS[Number(m[2]) - 1];
  const day = Number(m[3]);
  return month && day >= 1 && day <= 31 ? `${day} ${month} ${m[1]}` : '';
}
