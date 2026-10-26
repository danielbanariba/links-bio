// The genre and country tiles' colours, by rank as in the prototype: ten hues
// that all keep white text above 5.2:1, so a row of tiles never turns into ten
// shades of brown. The home's rows, Browse and the facet pages' banners share
// them, so a genre keeps its colour from tile to page.
export type TileKind = 'genre' | 'country';

const PALETTES: Record<TileKind, string[]> = {
  genre: ['#4d7000', '#0068a6', '#9f4500', '#865900', '#a8353a', '#716400', '#007558', '#9e366f', '#724aab', '#00717a'],
  country: ['#716400', '#4d7000', '#865900', '#9f4500', '#a8353a', '#9e366f', '#007558', '#724aab', '#0068a6', '#00717a'],
};

/** The colour of the tile at `rank` (0 = the biggest facet). */
export function tileColor(kind: TileKind, rank: number): string {
  const p = PALETTES[kind];
  return p[((rank % p.length) + p.length) % p.length];
}
