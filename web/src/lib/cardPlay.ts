// The data attributes that make an element a ▶ for the persisted Player
// (islands/Player.tsx reads them in itemFromCard). Build-time only: it reads the
// cover colour cache and the database. Album cards, the right panel's Most played
// rows and the home hero all start an album through these, so the Player gets the
// same facts from each: the title as shown, the cover to draw (square crop or
// frame), a meta line and the band's page for the home hero, and the accent.
import type { Card } from './types.js';
import { encodeAccent } from './accent.js';
import { getAlbumAccent } from './vibrant.js';
import { displayTitle } from './title.js';
import { formatCardMeta } from './cardMeta.js';
import { getBandPageNameSet, slugify } from './db.js';

let bandPages: Set<string> | null = null;

/** The band's page when it has one (2+ albums), else a Browse search for it. */
export function bandHref(band: string): string {
  bandPages ??= getBandPageNameSet();
  return bandPages.has(band)
    ? `/metal-archive/band/${slugify(band)}`
    : `/metal-archive/browse?q=${encodeURIComponent(band)}`;
}

/** null when the album has no video: there is nothing to play. */
export async function playAttrs(album: Card): Promise<Record<string, string> | null> {
  const videoId = (album.youtube_video_id || '').trim();
  if (!videoId) return null;
  const accent = await getAlbumAccent({ videoId, thumbUrl: album.thumb });
  return {
    'data-play-card': '',
    'data-video-id': videoId,
    'data-album-id': String(album.id),
    'data-band': album.band_name,
    'data-title': displayTitle(album.album_title),
    'data-thumb': album.thumb || '',
    'data-cover': album.cover || album.thumb || '',
    'data-href': `/metal-archive/album/${album.id}`,
    'data-meta': formatCardMeta(album),
    'data-band-href': bandHref(album.band_name),
    ...(accent ? { 'data-accent': encodeAccent(accent) } : {}),
  };
}
