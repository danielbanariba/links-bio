// title-fit: how the name in a page head (band, genre, country, year) is sized and broken.
//
// The name is data of any length, so PageHead fits its font size to the column: lineChars() says
// how many characters the wider of its two lines holds, and `.fit` (global.css) turns that into
// a font size. A name made of one very long word cannot break at a space; breakLongWord() gives
// it one soft hyphen at the middle, so the break is balanced and shows a hyphen instead of
// cutting the word wherever the line happens to run out.

/** Soft hyphen: invisible unless the line breaks there, where it prints a hyphen. */
export const SHY = '­';

/** A single word up to this many characters of width stays on one line. */
const ONE_LINE = 16;

// Erode has no Cyrillic or CJK, so those fall back to a wider face (1.3). Capitals run wider
// than lowercase (1.2), m and w wider still (1.5), i, l, j and punctuation narrower (0.55);
// a space counts 0.45.
const charWeight = (c: string) =>
  /[^\u0000-ɏ]/.test(c) ? 1.3
  : /[mwMW]/.test(c) ? (c === c.toUpperCase() ? 1.6 : 1.5)
  : /[ijl.,'!:;|]/.test(c) ? 0.55
  : /[tfrI]/.test(c) ? 0.75
  : /\p{Lu}/u.test(c) ? 1.2 : 1;

/** Width of a word in characters; accents and combining marks add none. */
export const wordWeight = (w: string) =>
  [...w.normalize('NFD').replace(/\p{M}/gu, '')].reduce((n, c) => n + charWeight(c), 0);

// A line may break at a space or after a slash ("Goregrind/Grindcore" stacks on two lines).
const pieces = (name: string) => name.split(/\s+|(?<=\/)/).filter(Boolean);

/** How many characters of width the wider of the name's two lines holds. `extra` is a leading
 *  flag's width, which sits on the first line. */
export function lineChars(name: string, extra: number): number {
  const w = pieces(name).map(wordWeight);
  if (w.length < 2) {
    // One unbreakable word: up to 16 characters it stays on one line; a longer one is cut
    // into two (see breakLongWord), rather than shrunk until it is the size of body text.
    const one = (w[0] ?? 1) + extra;
    return one > ONE_LINE ? Math.ceil((one / 2) * 1.08 * 10) / 10 : Math.max(1, one);
  }
  let best = Infinity;
  for (let k = 1; k < w.length; k++) {
    const first = w.slice(0, k).reduce((n, x) => n + x, 0) + 0.45 * (k - 1) + extra;
    const rest = w.slice(k).reduce((n, x) => n + x, 0) + 0.45 * (w.length - k - 1);
    best = Math.min(best, Math.max(first, rest));
  }
  return Math.ceil(best * 10) / 10;
}

/** The name with one soft hyphen at its weighted middle, when it is a single word too long for
 *  one line; any other name comes back unchanged. */
export function breakLongWord(name: string, extra = 0): string {
  const w = pieces(name);
  if (w.length !== 1 || wordWeight(w[0]) + extra <= ONE_LINE) return name;
  const chars = [...name];
  const half = wordWeight(name) / 2;
  let acc = 0;
  let cut = 0;
  for (let i = 0; i < chars.length - 1; i++) {
    acc += wordWeight(chars[i]);
    if (acc >= half) { cut = i + 1; break; }
  }
  // Never leave a combining mark at the head of the second line.
  while (cut < chars.length && /\p{M}/u.test(chars[cut])) cut++;
  if (cut <= 0 || cut >= chars.length) return name;
  return chars.slice(0, cut).join('') + SHY + chars.slice(cut).join('');
}
