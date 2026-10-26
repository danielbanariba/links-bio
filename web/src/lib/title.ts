// The album title as the archive SHOWS it (cards, rows, the hero, the player).
// Many uploads end in "(Full Álbum)" / "(Full Album)": true of every entry on a
// site of full albums, so it is noise under a cover. Display only: the DB, the
// album URLs and each page's <title> keep the raw value. Pure and browser-safe,
// so the build and the islands share it.

// The suffix at the END of a title, with what usually sits in front of it: spaces,
// one dash and any number of opening parentheses ("Ventriloquist -    (Full Album)",
// "Megela'a Rock ((Full Album))", "...Old Blood...Full Album)"). "Full" alone, as in
// "Raging Full On", never matches: "album" has to follow it.
const FULL_ALBUM_SUFFIX = /\s*[-–—]?\s*\(*\s*full\s*[-\s]?\s*[aá]lbum\s*\)*\s*$/iu;

export function displayTitle(title: string | null | undefined): string {
  const raw = (title ?? '').trim();
  const shown = raw.replace(FULL_ALBUM_SUFFIX, '').trim();
  // A title that is nothing but the suffix keeps it: an empty title is worse.
  return shown || raw;
}
