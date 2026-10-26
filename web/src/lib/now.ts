// What the persisted Player is playing, for the parts of a page that follow it:
// the sidebar's Recent list marks it, the home hero shows it. The Player writes it
// as JSON on #np-root[data-now] (a persisted element, so a page that arrives later
// can read it at once) and fires NOW_EVENT on document each time it changes.
// Browser-safe, no imports.
export interface NowInfo {
  id: string; // album id, or the video id when the album id is unknown
  videoId: string;
  title: string; // as shown (displayTitle)
  band: string;
  href: string; // the album page
  cover: string; // square crop or YouTube frame
  meta: string; // "Death Metal · United States · 2016", may be empty
  bandHref: string; // the band page, may be empty
}

export const NOW_EVENT = 'ma:now';

export function readNow(): NowInfo | null {
  const raw = document.getElementById('np-root')?.getAttribute('data-now');
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as NowInfo;
    return v && typeof v.id === 'string' && typeof v.title === 'string' ? v : null;
  } catch {
    return null;
  }
}
