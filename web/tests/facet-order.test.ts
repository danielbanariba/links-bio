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
//
// R3-007: also asserts the tie-break. Two rows (Kiwi id=4, Lychee id=5)
// share the SAME upload_date, deliberately inserted in ascending-id order.
// Empirically, "ORDER BY upload_date DESC" alone (no secondary key) returns
// ties in ascending-id/insertion order on SQLite ([Kiwi, Lychee]) -- the
// OPPOSITE of the "upload_date DESC, id DESC" this test expects ([Lychee,
// Kiwi]). So this only passes once db.ts actually orders by id DESC as the
// tiebreak, not by accident of SQLite's scan order.
//
// R3-008: each test removes its own scratch dir and restores REFLEX_DB in
// an `after` hook, instead of leaking a temp directory and a mutated
// process-global env var past the end of the test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

function buildScratchDb(): { dbPath: string; dir: string } {
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
  // Alphabetical-by-band_name order: Apple, Kiwi, Lychee, Mango, Zebra.
  // upload_date-DESC, id-DESC order: Lychee, Kiwi, Mango, Zebra, Apple.
  // The two orders disagree throughout, so either ORDER BY clause --
  // or a missing/wrong tiebreak -- produces a visibly different sequence.
  insert.run({ id: 1, band_name: 'Apple', album_title: 'A Album', genre: 'Test Metal', year: 2020, country: 'Testlandia', album_artwork_url: null, youtube_video_id: 'vid1', upload_date: '2020-01-01' });
  insert.run({ id: 2, band_name: 'Mango', album_title: 'M Album', genre: 'Test Metal', year: 2020, country: 'Testlandia', album_artwork_url: null, youtube_video_id: 'vid2', upload_date: '2020-06-01' });
  insert.run({ id: 3, band_name: 'Zebra', album_title: 'Z Album', genre: 'Test Metal', year: 2020, country: 'Testlandia', album_artwork_url: null, youtube_video_id: 'vid3', upload_date: '2020-03-01' });
  // Tie-break pair: same upload_date as each other, inserted in ascending
  // id order -- see the R3-007 note above for why this direction matters.
  insert.run({ id: 4, band_name: 'Kiwi', album_title: 'K Album', genre: 'Test Metal', year: 2020, country: 'Testlandia', album_artwork_url: null, youtube_video_id: 'vid4', upload_date: '2020-09-01' });
  insert.run({ id: 5, band_name: 'Lychee', album_title: 'L Album', genre: 'Test Metal', year: 2020, country: 'Testlandia', album_artwork_url: null, youtube_video_id: 'vid5', upload_date: '2020-09-01' });
  db.close();
  return { dbPath, dir };
}

test('getAlbumsByCountry orders by upload_date DESC, id DESC, matching the genre facet convention', async (t) => {
  const prevReflexDb = process.env.REFLEX_DB;
  const { dbPath, dir } = buildScratchDb();
  process.env.REFLEX_DB = dbPath;
  t.after(() => {
    process.env.REFLEX_DB = prevReflexDb;
    rmSync(dir, { recursive: true, force: true });
  });

  const { getAlbumsByCountry } = await import(`../src/lib/db.ts?scratch=country-${Date.now()}`);
  const cards = getAlbumsByCountry('Testlandia');
  // If this reverts to "ORDER BY band_name" or drops the ", id DESC"
  // tiebreak, the result changes -- this assertion goes red either way.
  assert.deepEqual(cards.map((c: any) => c.band_name), ['Lychee', 'Kiwi', 'Mango', 'Zebra', 'Apple']);
});

test('getAlbumsByYear orders by upload_date DESC, id DESC, matching the genre facet convention', async (t) => {
  const prevReflexDb = process.env.REFLEX_DB;
  const { dbPath, dir } = buildScratchDb();
  process.env.REFLEX_DB = dbPath;
  t.after(() => {
    process.env.REFLEX_DB = prevReflexDb;
    rmSync(dir, { recursive: true, force: true });
  });

  const { getAlbumsByYear } = await import(`../src/lib/db.ts?scratch=year-${Date.now()}`);
  const cards = getAlbumsByYear(2020);
  assert.deepEqual(cards.map((c: any) => c.band_name), ['Lychee', 'Kiwi', 'Mango', 'Zebra', 'Apple']);
});
