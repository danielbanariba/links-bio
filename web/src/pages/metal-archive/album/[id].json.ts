// /metal-archive/album/<id>.json: the now-playing view's facts about one album
// (lib/albumInfo.ts). The Player fetches it when the album starts, from any page,
// so a card's ▶ shows the tracks and the genre too, not only the album page's own
// Play. Prerendered like every page here (output: 'static'): plain files on
// Vercel, no runtime. Not HTML and not in the sitemap: the page set is unchanged.
import type { APIRoute } from 'astro';
import { getAllAlbumIds, getAlbum, getTracks, slugify } from '../../../lib/db.js';
import { countryLabel, genreLabel } from '../../../lib/labels.js';
import { NO_GENRE } from '../../../lib/cardMeta.js';
import { tsToSeconds } from '../../../lib/segments.js';
import type { AlbumInfo } from '../../../lib/albumInfo.js';

export function getStaticPaths() {
  return getAllAlbumIds().map((id) => ({ params: { id: String(id) } }));
}

export const GET: APIRoute = ({ params }) => {
  const album = getAlbum(Number(params.id));
  if (!album) throw new Error(`Album ${params.id} not found at build time`);
  const genre = album.genre?.trim() ?? '';
  const info: AlbumInfo = {
    tracks: getTracks(album.id).map((t) => ({ name: t.track_name, seconds: tsToSeconds(t.timestamp) })),
    meta: [album.release_type?.trim(), album.year ? String(album.year) : '', countryLabel(album.country?.trim())]
      .filter(Boolean)
      .join(' · '),
    genre: genre && genre !== NO_GENRE ? { label: genreLabel(genre), href: `/metal-archive/genre/${slugify(genre)}` } : null,
    minutes: album.duration_minutes || null,
  };
  return new Response(JSON.stringify(info), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
