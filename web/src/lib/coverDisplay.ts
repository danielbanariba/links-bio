// How a card, a row or the player draws an album's image. Pure and browser-safe
// (no imports), so the build, the Search island and the shell's scripts share it.
//
// The covers step (lib/cover.ts) writes a square crop to /covers/<videoId>.webp
// when a clean square exists; db.ts falls back to the 16:9 YouTube frame
// otherwise (761 albums carry a "full" override, plus any album whose crop is
// missing). A frame must be shown WHOLE: letterboxed in the square over a
// blurred, darkened copy of itself, never centre-cropped, because the cover art
// in those frames is rarely in the middle.
export type CoverMode = 'square' | 'frame' | 'none';

// Same id rule as cover.ts isVideoId, anchored to the covers folder.
const SQUARE_CROP = /^\/covers\/[A-Za-z0-9_-]{6,20}\.webp$/;

export function coverMode(src: string | null | undefined): CoverMode {
  const s = (src ?? '').trim();
  if (!s) return 'none';
  return SQUARE_CROP.test(s) ? 'square' : 'frame';
}

/**
 * The covers fanned on a home genre or country tile: the first `n` square crops
 * in the order given (most viewed first), one per band so a prolific band does
 * not fill the tile alone. Frames are skipped: a 16:9 frame in a tile-sized
 * square could only be cropped or shrunk to a sliver.
 */
export function pickCollage(rows: { band_name: string; cover: string }[], n: number): string[] {
  const bands = new Set<string>();
  const picks: string[] = [];
  for (const r of rows) {
    if (picks.length >= n) break;
    if (bands.has(r.band_name) || coverMode(r.cover) !== 'square') continue;
    bands.add(r.band_name);
    picks.push(r.cover);
  }
  return picks;
}
