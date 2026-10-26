// The sidebar's "Recent" list: the albums this browser played, newest first.
// It lives in localStorage, which can be absent, blocked (a SecurityError on
// access in some private modes), full, or hold whatever an older build or a
// visitor wrote there. So reads are validated entry by entry, every access is
// wrapped, and the page renders the same without it (the list stays empty).
// Pure apart from the storage object it is handed, so it is unit-tested.

export interface RecentEntry {
  id: string; // album id (or the video id when the album id is unknown)
  title: string; // as shown (displayTitle)
  band: string;
  href: string; // /metal-archive/album/<id>
  cover: string; // square crop or YouTube frame (coverMode decides how it is drawn)
}

export const RECENT_KEY = 'ma:recent';
export const RECENT_MAX = 6;

type Reader = { getItem(key: string): string | null };
type Writer = { setItem(key: string, value: string): void };

const isText = (v: unknown): v is string => typeof v === 'string';
// Only links inside the archive: the list is rendered as <a href>, so a stored
// javascript: or off-site URL must never become one.
const isArchiveHref = (v: unknown): v is string => isText(v) && v.startsWith('/metal-archive/');

function isEntry(v: unknown): v is RecentEntry {
  if (!v || typeof v !== 'object') return false;
  const e = v as Record<string, unknown>;
  return (
    isText(e.id) && e.id.trim() !== '' &&
    isText(e.title) && e.title.trim() !== '' &&
    isText(e.band) && isText(e.cover) && isArchiveHref(e.href)
  );
}

/** The list with `entry` first, any older copy of it removed, at most `max` long. */
export function addRecent(list: readonly RecentEntry[], entry: RecentEntry, max = RECENT_MAX): RecentEntry[] {
  if (!isEntry(entry)) return [...list];
  return [entry, ...list.filter((e) => e.id !== entry.id)].slice(0, max);
}

/** A stored value back into entries; anything malformed is dropped. */
export function parseRecent(raw: string | null | undefined, max = RECENT_MAX): RecentEntry[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data
    .filter(isEntry)
    .map(({ id, title, band, href, cover }) => ({ id, title, band, href, cover }))
    .slice(0, max);
}

export function loadRecent(storage: Reader | null | undefined): RecentEntry[] {
  if (!storage) return [];
  try {
    return parseRecent(storage.getItem(RECENT_KEY));
  } catch {
    return [];
  }
}

export function saveRecent(storage: Writer | null | undefined, list: readonly RecentEntry[]): void {
  if (!storage) return;
  try {
    storage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // Full or blocked: the list still shows for this page view, it just is not kept.
  }
}

/** Record a play: load, add, save. Returns the new list either way. */
export function rememberRecent(storage: (Reader & Writer) | null | undefined, entry: RecentEntry): RecentEntry[] {
  const list = addRecent(loadRecent(storage), entry);
  saveRecent(storage, list);
  return list;
}

/** window.localStorage, or null where reading the property itself throws. */
export function browserStorage(): (Reader & Writer) | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Fired on document after the list changes, so the sidebar can redraw it. */
export const RECENT_EVENT = 'ma:recent';
