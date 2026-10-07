// Regression test for ux-batch-a #19: the country/year facet pages sorted
// strictly alphabetically by band_name, while the genre facet page (same
// kind of listing) is deliberately ordered "upload_date DESC" (see the
// comment above getAlbumsByGenre in db.ts). getAlbumsByCountry/
// getAlbumsByYear now use the same ordering for consistency.
//
// Uses a scratch SQLite DB (not the live reflex.db) with synthetic rows
// chosen so the alphabetical-by-band_name order and the upload_date-DESC
// order are DIFFERENT -- otherwise this would pass vacuously regardless of
// which ORDER BY clause db.ts actually uses (the same mistake the
// slug-collisions tests already document and avoid).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

function buildScratchDb(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'facet-order-'));
  const dbPath = path.join(dir, 'scratch.db');
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE albums (
      id INTEGER PRIMARY KEY,
      band_name TEXT,
      album_title TEXT,
      genre TEXT,
      year INTEGER,
      country TEXT,
      album_artwork_url TEXT,
      youtube_video_id TEXT,
      upload_date TEXT
    );
  `);
  const insert = db.prepare(`
    INSERT INTO albums (id, band_name, album_title, genre, year, country, album_artwork_url, youtube_video_id, upload_date)
    VALUES (@id, @band_name, @album_title, @genre, @year, @country, @album_artwork_url, @youtube_video_id, @upload_date)
  `);
  // Alphabetical-by-band_name order: Apple, Mango, Zebra.
  // upload_date-DESC order:          Mango, Zebra, Apple.
  // The two orders disagree on BOTH the first and last element, so either
  // ORDER BY clause produces a visibly different, easy-to-assert sequence.
  insert.run({ id: 1, band_name: 'Apple', album_title: 'A Album', genre: 'Test Metal', year: 2020, country: 'Testlandia', album_artwork_url: null, youtube_video_id: 'vid1', upload_date: '2020-01-01' });
  insert.run({ id: 2, band_name: 'Mango', album_title: 'M Album', genre: 'Test Metal', year: 2020, country: 'Testlandia', album_artwork_url: null, youtube_video_id: 'vid2', upload_date: '2020-06-01' });
  insert.run({ id: 3, band_name: 'Zebra', album_title: 'Z Album', genre: 'Test Metal', year: 2020, country: 'Testlandia', album_artwork_url: null, youtube_video_id: 'vid3', upload_date: '2020-03-01' });
  db.close();
  return dbPath;
}

test('getAlbumsByCountry orders by upload_date DESC, matching the genre facet convention', async () => {
  const dbPath = buildScratchDb();
  process.env.REFLEX_DB = dbPath;
  const { getAlbumsByCountry } = await import(`../src/lib/db.ts?scratch=country-${Date.now()}`);

  const cards = getAlbumsByCountry('Testlandia');
  // If this reverts to "ORDER BY band_name", the result would be
  // [Apple, Mango, Zebra] instead -- this assertion goes red either way.
  assert.deepEqual(cards.map((c: any) => c.band_name), ['Mango', 'Zebra', 'Apple']);
});

test('getAlbumsByYear orders by upload_date DESC, matching the genre facet convention', async () => {
  const dbPath = buildScratchDb();
  process.env.REFLEX_DB = dbPath;
  const { getAlbumsByYear } = await import(`../src/lib/db.ts?scratch=year-${Date.now()}`);

  const cards = getAlbumsByYear(2020);
  assert.deepEqual(cards.map((c: any) => c.band_name), ['Mango', 'Zebra', 'Apple']);
});
