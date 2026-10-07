// Pure helper for the "year · country" meta line shown under an album card
// (Search.tsx's result grid). Extracted so the rendering decision can be unit
// tested without mounting a Preact component.
//
// year=0 is the DB's sentinel for "unknown year" (see album 1329), same as
// null/undefined — db.ts and band/[band].astro already treat it that way
// (`.filter((y): y is number => !!y)`), so a truthy check is the CORRECT
// decision here, not the bug. The actual bug was in how the caller rendered
// that decision: `{a.year && <span>{a.year}</span>}` returns the raw left
// operand (the number 0) when falsy, and JSX/Preact prints a numeric 0 as the
// text "0" — unlike `false`/`null`/`undefined`, which render nothing. Two such
// guards in a row printed "00" before the country name. Returning real
// booleans from here means the caller's `{meta.showYear && <span>...}` always
// guards with an actual boolean, never the number itself.
export interface CardMetaFlags {
  showRow: boolean;
  showYear: boolean;
  showSeparator: boolean;
  showCountry: boolean;
}

export function getCardMeta(
  year: number | null | undefined,
  country: string | null | undefined,
): CardMetaFlags {
  const showYear = !!year;
  const showCountry = !!country;
  return {
    showRow: showYear || showCountry,
    showYear,
    showSeparator: showYear && showCountry,
    showCountry,
  };
}
