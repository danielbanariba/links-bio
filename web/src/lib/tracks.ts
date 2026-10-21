// Track timestamps and lengths for the album tracklist (build time, pure functions).
//
// Every album is ONE long YouTube video. A track's timestamp is where it STARTS, so a
// track's length is the gap to the next start. The last track runs to the end of the
// video, whose length is known only to the minute (`duration_minutes` is rounded), so
// that length is an ESTIMATE and is printed as one ("~6 min"), never as exact m:ss.

/** "MM:SS", "H:MM:SS" or bare seconds to seconds. Anything unreadable is 0. */
export function tsToSeconds(ts: string | null | undefined): number {
  if (!ts) return 0;
  const parts = ts.split(':').map((p) => parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return 0;
}

/** Seconds as a clock: "4:07", or "1:02:05" once there are hours. */
export function clock(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export interface TrackLength {
  seconds: number;
  /** True when the length comes from the minute-rounded total of the video. */
  estimate: boolean;
}

/** A trailing timestamp this close to the end of the video is more likely noise than a track. */
const MIN_LAST_TRACK_SECONDS = 15;

/**
 * Length of each track, or null when it cannot be told.
 *
 * Starts that do not strictly rise (two tracks without a timestamp both read 0, or a
 * start that goes backwards) say nothing about lengths, so every entry is null. Otherwise
 * each track but the last is the exact gap to the next start. The last (or only) track is
 * what is left of the video from its start: an estimate, and null when less than
 * MIN_LAST_TRACK_SECONDS remain or the video's length is unknown.
 */
export function trackLengths(starts: number[], albumSeconds: number | null | undefined): (TrackLength | null)[] {
  const rising = starts.every((s, i) => i === 0 || s > starts[i - 1]);
  if (!rising) return starts.map(() => null);
  const total = albumSeconds ?? 0;
  return starts.map((start, i) => {
    if (i + 1 < starts.length) return { seconds: starts[i + 1] - start, estimate: false };
    const left = total - start;
    return left >= MIN_LAST_TRACK_SECONDS ? { seconds: left, estimate: true } : null;
  });
}

/** What the tracklist prints: "3:20" for an exact length, "~6 min" for an estimate, "" for none. */
export function lengthLabel(len: TrackLength | null): string {
  if (!len) return '';
  if (!len.estimate) return clock(len.seconds);
  return `~${Math.max(1, Math.round(len.seconds / 60))} min`;
}
