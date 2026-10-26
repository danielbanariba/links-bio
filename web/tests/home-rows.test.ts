// The home's discovery rows, read from a scratch SQLite DB (not the live
// reflex.db) whose rows are chosen so that each rule can be broken on its own:
//   - getBandsToDigInto: a band with one album (it has no band page to link to),
//     a band whose second "album" is its live set, and a band whose live set has
//     the most views of all (a missing NOT_LIVE would rank it first);
//   - getFacetTiles: the catch-all "Metal" genre and the sync's unknown-genre
//     placeholder, both bigger than the real genres.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fromCountry } from '../src/lib/labels.ts';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

function buildScratchDb(): { dbPath: string; dir: string } {
  const dir = mkdtempSync(path.join(tmpdir(), 'home-rows-'));
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
    VALUES (@id, @band, @title, @genre, 2020, 'Alemania', NULL, @vid, '2020-01-01', @views)
  `);
  let id = 0;
  const row = (band: string, title: string, genre: string, views: number) =>
    insert.run({ id: ++id, band, title, genre, vid: `vid${id}`, views });

  // Bands
  row('Alpha', 'A1', 'Death Metal', 10);
  row('Alpha', 'A2', 'Death Metal', 10);            // Alpha: 2 albums, 20 views
  row('Bravo', 'B1', 'Grindcore', 5);
  row('Bravo', 'B2', 'Grindcore', 5);
  row('Bravo', 'B3', 'Grindcore', 5);               // Bravo: 3 albums, 15 views
  row('Charlie', 'C1', 'Death Metal', 1000);        // one album: no band page
  row('Delta', 'D1', 'Death Metal', 100);
  row('Delta', 'Delta (Live in Honduras)', 'Death Metal', 99999); // one studio album + a live set
  row('Echo', 'E1', 'Goregrind', 8);
  row('Echo', 'E2', 'Goregrind', 8);                // Echo: 2 albums, 16 views...
  row('Echo', 'Echo (Live at Obscene Extreme)', 'Goregrind', 50000); // ...and a live set

  // Genres big enough to outrank the real ones, but not genres a tile can show.
  for (let i = 0; i < 6; i++) row(`Metal${i}`, 'M', 'Metal', 1);
  for (let i = 0; i < 6; i++) row(`Unknown${i}`, 'U', 'Género desconocido', 1);
  db.close();
  return { dbPath, dir };
}

type DigBand = { band_name: string; albums: number };
type FacetTile = { value: string; slug: string; count: number };
let getBandsToDigInto: (limit: number) => DigBand[];
let getFacetTiles: (kind: 'genre' | 'country', limit: number) => FacetTile[];
let scratchDir = '';
let prevReflexDb: string | undefined;

before(async () => {
  prevReflexDb = process.env.REFLEX_DB;
  const { dbPath, dir } = buildScratchDb();
  scratchDir = dir;
  process.env.REFLEX_DB = dbPath;
  const mod = await import(`../src/lib/db.ts?scratch=home-rows-${Date.now()}`);
  getBandsToDigInto = mod.getBandsToDigInto;
  getFacetTiles = mod.getFacetTiles;
});

after(() => {
  if (prevReflexDb === undefined) delete process.env.REFLEX_DB;
  else process.env.REFLEX_DB = prevReflexDb;
  rmSync(scratchDir, { recursive: true, force: true });
});

test('getBandsToDigInto lists bands with 2+ studio albums, ranked by their studio views', () => {
  // Charlie (one album) has no band page; Delta's second "album" is a live set.
  // Echo's live set (50000 views) must not lift it above Alpha.
  assert.deepEqual(getBandsToDigInto(10).map((b) => b.band_name), ['Alpha', 'Echo', 'Bravo']);
});

test('getBandsToDigInto counts studio albums only', () => {
  const echo = getBandsToDigInto(10).find((b) => b.band_name === 'Echo');
  assert.equal(echo?.albums, 2);
});

test('getFacetTiles ranks genres by album count, without "Metal" or the unknown-genre placeholder', () => {
  const tiles = getFacetTiles('genre', 8);
  assert.deepEqual(tiles.map((t) => t.value), ['Death Metal', 'Grindcore', 'Goregrind']);
  // The tile links to the genre page the build generates.
  assert.equal(tiles[0].slug, 'death-metal');
});

test('fromCountry titles a country row in English, with "the" where English needs it', () => {
  assert.equal(fromCountry('Estados Unidos'), 'From the United States');
  assert.equal(fromCountry('Reino Unido'), 'From the United Kingdom');
  assert.equal(fromCountry('Alemania'), 'From Germany');
});
