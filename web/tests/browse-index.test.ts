// getBrowseIndex() is serialised to /browse-index.json, the only data the Browse
// results are rendered from. A result gets a ▶ only if its entry carries the
// album's youtube_video_id, so the index must carry it for every album that has
// one, and a null (never undefined, never a stray id) for one that has none.
//
// Uses a scratch SQLite DB (not the live reflex.db). The albums sit in a fixed
// order and each has a different video id, so an id read from the wrong column or
// row cannot match by accident.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

function buildScratchDb(): { dbPath: string; dir: string } {
  const dir = mkdtempSync(path.join(tmpdir(), 'browse-index-'));
  const dbPath = path.join(dir, 'scratch.db');
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE albums (
      id INTEGER PRIMARY KEY,
      band_name TEXT,
      album_title TEXT,
      genre TEXT,
      country TEXT,
      year INTEGER,
      release_type TEXT,
      views INTEGER,
      album_artwork_url TEXT,
      youtube_video_id TEXT
    );
  `);
  const insert = db.prepare(`
    INSERT INTO albums (id, band_name, album_title, genre, country, year, release_type, views, album_artwork_url, youtube_video_id)
    VALUES (@id, @band, @title, 'Test Metal', 'Testlandia', 2020, 'Album', 10, NULL, @vid)
  `);
  insert.run({ id: 1, band: 'Alpha', title: 'A Album', vid: 'vidAlpha1' });
  insert.run({ id: 2, band: 'Bravo', title: 'B Album', vid: null });
  insert.run({ id: 3, band: 'Charlie', title: 'C Album', vid: 'vidCharlie3' });
  db.close();
  return { dbPath, dir };
}

let getBrowseIndex: () => { id: number; youtube_video_id?: string | null }[];
let scratchDir = '';
let prevReflexDb: string | undefined;

before(async () => {
  prevReflexDb = process.env.REFLEX_DB;
  const { dbPath, dir } = buildScratchDb();
  scratchDir = dir;
  process.env.REFLEX_DB = dbPath;
  const mod = await import(`../src/lib/db.ts?scratch=browse-index-${Date.now()}`);
  getBrowseIndex = mod.getBrowseIndex;
});

after(() => {
  if (prevReflexDb === undefined) delete process.env.REFLEX_DB;
  else process.env.REFLEX_DB = prevReflexDb;
  rmSync(scratchDir, { recursive: true, force: true });
});

test('getBrowseIndex carries each album\'s video id, and null for an album without one', () => {
  const byId = Object.fromEntries(getBrowseIndex().map((e) => [e.id, e.youtube_video_id]));
  assert.deepEqual(byId, { 1: 'vidAlpha1', 2: null, 3: 'vidCharlie3' });
});
