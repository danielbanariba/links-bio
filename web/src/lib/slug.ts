// URL slug for band, genre and country pages: the single source of truth,
// imported by BOTH the getStaticPaths that GENERATE those paths and everything
// that links to them (pages at build time, the Search island in the browser),
// so the two can never drift apart. db.ts re-exports it.
// A name with no latin alphanumerics (e.g. Cyrillic "Сын Собаки") collapses to ""
// and crashes the static build with "Missing parameter: band"; fall back to a
// stable ascii slug built from code points so every name yields a valid URL.
export function slugify(value: string): string {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (base) return base;
  return 'u-' + Array.from(value.trim().toLowerCase())
    .map((ch) => ch.codePointAt(0)!.toString(36))
    .join('-');
}
