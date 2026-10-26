// Tracks inside one album video. Every album here is ONE long YouTube video and a
// "track" is a start time in it, so the player's segmented progress bar, the
// current track and the track lengths all come from those starts plus the
// video's length. Pure and browser-safe: the album page and the per-album JSON
// read timestamps with tsToSeconds at build time, the Player does the rest.

/** "MM:SS" or "HH:MM:SS" in seconds; 0 for anything else (no timestamp). */
export function tsToSeconds(ts: string | null | undefined): number {
  if (!ts) return 0;
  const parts = ts.split(':').map((p) => parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return 0;
}

/** Where one track starts and ends in the video, in seconds. */
export interface Span {
  start: number;
  end: number;
}

/**
 * The tracks' spans: each runs until the next one starts, the last until the
 * video ends. Empty when the starts cannot be trusted: a start that does not
 * move forward (a tracklist without timestamps has every start at 0), or a last
 * start at or past the end, or an unknown length (0). An empty result means "no
 * segments": the bar is then the album as one piece, never invented tracks.
 */
export function trackSpans(starts: number[], duration: number): Span[] {
  if (starts.length === 0 || !(duration > 0) || !(starts[0] >= 0)) return [];
  for (let i = 1; i < starts.length; i++) if (!(starts[i] > starts[i - 1])) return [];
  if (!(starts[starts.length - 1] < duration)) return [];
  return starts.map((start, i) => ({ start, end: i + 1 < starts.length ? starts[i + 1] : duration }));
}

/**
 * Each track's length for the album page's tracklist: up to the next start, so
 * the last one has none (the database keeps the album's length in whole
 * minutes, too coarse for it). All null when the starts cannot be trusted, by the
 * same rule as trackSpans.
 */
export function trackLengths(starts: number[]): Array<number | null> {
  const valid = starts.length > 0 && starts[0] >= 0 && starts.every((s, i) => i === 0 || s > starts[i - 1]);
  return starts.map((s, i) => (valid && i + 1 < starts.length ? starts[i + 1] - s : null));
}

/**
 * The track playing at `t`: the last one that has started. Before the first
 * start that is the first track, past the end the last; -1 without spans.
 */
export function trackAt(spans: Span[], t: number): number {
  if (spans.length === 0) return -1;
  let i = 0;
  while (i + 1 < spans.length && t >= spans[i + 1].start) i++;
  return i;
}

/** A segment as drawn: its left edge and width, in the bar's own pixels. */
export interface Box {
  left: number;
  width: number;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * The time under the pointer at `x`: the same fraction into the track as `x` is
 * into that track's segment. Segments are proportional to their tracks but sit
 * apart, and a very short track keeps a minimum width, so one linear mapping
 * over the whole bar would land in the wrong place. Before the bar is 0, past it
 * the end, in a gap the nearest edge.
 */
export function timeAtX(spans: Span[], boxes: Box[], x: number): number {
  const n = Math.min(spans.length, boxes.length);
  if (n === 0) return 0;
  if (x <= boxes[0].left) return spans[0].start;
  for (let i = 0; i < n; i++) {
    const b = boxes[i];
    const right = b.left + b.width;
    if (x <= right) {
      if (x >= b.left) return spans[i].start + clamp01((x - b.left) / (b.width || 1)) * (spans[i].end - spans[i].start);
      // In the gap before segment i: the closer edge.
      const prevRight = boxes[i - 1].left + boxes[i - 1].width;
      return x - prevRight <= b.left - x ? spans[i - 1].end : spans[i].start;
    }
  }
  return spans[n - 1].end;
}

/** Where `t` falls on the bar: inside the segment of the track playing then. */
export function xAtTime(spans: Span[], boxes: Box[], t: number): number {
  const i = trackAt(spans, t);
  if (i < 0 || !boxes[i]) return 0;
  const s = spans[i];
  return boxes[i].left + clamp01((t - s.start) / (s.end - s.start || 1)) * boxes[i].width;
}
