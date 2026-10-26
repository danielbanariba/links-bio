// getMostPlayed(limit) feeds the home's "Most played" row.
//
// Uses a scratch SQLite DB (not the live reflex.db) whose rows are chosen so
// that each rule can be broken independently:
//   - a live set with the HIGHEST views (a missing NOT_LIVE would put it first),
//     in both title spellings the predicate covers ("live in" and "(live");
//   - an album with 0 views and one with NULL views (a missing views > 0 only
//     shows when the limit is large enough to reach them);
//   - two albums tied on views, inserted in ascending-id order (a missing id
//     tie-break leaves SQLite's scan order, [2, 3], instead of [3, 2]);
//   - six eligible albums, so a limit of 4 really truncates.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

function buildScratchDb(): { dbPath: string; dir: string } {
  const dir = mkdtempSync(path.join(tmpdir(), 'most-played-'));
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
      upload_date TEXT,
      views INTEGER
    );
  `);
  const insert = db.prepare(`
    INSERT INTO albums (id, band_name, album_title, genre, year, country, album_artwork_url, youtube_video_id, upload_date, views)
    VALUES (@id, @band, @title, 'Test Metal', 2020, 'Testlandia', NULL, @vid, '2020-01-01', @views)
  `);
  const row = (id: number, band: string, title: string, views: number | null) =>
    insert.run({ id, band, title, vid: `vid${id}`, views });

  row(1, 'Alpha', 'A Album', 500);
  row(2, 'Bravo', 'B Album', 900);              // tied with 3, lower id
  row(3, 'Charlie', 'C Album', 900);            // tied with 2, higher id -> first
  row(4, 'Delta', 'D Album', 100);
  row(5, 'Echo', 'Echo (Live in Honduras)', 99999);   // live: "live in"
  row(6, 'Foxtrot', 'F Album', 0);              // 0 views -> not "played"
  row(7, 'Golf', 'G Album', null);              // NULL views -> not "played"
  row(8, 'Hotel', 'H Album', 50);
  row(9, 'India', 'India (Live at Wacken)', 80000);   // live: "(live"
  row(10, 'Juliet', 'J Album', 700);
  db.close();
  return { dbPath, dir };
}

type Card = { id: number; youtube_video_id: string | null };
let getMostPlayed: (limit: number) => Card[];
let scratchDir = '';
let prevReflexDb: string | undefined;

before(async () => {
  prevReflexDb = process.env.REFLEX_DB;
  const { dbPath, dir } = buildScratchDb();
  scratchDir = dir;
  process.env.REFLEX_DB = dbPath;
  const mod = await import(`../src/lib/db.ts?scratch=most-played-${Date.now()}`);
  getMostPlayed = mod.getMostPlayed;
});

after(() => {
  if (prevReflexDb === undefined) delete process.env.REFLEX_DB;
  else process.env.REFLEX_DB = prevReflexDb;
  rmSync(scratchDir, { recursive: true, force: true });
});

test('getMostPlayed orders by views DESC, breaks a tie by id DESC, and stops at the limit', () => {
  // Eligible: 3 and 2 (900), 10 (700), 1 (500), 4 (100), 8 (50). Limit 4 cuts 4 and 8.
  const cards = getMostPlayed(4);
  assert.deepEqual(cards.map((c) => c.id), [3, 2, 10, 1]);
  // The row is a play queue: each card must carry its video id to get a play button.
  assert.equal(cards[0].youtube_video_id, 'vid3');
});

test('getMostPlayed leaves live recordings out even when they have the most views', () => {
  const ids = getMostPlayed(50).map((c) => c.id);
  assert.ok(!ids.includes(5), 'live set "live in" must not be listed');
  assert.ok(!ids.includes(9), 'live set "(live" must not be listed');
});

test('getMostPlayed leaves out albums with 0 or NULL views', () => {
  // A limit above the catalog size reaches the zero/NULL rows if they were not filtered.
  const ids = getMostPlayed(50).map((c) => c.id);
  assert.deepEqual(ids, [3, 2, 10, 1, 4, 8]);
});
