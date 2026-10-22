// Regression tests for the queries behind the "dark room" home page
// (getLatestUploads, getMostPlayed, getArchiveFacts, getHiddenGems).
//
// The defect class they guard: Daniel's own live sets ("... Live in ...") are
// NOT studio albums, and the home page quotes numbers and ranks albums from
// these queries. A query that drops the NOT_LIVE predicate puts a live set at
// the top of "New in the archive" / "Most played" and inflates the counts in
// the hero ("2,703 full albums"). Scratch SQLite DB, synthetic rows, same
// pattern as facet-order.test.ts: the live row is deliberately the newest and
// the most viewed, so a missing predicate changes the first element.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

type Row = {
  id: number;
  band: string;
  title: string;
  country: string;
  views: number | null;
  upload: string;
  featured: number;
};

const ROWS: Row[] = [
  { id: 1, band: 'Alpha', title: 'Studio One', country: 'Alemania', views: 9000, upload: '2020-01-01', featured: 0 },
  // The live set: newest AND most viewed, in a country no studio album has.
  { id: 2, band: 'Beta', title: 'Beta - Live in Tegucigalpa', country: 'Honduras', views: 99999, upload: '2021-01-01', featured: 0 },
  // Blank country must not count as a country.
  { id: 3, band: 'Gamma', title: 'Studio Three', country: '', views: 700, upload: '2020-05-01', featured: 0 },
  // NULL views: never "most played", still a hidden gem (counted as 0 views).
  { id: 4, band: 'Delta', title: 'Studio Four', country: 'Alemania', views: null, upload: '2020-03-01', featured: 0 },
];

function buildScratchDb(extra: Row[]): { dbPath: string; dir: string } {
  const dir = mkdtempSync(path.join(tmpdir(), 'home-feeds-'));
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
      views INTEGER,
      featured INTEGER DEFAULT 0
    );
  `);
  const insert = db.prepare(`
    INSERT INTO albums (id, band_name, album_title, genre, year, country, album_artwork_url, youtube_video_id, upload_date, views, featured)
    VALUES (@id, @band, @title, 'Test Metal', 2020, @country, NULL, @vid, @upload, @views, @featured)
  `);
  for (const r of [...ROWS, ...extra]) insert.run({ ...r, vid: `vid${r.id}` });
  db.close();
  return { dbPath, dir };
}

// db.ts reads REFLEX_DB once, when it is imported, so each load points the variable at its
// own scratch DB before importing. The caller's value is saved and the scratch dirs are
// removed once, after the whole file: per-load hooks would restore a stale path, and
// assigning an unset value back would leave the string 'undefined' in the environment.
const savedReflexDb = process.env.REFLEX_DB;
const scratchDirs: string[] = [];
after(() => {
  if (savedReflexDb === undefined) delete process.env.REFLEX_DB;
  else process.env.REFLEX_DB = savedReflexDb;
  for (const dir of scratchDirs) rmSync(dir, { recursive: true, force: true });
});

async function loadHomeQueries(extra: Row[], tag: string) {
  const { dbPath, dir } = buildScratchDb(extra);
  scratchDirs.push(dir);
  process.env.REFLEX_DB = dbPath;
  return import(`../src/lib/db.ts?scratch=${tag}-${Date.now()}`);
}

test('getLatestUploads lists newest first and never the live sets', async () => {
  const db = await loadHomeQueries([], 'latest');
  assert.deepEqual(db.getLatestUploads(10).map((c: any) => c.band_name), ['Gamma', 'Delta', 'Alpha']);
});

test('getMostPlayed ranks by views, skipping live sets and albums without views', async () => {
  const db = await loadHomeQueries([], 'played');
  const played = db.getMostPlayed(10);
  assert.deepEqual(played.map((c: any) => c.band_name), ['Alpha', 'Gamma']);
  assert.deepEqual(played.map((c: any) => c.views), [9000, 700]);
});

test('getArchiveFacts counts studio albums, bands and non-blank countries only', async () => {
  const db = await loadHomeQueries([], 'facts');
  // Studio rows: Alpha, Gamma, Delta. Countries: Alemania only (blank and the live set's Honduras do not count).
  assert.deepEqual(db.getArchiveFacts(), { albums: 3, bands: 3, countries: 1 });
});

test('getHiddenGems keeps views strictly below the bound, unfeatured, studio only', async () => {
  const probe = await loadHomeQueries([], 'bound-probe');
  const bound = probe.HIDDEN_GEM_VIEWS;
  const extra: Row[] = [
    { id: 5, band: 'JustUnder', title: 'Studio Five', country: 'Chile', views: bound - 1, upload: '2019-06-01', featured: 0 },
    { id: 6, band: 'AtBound', title: 'Studio Six', country: 'Chile', views: bound, upload: '2019-01-01', featured: 0 },
    { id: 7, band: 'Featured', title: 'Studio Seven', country: 'Brasil', views: 10, upload: '2018-01-01', featured: 1 },
    // A live set that passes every other gate (unfeatured, NULL views): only NOT_LIVE keeps it out.
    // The fixture live row (id 2) has 99999 views, so the views bound alone already excludes it.
    { id: 8, band: 'LiveGem', title: 'LiveGem - Live in Tegucigalpa', country: 'Honduras', views: null, upload: '2019-03-01', featured: 0 },
  ];
  const db = await loadHomeQueries(extra, 'gems');
  const gems = db.getHiddenGems();
  // Delta (NULL views, reported as 0) and JustUnder qualify; AtBound is not below the bound, Featured is excluded, the live sets never appear.
  assert.deepEqual(gems.map((g: any) => g.band_name).sort(), ['Delta', 'JustUnder']);
  assert.equal(gems.find((g: any) => g.band_name === 'Delta').views, 0);
});
