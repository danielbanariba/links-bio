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
