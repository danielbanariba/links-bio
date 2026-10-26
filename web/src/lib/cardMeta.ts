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
