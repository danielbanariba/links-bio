// facetTileRank, read from a scratch SQLite DB (not the live reflex.db): a genre
// or country page paints its banner in its tile's colour, so the page's rank has
// to be the tile's rank (getFacetTiles), and a catch-all with no tile gets none.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

type Kind = 'genre' | 'country';
let scratchDir = '';
let prevReflexDb: string | undefined;
let getFacetTiles: (kind: Kind, limit?: number) => { slug: string }[];
let facetTileRank: (kind: Kind, slug: string) => number | null;

before(async () => {
  scratchDir = mkdtempSync(path.join(tmpdir(), 'facet-rank-'));
  const dbPath = path.join(scratchDir, 'scratch.db');
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE albums (id INTEGER PRIMARY KEY, band_name TEXT, album_title TEXT, genre TEXT, year INTEGER,
      country TEXT, album_artwork_url TEXT, youtube_video_id TEXT, upload_date TEXT, views INTEGER, release_type TEXT);
    CREATE TABLE tracks (id INTEGER PRIMARY KEY, album_id INTEGER, track_number INTEGER, track_name TEXT, timestamp TEXT);
  `);
  const insert = db.prepare(
    `INSERT INTO albums (band_name, album_title, genre, country, youtube_video_id, upload_date, views)
     VALUES (?, ?, ?, ?, ?, '2024-01-01', 1)`
  );
  let n = 0;
  const add = (genre: string, country: string) => insert.run(`B${n}`, 'Studio', genre, country, `v${n++}`);
  // "Metal" is the biggest genre but a catch-all: no tile, so no rank.
  for (let i = 0; i < 6; i++) add('Metal', 'Alemania');
  for (let i = 0; i < 3; i++) add('Death Metal', 'Estados Unidos');
  // Two spellings of one slug: one tile of 2, ranked as a group, not as two rows of 1.
  add('Black/Death Metal', 'Estados Unidos');
  add('Black Death Metal', 'Estados Unidos');
  // Ties with the group above on count; the name breaks the tie.
  add('Grindcore', 'Mexico');
  add('Grindcore', 'Mexico');
  add('Thrash Metal', 'Mexico');
  db.close();
  prevReflexDb = process.env.REFLEX_DB;
  process.env.REFLEX_DB = dbPath;
  const mod = await import(`../src/lib/db.ts?scratch=facet-rank-${Date.now()}`);
  getFacetTiles = mod.getFacetTiles;
  facetTileRank = mod.facetTileRank;
});

after(() => {
  if (prevReflexDb === undefined) delete process.env.REFLEX_DB;
  else process.env.REFLEX_DB = prevReflexDb;
  rmSync(scratchDir, { recursive: true, force: true });
});

test('a facet page ranks its banner where its tile sits, for genres and countries', () => {
  for (const kind of ['genre', 'country'] as const) {
    const tiles = getFacetTiles(kind, 50);
    assert.ok(tiles.length > 1, `${kind} has tiles to compare`);
    tiles.forEach((tile, i) => assert.equal(facetTileRank(kind, tile.slug), i, `${kind} ${tile.slug}`));
  }
});

test('a catch-all genre and an unknown slug get no rank (a neutral banner)', () => {
  assert.equal(facetTileRank('genre', 'metal'), null);
  assert.equal(facetTileRank('genre', 'no-such-genre'), null);
});
