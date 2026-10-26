// Contact sheets for the cover review: 20 tiles per sheet, each tile showing the
// original frame (320x180) with the crop box drawn, the 400px crop beside it, and a
// label "album id | video id | source score".
//
//   node scripts/covers/contact-sheets.mjs <outDir> [--from N] [--count N] [--source detected,template]
//
// --from / --count select albums by position in id order (0-based); --source keeps
// only the listed sources (detected, template, year-fallback, override, full).
// Uses sharp only. The originals come from .cover-previews/ (written while the
// detector ran); a missing preview is fetched once as the 320x180 mqdefault.
import Database from 'better-sqlite3';
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { coverFileName } from '../../src/lib/cover.ts';
import { PREVIEW_H, PREVIEW_W, renderPreview } from '../../src/lib/coverImage.ts';
import { coverPaths, readCoverCache } from '../../src/lib/coverStore.ts';

const outDir = process.argv[2];
if (!outDir || outDir.startsWith('--')) {
  console.error('usage: node scripts/covers/contact-sheets.mjs <outDir> [--from N] [--count N] [--source detected,template]');
  process.exit(1);
}
const flag = (name) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const from = Number(flag('--from') ?? 0);
const count = Number(flag('--count') ?? Infinity);
const sources = flag('--source')?.split(',');

const PER_SHEET = 20;
const COLS = 4;
const CROP = 200; // the 400px crop, shown at half size
const LABEL_H = 22;
const GAP = 6;
const TILE_W = PREVIEW_W + GAP + CROP;
const TILE_H = LABEL_H + CROP;
const COLORS = { detected: '#2fd45a', template: '#2fb7d4', 'year-fallback': '#ff9f1a', override: '#d42fd0', full: '#888888' };

const candidates = [process.env.REFLEX_DB, resolve(process.cwd(), '../reflex.db'), resolve(process.cwd(), 'reflex.db')].filter(Boolean);
const dbPath = candidates.find((p) => existsSync(p));
if (!dbPath) throw new Error(`reflex.db not found. Tried: ${candidates.join(', ')}`);

const db = new Database(dbPath, { readonly: true, fileMustExist: true });
const rows = db.prepare(`SELECT id, youtube_video_id FROM albums WHERE youtube_video_id != '' ORDER BY id`).all();
db.close();

const paths = coverPaths();
const cache = readCoverCache(paths.cache);
await mkdir(paths.previewDir, { recursive: true });
await mkdir(outDir, { recursive: true });

const esc = (s) => s.replace(/[<>&]/g, '');

async function previewOf(videoId) {
  const file = join(paths.previewDir, coverFileName(videoId));
  if (!existsSync(file)) {
    const res = await fetch(`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`);
    if (!res.ok) return null;
    await writeFile(file, await renderPreview(Buffer.from(await res.arrayBuffer())));
  }
  return readFile(file);
}

async function tile(row) {
  const entry = cache[row.youtube_video_id];
  const source = entry?.source ?? 'none';
  const label = `${row.id} | ${row.youtube_video_id} | ${source} ${entry?.score ?? ''}`;
  const layers = [];

  const preview = await previewOf(row.youtube_video_id);
  if (preview) {
    layers.push({ input: preview, left: 0, top: LABEL_H });
    if (entry?.box) {
      const [x, y, s] = entry.box;
      const k = PREVIEW_W / 1280;
      const stroke = COLORS[source] ?? '#fff';
      layers.push({
        input: Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${PREVIEW_W}" height="${PREVIEW_H}">` +
            `<rect x="${x * k}" y="${y * k}" width="${s * k}" height="${s * k}" fill="none" stroke="${stroke}" stroke-width="2"/></svg>`,
        ),
        left: 0,
        top: LABEL_H,
      });
    }
  }
  const cropFile = join(paths.coversDir, coverFileName(row.youtube_video_id));
  if (entry?.box && existsSync(cropFile)) {
    layers.push({ input: await sharp(cropFile).resize(CROP, CROP).png().toBuffer(), left: PREVIEW_W + GAP, top: LABEL_H });
  }
  layers.push({
    input: Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE_W}" height="${LABEL_H}">` +
        `<text x="4" y="16" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" fill="#ffffff">${esc(label)}</text></svg>`,
    ),
    left: 0,
    top: 0,
  });
  return sharp({ create: { width: TILE_W, height: TILE_H, channels: 3, background: '#1b1b1b' } })
    .composite(layers)
    .png()
    .toBuffer();
}

const picked = rows
  .slice(from, Number.isFinite(count) ? from + count : undefined)
  .filter((r) => !sources || sources.includes(cache[r.youtube_video_id]?.source ?? 'none'));

const index = [];
for (let n = 0; n < picked.length; n += PER_SHEET) {
  const chunk = picked.slice(n, n + PER_SHEET);
  const tiles = await Promise.all(chunk.map(tile));
  const rowsN = Math.ceil(chunk.length / COLS);
  const sheet = sharp({
    create: { width: COLS * (TILE_W + GAP), height: rowsN * (TILE_H + GAP), channels: 3, background: '#000000' },
  }).composite(tiles.map((input, i) => ({ input, left: (i % COLS) * (TILE_W + GAP), top: Math.floor(i / COLS) * (TILE_H + GAP) })));
  const name = `sheet-${String(n / PER_SHEET + 1).padStart(3, '0')}.jpg`;
  await sheet.jpeg({ quality: 88 }).toFile(join(outDir, name));
  index.push({ sheet: name, albums: chunk.map((r) => ({ id: r.id, videoId: r.youtube_video_id })) });
}
await writeFile(join(outDir, 'index.json'), JSON.stringify(index, null, 1));
console.log(`[contact-sheets] ${picked.length} tiles in ${index.length} sheet(s) -> ${outDir}`);
