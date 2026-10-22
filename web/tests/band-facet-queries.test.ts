// Queries behind the band page header (getBandViews) and the lead record of the
// genre / country / year pages (getFacetLead).
//
// The defect class they guard: Daniel's own live sets ("... Live in ...") are not studio
// albums, so a band's "total views" and a facet's "most played" must never count them (a
// live set is often the most viewed row), and a facet's lead must come from the facet it
// leads, not from a neighbouring column or another facet. Scratch SQLite DB with synthetic
// rows, same pattern as home-feeds.test.ts.
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
  genre: string;
  year: number;
  country: string;
  views: number | null;
};

const ROWS: Row[] = [
  { id: 1, band: 'Alpha', title: 'Studio One', genre: 'Death Metal', year: 2018, country: 'Alemania', views: 1000 },
  { id: 2, band: 'Alpha', title: 'Studio Two', genre: 'Death Metal', year: 2019, country: 'Alemania', views: 250 },
  // The live set: the most viewed row of every facet it shares, and of Alpha.
  { id: 3, band: 'Alpha', title: 'Alpha - Live in Tegucigalpa', genre: 'Death Metal', year: 2018, country: 'Alemania', views: 99999 },
  { id: 4, band: 'Beta', title: 'Beta Studio', genre: 'Grindcore', year: 2018, country: 'Chile', views: 5000 },
  // NULL views must read as zero, not as a missing total.
  { id: 5, band: 'Gamma', title: 'Gamma One', genre: 'Grindcore', year: 2020, country: 'Chile', views: null },
  { id: 6, band: 'Gamma', title: 'Gamma Two', genre: 'Grindcore', year: 2020, country: 'Chile', views: null },
  // A second raw spelling that slugs together with 'Death Metal' on the genre page.
  { id: 7, band: 'Delta', title: 'Delta One', genre: 'Death/Metal', year: 2021, country: 'Peru', views: 4000 },
  // Two rows with the same views in a facet of their own: the higher id leads.
  { id: 8, band: 'Epsilon', title: 'Epsilon One', genre: 'Doom', year: 2022, country: 'Mexico', views: 300 },
  { id: 9, band: 'Zeta', title: 'Zeta One', genre: 'Doom', year: 2022, country: 'Mexico', views: 300 },
];

function buildScratchDb(): { dbPath: string; dir: string } {
  const dir = mkdtempSync(path.join(tmpdir(), 'band-facet-'));
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
    VALUES (@id, @band, @title, @genre, @year, @country, NULL, @vid, '2020-01-01', @views)
  `);
  for (const r of ROWS) insert.run({ ...r, vid: `vid${r.id}` });
  db.close();
  return { dbPath, dir };
}

// db.ts reads REFLEX_DB once, when it is imported: point it at the scratch DB first. The
// caller's value is restored (or deleted, if it was unset) once, after the whole file.
const savedReflexDb = process.env.REFLEX_DB;
const scratchDirs: string[] = [];
after(() => {
  if (savedReflexDb === undefined) delete process.env.REFLEX_DB;
  else process.env.REFLEX_DB = savedReflexDb;
  for (const dir of scratchDirs) rmSync(dir, { recursive: true, force: true });
});

async function load(tag: string) {
  const { dbPath, dir } = buildScratchDb();
  scratchDirs.push(dir);
  process.env.REFLEX_DB = dbPath;
  return import(`../src/lib/db.ts?scratch=${tag}-${Date.now()}`);
}

test('getBandViews adds up the band\'s studio albums only', async () => {
  const db = await load('views');
  // Alpha: 1000 + 250. The live set (99999) and Beta's 5000 stay out.
  assert.equal(db.getBandViews('Alpha'), 1250);
});

test('getBandViews is 0, not null, for a band whose albums have no views yet', async () => {
  const db = await load('views-null');
  assert.equal(db.getBandViews('Gamma'), 0);
});

test('getFacetLead picks the most viewed studio album of the facet, never a live set', async () => {
  const db = await load('lead-country');
  const lead = db.getFacetLead('country', ['Alemania']);
  assert.equal(lead.id, 1);
  assert.equal(lead.views, 1000);
});

test('getFacetLead reads the column it was asked for', async () => {
  const db = await load('lead-columns');
  assert.equal(db.getFacetLead('year', [2018]).id, 4);        // Beta: 5000 beats Alpha's 1000
  assert.equal(db.getFacetLead('country', ['Chile']).id, 4);
  assert.equal(db.getFacetLead('genre', ['Grindcore']).id, 4);
  assert.equal(db.getFacetLead('genre', ['Doom']).id, 9);     // tie at 300: the higher id leads
});

test('getFacetLead covers every raw value of a genre page that groups several', async () => {
  const db = await load('lead-genres');
  assert.equal(db.getFacetLead('genre', ['Death Metal', 'Death/Metal']).id, 7);
});

test('getFacetLead is null when no studio album of the facet has views', async () => {
  const db = await load('lead-none');
  assert.equal(db.getFacetLead('year', [2020]), null);
});
