// getAlbumsByBand, read from a scratch SQLite DB (not the live reflex.db): the
// band page ranks these by views and prints each one's track count.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

let scratchDir = '';
let prevReflexDb: string | undefined;
let getAlbumsByBand: (band: string) => { id: number; views: number; tracks: number; release_type: string | null }[];

before(async () => {
  scratchDir = mkdtempSync(path.join(tmpdir(), 'band-albums-'));
  const dbPath = path.join(scratchDir, 'scratch.db');
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE albums (id INTEGER PRIMARY KEY, band_name TEXT, album_title TEXT, genre TEXT, year INTEGER,
      country TEXT, album_artwork_url TEXT, youtube_video_id TEXT, upload_date TEXT, views INTEGER, release_type TEXT);
    CREATE TABLE tracks (id INTEGER PRIMARY KEY, album_id INTEGER, track_number INTEGER, track_name TEXT, timestamp TEXT);
    INSERT INTO albums VALUES
      (1, 'Alpha', 'Old', 'Death Metal', 2010, 'Alemania', NULL, 'vid1', '2020-01-01', 7, 'Full Album'),
      (2, 'Alpha', 'New', 'Death Metal', 2020, 'Alemania', NULL, 'vid2', '2021-01-01', 90, 'EP'),
      (3, 'Alpha', 'Bare', 'Death Metal', 2015, 'Alemania', NULL, 'vid3', '2022-01-01', NULL, NULL),
      (4, 'Bravo', 'Other', 'Grindcore', 2020, 'Alemania', NULL, 'vid4', '2020-01-01', 5, 'Full Album');
    INSERT INTO tracks (album_id, track_number, track_name, timestamp) VALUES
      (1, 1, 'a', '00:00'), (1, 2, 'b', '03:00'), (1, 3, 'c', '06:00'),
      (2, 1, 'd', '00:00'),
      (4, 1, 'e', '00:00'), (4, 2, 'f', '02:00');
  `);
  db.close();
  prevReflexDb = process.env.REFLEX_DB;
  process.env.REFLEX_DB = dbPath;
  const mod = await import(`../src/lib/db.ts?scratch=band-albums-${Date.now()}`);
  getAlbumsByBand = mod.getAlbumsByBand;
});

after(() => {
  if (prevReflexDb === undefined) delete process.env.REFLEX_DB;
  else process.env.REFLEX_DB = prevReflexDb;
  rmSync(scratchDir, { recursive: true, force: true });
});

test("each of a band's albums carries its own views and track count", () => {
  // Defect: a JOIN that counts the band's tracks on every album, or COUNT(*)
  // over a LEFT JOIN, which gives an album without tracks a count of 1; or no
  // views at all, which ranks every album 0 under Popular.
  const albums = getAlbumsByBand('Alpha');
  assert.deepEqual(
    albums.map((a) => [a.id, a.views, a.tracks, a.release_type]),
    [[2, 90, 1, 'EP'], [3, 0, 0, null], [1, 7, 3, 'Full Album']],
  );
});
