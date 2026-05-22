// TypeScript interfaces matching the reflex.db schema (albums, tracks, similar_bands).
// These are build-time types only — no runtime overhead.

export interface Album {
  id: number;
  band_name: string;
  album_title: string;
  genre: string | null;
  year: number | null;
  country: string | null;
  album_artwork_url: string | null;
  youtube_video_id: string | null;
  youtube_url: string | null;
  description: string | null;
  release_type: string | null;
  views: number;
  featured: number; // 0 | 1
  upload_date: string | null;
  duration_minutes: number | null;
  spotify_url: string | null;
  bandcamp_url: string | null;
  apple_music_url: string | null;
  metal_archives_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
}

// Lightweight projection used in carousels and grids — pre-computed thumb URL.
export interface Card {
  id: number;
  band_name: string;
  album_title: string;
  genre: string | null;
  year: number | null;
  country: string | null;
  thumb: string;
  youtube_video_id: string | null;
}

export interface Track {
  track_number: number | null;
  track_name: string;
  timestamp: string | null;
  // duration_seconds stored in DB as `timestamp` field formatted "MM:SS"
}

export interface SimilarBand {
  id: number;
  album_id: number;
  band_name: string;
}

export interface Facet {
  value: string;
  count: number;
}

export interface GenreShowcase {
  genre: string;
  count: number;
  albums: Card[];
}

// Row returned by getBrowseIndex — serialised to /browse-index.json for the Search island.
export interface BrowseEntry {
  id: number;
  band_name: string;
  album_title: string;
  genre: string | null;
  country: string | null;
  year: number | null;
  release_type: string | null;
  thumb: string;
}
