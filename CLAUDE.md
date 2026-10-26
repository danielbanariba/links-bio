# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal site for Daniel Banariba. Two sections, one static site, all user-facing content in **English** (the audience is mostly English-speaking; the archive was migrated from Spanish in Aug 2026):
1. **Bio / portfolio** (`/`) — social links, audiovisual work, contact form.
2. **Metal Archive** (`/metal-archive/`) — database-driven catalog of underground metal albums: gallery, browse/search, album & band pages, genre/country/year facets, band submissions, promo requests, newsletter.

> **Read this first — the architecture changed.** The Metal Archive + bio **migrated from a Reflex app to an Astro static site** (commit `14f149c`, May 2026). The live frontend is now **Astro SSG in `web/`**. The Python/Reflex code in `links_bio/` is no longer the frontend — it survives only as the **data model, the sync pipeline, and a FastAPI forms service**. See "What is live vs. legacy" before editing anything.

## Architecture at a glance

Three cooperating pieces, all sharing one SQLite file (`reflex.db`) that lives **only on the host** (gitignored):

```
  YouTube ──(Python sync scripts)──▶ reflex.db ◀──(runtime form writes)── FastAPI (uvicorn :8001)
                                        │                                        ▲
                                 read at BUILD time                       POST from forms
                                        │                                        │
                              web/  `npm run build`  ───────────────▶  Astro static HTML
                                        │                                        │
                          `vercel deploy --prebuilt`                      served to users
                                        ▼                                        │
                                Vercel  (danielbanariba.com)  ◀────────── browser
```

- **Astro reads the DB at build time** (`web/src/lib/db.ts`, `better-sqlite3`, read-only). Pages are plain HTML — no hydration, no WebSocket. The site can only be built where `reflex.db` exists (the host), which is why CI deploy is disabled.
- **Forms write the DB at runtime** via a thin FastAPI service. The static pages POST to it cross-origin.
- **Sync scripts populate the DB** from YouTube, then rebuild + redeploy the static site.

## Development commands

The frontend (`web/`, Node) and the data/forms layer (`links_bio/`, Python venv `env/`) are independent — pick the one you're touching.

### Frontend — Astro (`web/`)
```bash
cd web
npm install
npm run dev        # Astro dev server on http://localhost:4321 (reads ../reflex.db)
npm run build      # static build into web/dist/  (needs ../reflex.db present)
npm run preview
```
Forms POST to `import.meta.env.PUBLIC_API_BASE` (default `https://app.danielbanariba.com`). For local form testing, run the FastAPI service and start Astro with `PUBLIC_API_BASE=http://localhost:8001 npm run dev`.

### Forms backend — FastAPI (`links_bio/`)
```bash
source env/bin/activate                                  # Python 3.13 venv
uvicorn links_bio.fastapi_forms:app --port 8001 --reload
```

### Lint & verification
There IS an automated test suite now: pytest for `links_bio/`, `node --test` (via `npm test`) for `web/`.
```bash
env/bin/ruff check links_bio/     # Python lint (same as the MCP lint_project tool)
env -u GMAIL_ADDRESS -u GMAIL_APP_PASSWORD -u VERCEL_TOKEN \
  uv run --quiet --with pytest --python env/bin/python -m pytest tests -q   # Python test suite
cd web && npm test                # node:test over web/tests/**/*.test.ts
cd web && npx tsc --noEmit        # TypeScript 7 (the native tsc); .astro files are not checked
cd web && npm run build           # the real check: getStaticPaths() crashes the build on a bad slug/param
```
The `env -u` flags keep real secrets out of the test process (tests use a scratch DB and a stubbed
mailer). The project MCP tool `test_metal_archive_pages` smoke-tests the rendered archive pages.
ruff 0.17 (T10b) turned on a wider default rule set (isort, pyupgrade, blind-except, ...). On the
same code it reports 32 findings where ruff 0.15 reported 10. `ruff check links_bio/ --select
E4,E7,E9,F` gives the old view.

### Database / migrations (plain Alembic, no Reflex)
Alembic is driven directly from `links_bio.db` (`REFLEX_DB_URL` env var, default `sqlite:///reflex.db`) —
there is no `reflex db ...` wrapper anymore.
```bash
source env/bin/activate
alembic revision --autogenerate -m "description"   # after editing links_bio/models/
alembic upgrade head
# build.sh automates first-time setup: pip install + alembic upgrade head
# requirements.txt = runtime (forms API, sync). requirements-dev.txt adds the
# host tooling that shares env/: mcp (project MCP server), ruff, pytest, httpx.
# Rebuilding env/ from requirements.txt alone breaks .mcp.json and lint.
```
The four `datetime` fields in `links_bio/models/` declare `sa_type=DateTime(timezone=False)`. Since
sqlmodel 0.0.45 a bare `datetime` field becomes a UTC-aware column, and that column rejects the naive
local times `reflex.db` has always stored. Keep the explicit type unless a data migration converts
those rows first.

### Data sync (populate reflex.db)
`sync_all.sh` runs the DB-only pipeline manually, with no deploy — useful for a one-off backfill. In
production this same pipeline (plus the Astro build+deploy) runs automatically on a timer; see
"Data layer & sync" below.
```bash
source env/bin/activate
./sync_all.sh                                  # full pipeline: youtube → fallback → normalize
python sync_youtube_to_db.py --solo-nuevos --mark-featured   # individual steps also runnable
```

### Deploy the static site (run on the host — only it has reflex.db)
```bash
cd web && npm run build && vercel deploy --prod --prebuilt
```
**A merge installs its own dependencies.** `links-bio-deploy.timer` runs `npm ci`, the `pip install`
and the forms restart when a merge changes them (see "Deployment"). The sync timer and the pre-push hook
still build with whatever is already in `web/node_modules` and `env/`, so after pulling `main` by hand
(after the T10b upgrade: Astro 7, Preact 11, mcp 2, sqlmodel 0.0.48), run:
```bash
cd web && npm ci && cd ..                          # Astro 7 needs Node >= 22.23.4 (the host has v25.8.0)
env/bin/pip install -r requirements-dev.txt
sudo systemctl restart metal-archive-forms.service
```
Pull the code and install the pins together. The new `mcp/server.py` imports `MCPServer`, which mcp 1.x
does not have. The old one imports `mcp.server.fastmcp`, which mcp 2.x removed.
Production also deploys automatically (a) twice a day from the `links-bio-sync.timer` systemd unit
(see "Data layer & sync"), (b) **within 5 minutes of every merge to `main`** from `links-bio-deploy.timer`
(see "Deployment"), and (c) from the **`.git/hooks/pre-push` hook whenever `main` is pushed**.
All three prefer `VERCEL_TOKEN` when it is set in `.env` (decision D2: a logged-in CLI session can expire
silently, which is exactly what caused 3+ weeks of silently-failing deploys in Sep 2026) and fall back
to the logged-in CLI session otherwise. ⚠️ **Pushing `main` deploys to production** — `git push --no-verify` bypasses the hook once.

## The Astro frontend (`web/`) — the live site

- **Astro 7, `output: 'static'`, Vercel adapter 11, Preact 11 islands.** `better-sqlite3` is kept Vite-external (native module) — see `astro.config.mjs`. The adapter also injects **Vercel Web Analytics** (`webAnalytics: { enabled: true }`) into all 11 pages at build (still must be turned on in the Vercel dashboard to collect data).
  - `compressHTML: true` keeps Astro 6's whitespace handling. Astro 7's default, `'jsx'`, drops the
    space between inline elements written on separate lines.
  - Astro 7's Rust compiler rejects an HTML comment as the first node inside a `{...}` expression.
    Write `{/* ... */}` there.
  - `package.json` `overrides` lift path-to-regexp (under `@vercel/routing-utils`) and zod (under
    `@vercel/cli-config`) to their patched versions. Both upstream packages pin vulnerable releases
    exactly. Drop an override once its upstream package stops pinning that release.
- **Security headers (`web/vercel.json`) reach the build output via a post-build script, not the adapter.**
  The installed `@astrojs/vercel` has no general custom-headers passthrough — its `staticHeaders` option
  only ever emits a Content-Security-Policy header, and only when Astro's own experimental
  `security.csp` is enabled. `web/scripts/apply-vercel-headers.mjs`, wired into the `build` npm script
  right after `astro build`, merges `web/vercel.json`'s `headers` into
  `web/.vercel/output/config.json`'s `routes` as `{src, headers, continue: true}` entries placed before
  `{handle: "filesystem"}`, idempotently (re-running it replaces its own prior entry instead of
  stacking). It fails loudly instead of deploying a silently-wrong regex if a header `source` ever uses
  a path-to-regexp named parameter (e.g. `:slug`) it can't faithfully translate to a Build Output API
  `src` regex. `web/vercel.json` stays the single declared source of the headers — see "Deployment"
  below for why the adapter/CLI can't just read it directly.
- **`web/vercel.json` also declares the `/_astro/(.*)` immutable `cache-control` on purpose — don't
  remove it as a duplicate.** The adapter emits its own `/_astro` cache route *after*
  `{handle: "filesystem"}`, where it never applies to a file the filesystem serves, so hashed assets
  went out with `max-age=0, must-revalidate` until Oct 2026. The copy in `vercel.json` is merged before
  the filesystem handle, which is the only position that takes effect. Since `@astrojs/vercel` 11
  (T10b) the adapter places its own `/_astro` route before the filesystem handle too, so the copy is now
  redundant. It stays, so the header does not depend on where an adapter version puts its route.
- **`web/src/lib/db.ts` is the single DB gateway.** ALL database access goes through it — no inline DB opens in pages. It opens one read-only connection and exposes typed query functions (home feeds, album detail, facets, band pages, browse index). When a page needs data, add/return a function here.
- **Routing:** `web/src/pages/index.astro` is the bio at `/`. The Metal Archive lives under `web/src/pages/metal-archive/` — the **folder provides the `/metal-archive` path prefix** (there is intentionally no `base` in the config), so public URLs are unchanged. Dynamic pages (`album/[id]`, `band/[band]`, `genre/[genre]`, `country/[country]`, `year/[year]`) enumerate paths via `getStaticPaths()` backed by `db.ts`.
- **Archive shell (`web/src/components/ArchiveChrome.astro` + `web/src/styles/archive.css`).** Every
  archive page renders `<ArchiveChrome />` (skip link, sidebar, top bar, phone tab bar) and imports
  `archive.css` AFTER `global.css`. Everything in it is scoped under `body.ma-shell`, so none of it
  reaches the bio; `Navbar.astro` now serves only the bio and the 404.
  - Layout: at ≥1100px a left sidebar (Home/Search/Genres/Countries, Recent, Submit card) and a right
    panel (`Footer.astro`'s aside: the "Now playing" slot, then Most played), the page between them.
    768–1099px: an 88px icon rail. Phones: a top bar and a Home/Search/Submit tab bar.
  - Font: Onest, self-hosted from `@fontsource-variable/onest` through `@font-face` in `archive.css`.
    The wordmark keeps DinaRemasterII.
  - Covers render through `CoverArt.astro`, or its browser twin `web/src/lib/coverArtDom.ts`, by
    `coverMode()` (`web/src/lib/coverDisplay.ts`). A `/covers/` square crop fills the box. Anything else
    is a YouTube frame: shown whole, letterboxed over a blurred copy, never centre-cropped.
  - Titles drop "(Full Álbum)" on display only (`displayTitle()`, `web/src/lib/title.ts`). The DB and
    the URLs keep the raw title.
  - The Player publishes what it plays on `#np-root[data-now]` plus the `ma:now` event
    (`web/src/lib/now.ts`), and adds it to the sidebar's Recent list (`web/src/lib/recent.ts`,
    localStorage `ma:recent`, every access in try/catch). The home hero and Recent follow those.
  - Home (`pages/metal-archive/index.astro`): a hero, which shows the latest upload, or the album the
    player has loaded while it is open. Then `Row.astro` rows: Latest uploads, Most played, genre tiles,
    Bands to dig into, the top country's albums, country tiles, Live recordings (`getFacetTiles()`,
    `getBandsToDigInto()` in `db.ts`). A tile is `FacetTile.astro`, shared with Search.
  - Album page (`album/[id].astro`): the cover, the title as the `h1`, Play album, Share, a Tracklist
    panel whose rows seek (`[data-track-idx][data-seconds]`) and a Details panel, then rows: More from
    the band, Similar bands, If you liked this, Keep exploring. A button whose label must stay its own
    carries `data-keep-label`; a `[data-label-on]`/`[data-label-off]` span inside it swaps Play/Pause.
  - Band page (`band/[band].astro`): a hero over the band's best cover (no invented photos), Play,
    Shuffle and Share, Popular (top 5 by views), About, Discography, Live recordings
    (`web/src/lib/bandPage.ts`: `rankPopular`, `bandSummary`). Play and Shuffle are
    `[data-play-scope="<id>"]` buttons: the queue is every `[data-play-card]` inside the element with
    that id, `data-video-id` names the album to start with, and `data-shuffle` turns shuffle on and
    starts at a random one.
  - Search (`browse.astro` + `islands/Search.tsx`; the URL stays `/metal-archive/browse`): genre and
    country tiles while the field is empty (`#genres`, `#countries`, which light up the sidebar items);
    typing shows a top result, albums, bands, genres and countries (`web/src/lib/search.ts`, pure and
    tested); `?genre=`, `?country=`, `?year=`, `?release_type=` and `?sort=` show a filtered list with
    removable chips. When the island rewrites the URL it keeps `history.state` (AlbumGrid's count)
    and fires `SEARCH_URL_EVENT`, so the sidebar re-marks its item. A deep link with a query hides
    the server-rendered tiles (`.is-deeplink`, set by an inline script) until the island is ready
    (`data-ready`), so they never flash before the results; without JS the tiles stay.
  - Facet pages (`genre/`, `country/`, `year/`): `FacetBanner.astro` in the facet's colour, then
    `AlbumGrid` (Show more; the revealed count lives in the history entry, so Back reopens it). Tile and
    banner colours come from `web/src/lib/tiles.ts` by rank; `facetTileRank()` and `getFacetTiles()`
    read one ranked list, so a genre keeps its colour from tile to page.
  - Forms (submit, promo, newsletter): restyled by `archive.css` under `.ma-shell.form-page` only; the
    404 and the bio's contact form share the classes and keep `global.css`'s look.
- **Islands (client JS, Preact):** `web/src/islands/Player.tsx` (YouTube player, persisted across ClientRouter navigation) and `Search.tsx` (client-side search over `/browse-index.json`). Any card's ▶ plays its album in place: the queue is that card's row or grid (`data-queue`, `web/src/lib/queue.ts`), the player goes on to the next album by itself and skips videos that cannot be embedded. `browse-index.json` is generated from `getBrowseIndex()` at build and read by Search and by "Surprise me" (the bio's Navbar, the archive top bar's dice).
  - **The Player's surfaces:** the mini player bar; the right panel at ≥1100px (the video, the album,
    the queue); the now-playing view (in place of the page on desktop and tablet, a full-screen modal
    sheet on the phone); a floating 200x200 video tile on phone and tablet. Its state lives on the
    persisted `#np-root`: `data-active` (an album is loaded), `data-view` (the view is open),
    `data-surface` (where the video is). `archive.css` owns the shell's player layout; the pre-shell
    `[data-open]` dock rules were removed from global.css in T13.
  - **One iframe, never moved.** Moving an iframe in the DOM reloads it and stops the music. So
    `#mini-player` is a fixed box laid over the active slot (`[data-np-slot]`): the panel, the view's
    art or the tile. It is sized and animated to that slot (`web/src/lib/playerStage.ts`), sits above
    every other layer, and takes no clicks. YouTube's rules hold on every surface: at least 200x200,
    inside the viewport, not covered, not cropped (square corners; a 16:9 video in the square art is
    shown whole over a blurred cover). Auto-next only runs while the video is more than half visible.
  - **Tracks:** every album is one video; a track is a start time in it (`web/src/lib/segments.ts`).
    The album page brings its own; any other album's come from `/metal-archive/album/<id>.json`
    (`pages/metal-archive/album/[id].json.ts`, `web/src/lib/albumInfo.ts`), fetched when it starts.
    These per-album JSON files add one build output per album; they are not HTML and not in the sitemap.
  - "Playing from" reads `data-from` / `data-from-href` on the queue's scope (rows, the hero, Most
    played), else the page's `h1`. Shuffle and repeat are pure queue functions in `queue.ts`.
- **Per-album color theming:** `web/src/lib/vibrant.ts` gets a colour per cover at build time and caches it in `web/.vibrant-cache.json`, so unchanged covers skip re-extraction. `web/src/lib/coverColor.ts` picks the colour with `sharp` alone: a 64px sample, a 4-bit histogram, then node-vibrant's targets and weights for its "Vibrant" swatch. So the colour is the most vivid one on the cover, not the most frequent one. node-vibrant itself was removed in T10b: its Jimp backend carried the npm audit advisories. Colours cached from node-vibrant stay valid. Covers are YouTube thumbnails (see "Data layer & sync"). The concurrency gate + 429 backoff in `vibrant.ts` date from when covers came from the rate-limited `cdn.deathgrind.club`, and stay as a safety net for a cold build of ~2700 covers. Don't delete the cache file casually; a cold build re-fetches every cover.
  - **The colour comes from the square crop** (`web/public/covers/<videoId>.webp`, read from disk) when one exists, else from the mqdefault frame URL. `colorCacheKey()` keys a crop by video id + crop box, so a re-crop (an override) gets a fresh colour; a failed extraction is never cached.
  - **Readable variants, same hue** (`web/src/lib/accent.ts`, `readableAccent`): `text` ≥ 4.5:1 and `fill` ≥ 3:1 against `--ma-surface-2` (HSL lightness raised only as far as needed, never mixed toward white), `ink` from `inkOnAccent(fill)`, `glow` = the fill at 45% alpha. A test keeps `ACCENT_SURFACE` in step with `global.css`. That 4.5:1 holds only on `--ma-surface-2`: accent text on the accent-tinted panels of the now playing view (`--ma-raised`, `--ma-panel`) uses `--accent-raised` in `archive.css`, the same hue floored at OKLCH lightness 0.8. Raising `ACCENT_SURFACE` instead washes out blue accents, which a test forbids.
  - **Precedence** (`resolveAccent`): the album in the player (open, playing or paused) colours every page; else the page's own album colour (album, band and genre pages bake `data-accent` + the style on `<html>`); else no inline accent, so the stylesheet's amber applies. Card ▶s, `browse-index.json` and the album page's data island carry the encoded tokens (`data-accent`), so the Player never extracts a colour; it writes `--album-color` (the fill, read as `--accent`), `--accent-bright`, `--on-accent` and `--accent-glow` on `<html>`, and repaints the incoming document on `astro:before-swap`.
  - The `@property` registrations (600ms colour transitions, instant under reduced motion) and the glow behind the bar's play button live in `web/src/components/AccentTheme.astro`, rendered by `Footer.astro`, NOT in `global.css`: the bio loads `global.css` too, and any rule change there changes its hashed file name in the bio's HTML.
- **Square covers (`npm run covers`, runs before `astro build`):** a YouTube frame is 16:9 with a tracklist beside the art, so `web/scripts/covers/covers.mjs` finds the square cover in each album's `maxresdefault` frame and writes a 400px WebP to `web/public/covers/<videoId>.webp` (gitignored). The detector is `web/src/lib/coverDetect.ts` (pure TypeScript on `sharp` raw pixels, a port of the Python spike: border-ridge search, template re-score, year fallback); `cover.ts` holds the decisions (`planCover`, `coverSrc`), `coverRun.ts` the download/write loop, `coverStore.ts` the disk access. `db.ts` puts the result in `Card.cover` and in the `cover` field of `browse-index.json`; `AlbumCard.astro` and `Search.tsx` render `cover || thumb`, and CSS keeps cards square either way. State: `web/.cover-cache.json` (gitignored, keyed by video id, invalidated when `COVER_ALGO_VERSION` in `cover.ts` changes) and `web/.cover-previews/` (gitignored 320x180 frames for review). **Human decisions live in the tracked `web/src/data/cover-overrides.json`**: `{ "<videoId>": { "x": n, "y": n, "size": n } | "full" }` in 1280x720 source pixels; `"full"` means no clean square exists, so that card keeps the mqdefault frame. An override beats the detector and survives algorithm bumps. A warm run downloads nothing; one failed album is logged and keeps the mqdefault frame, and the build never fails because of covers. Without `reflex.db`, or with an override file that is not valid JSON, the step skips itself and leaves the crops and the cache as they are (running without the reviewed overrides would re-crop the albums fixed by hand). A `Retry-After` longer than 30s fails that album for this run instead of stalling the build. A `"full"` override is cached as source `override` with no box, so deleting its line lets the detector try the album again. **The first run on a host is a one-time cold run (~2,750 downloads, minutes): prime it by hand with `cd web && npm run covers` before the sync timer builds, because a cold run inside the timer could blow its timeout.** Review: `node scripts/covers/contact-sheets.mjs <outDir> [--from N --count N --source detected,template]` renders 20-tile sheets (frame with box + crop + label). Requires Node >= 22.23.4 (Astro 7; the scripts import `.ts` directly, through Node's type stripping).
- **Live-recordings rule (important business logic, in `db.ts`):** albums whose title contains `live in` or `(live` are Daniel's OWN live sets, not studio releases. They are **excluded from the main home/browse feeds** and surfaced in a separate "Live Recordings" section. Use the `NOT_LIVE` / `LIVE_MATCH` predicates and `isLiveRecording()` instead of re-implementing the match. `isLiveRecording()` lives in `web/src/lib/live.ts` (no `better-sqlite3`, so the Search island can import it) and `db.ts` re-exports it.
- **URL slugs go through `slugify()`** (`web/src/lib/slug.ts`, re-exported by `db.ts`) — the single source of truth imported by BOTH the `getStaticPaths()` that *generate* band/genre/country paths and the pages and the Search island that *render* links to them, so the two can never drift. It has an ascii fallback for names with no latin alphanumerics (e.g. Cyrillic), which would otherwise collapse to `""` and crash the static build with `Missing parameter`. Never hand-roll a slug; call `slugify()`.
- **DB values are Spanish, the UI is English — translate in `web/src/lib/labels.ts`.** `albums.country` holds Spanish names (`Estados Unidos`, `Alemania`) because that is what the YouTube sync writes, and `albums.genre` holds one Spanish placeholder (`Género desconocido`). `labels.ts` is the single source of truth mapping a raw DB value to its English label + flag: `countryLabel()`, `countryFlag()`, `genreLabel()`. **Slugs and query values must keep using the RAW database value** — that is why `/metal-archive/country/estados-unidos` still works and no inbound link broke. Never render `album.country` or a country facet value directly; never hardcode a flag map (it used to be copy-pasted into two pages).
- **Bio identity links:** social URLs live in the `SOCIAL` map at the top of `index.astro`. The page also emits a JSON-LD `Person` whose `sameAs` (plus `rel="me"` on the icon links) tells search engines that this site and the engineering portfolio `danielbanariba.dev` are the same person. A new profile goes in `SOCIAL`, `sameAs` and the icon row together.
- **Canonical origin is `https://danielbanariba.com`**, declared once as `site` in `astro.config.mjs`. Every page needs an absolute `<link rel="canonical">`. Archive pages previously pointed at `xeroxunderground.com`, a domain that does not resolve.
- **`web/src/pages/sitemap.xml.ts`** generates the sitemap at build time from `db.ts` using the same `slugify()` as `getStaticPaths()`, so it can never list a path the build did not emit. `web/public/robots.txt` points at it. Add new page types to both the route and the sitemap.
- **Styling:** one global stylesheet, `web/src/styles/global.css`: the bio's and the 404's look, the shared form classes and the Player's base rules. The archive's look lives in `web/src/styles/archive.css` (the shell, see "Archive shell"), which archive pages load after it, together with the archive-only accent block in `web/src/components/AccentTheme.astro` (see "Per-album color theming"). (The old per-component Reflex styles that used to live in `links_bio/styles/` were deleted with the rest of the Reflex UI tree — see "What is live vs. legacy".)

## Forms backend (`links_bio/fastapi_forms.py`)

- Standalone FastAPI app, run with uvicorn on port 8001 as the system unit **`metal-archive-forms.service`**
  (`User=banar`, `Restart=always` — not a Reflex-hosted route, and not a repo-tracked systemd file; it
  lives directly in `/etc/systemd/system/`).
- POST endpoints: `/api/metal-archive/submit`, `/promo`, `/newsletter`, `/contact`. Contact's fields are
  `name`/`email`/`subject`/`message` (matching what `index.astro`'s form actually sends — see T27 in
  `odd/tasks/platform-hardening.md` for the contract bug this fixed).
- Hardened against abuse: a sliding-window rate limiter (5 requests/10 min shared across
  submit/promo/contact, 10/10 min for newsletter, keyed on `CF-Connecting-IP` only when the peer is the
  cloudflared loopback tunnel), a silently-dropped `website` honeypot field on all 4 forms, a `max_length`
  on every field, and a CRLF rejection on single-line fields (blocks header/SMTP injection via a
  `\r\n`-laced value). The interactive API docs are disabled in code (`docs_url=None`, `openapi_url=None`),
  not just hidden by tunnel routing.
- Writes to the same `reflex.db` using the SQLModel models, and reuses `_send_email_notification` from
  `links_bio/states/form_state.py` (Gmail SMTP) for email alerts.
- CORS is allow-listed (`ALLOWED_ORIGINS`): `danielbanariba.com`, `localhost:4321` (Astro dev), `:3000`. Add new dev origins there.

## Data layer & sync (`links_bio/`, root scripts)

- **`reflex.db` (SQLite) is the source of truth.** Schema = SQLModel models in `links_bio/models/`: `albums` (main catalog, many indexed columns), `tracks`, `similar_bands` (column is `similar_band_name`), `submissions`, `newsletter_subscribers`, `contact_messages`. Migrations live in `alembic/`. Models are discovered for migrations via `import links_bio.models` in `links_bio/links_bio.py`.
- **Sync scripts (project root):** `sync_youtube_to_db.py` (YouTube → DB, marks featured — also sets
  `album_artwork_url` to the video's best YouTube thumbnail, the cover source of truth, on every full
  sync), plus `scripts/normalize_db.py` (normalize genre/country), `scripts/reparse_old_tracklists.py`,
  `scripts/seed_data.py`. `sync_all.sh` orchestrates the DB-only chain manually (no deploy). The external
  cover steps were removed (see below):
  - `sync_artwork_deathgrind.py`, together with the one-off `scripts/fix_artwork_mismatch.py`;
  - `sync_artwork_fallback.py`. Its Metal Archives covers would be overwritten by the next full sync, and
    its maxres upgrade duplicated what the sync already does.
- **One production sync+deploy trigger:** the user systemd timer **`links-bio-sync.timer`** (`06:00` &
  `18:00`, `~/.config/systemd/user/`) runs **`links-bio-sync.service`** once (`Type=oneshot`), which calls
  `scripts/sync_and_deploy.py`. That script imports `links_bio/background_sync.py`'s `run_*` step
  functions directly (youtube sync → normalize → Astro build+deploy) and exits — there is no long-lived
  process and no daemon thread. This replaced the old split between a DB-only `sync_web.timer` and an
  in-app Reflex daemon thread, both retired once the Reflex app itself was removed (T5/T7). A failure
  triggers `OnFailure=notify-failure@%n.service` (`scripts/notify_failure.py`), the single email alert
  mechanism for every systemd unit in this project — see "Deployment" below.
- **Merges deploy on their own, and never alongside the sync.** `links-bio-deploy.timer` (every 5 min)
  runs `scripts/deploy_on_merge.py`, which pulls a new merge and builds+deploys it (see "Deployment").
  Both jobs hold one lock, `links_bio/deploy_lock.py` (an `flock` on the gitignored `.deploy.lock`), for
  their whole run. The deploy skips its tick while the lock is busy. The sync waits up to 65 minutes
  (`LOCK_WAIT_SECONDS`, longer than a deploy can run) and fails loudly past that, which is why
  `links-bio-sync.service` has `TimeoutStartSec=7500`.
- **There is no artwork step; YouTube thumbnails are the only cover source.** `sync_youtube_to_db.py`
  writes `album_artwork_url` from the video thumbnail on insert and on every full sync. The DeathGrind.club
  step (`run_artwork_sync()`, `sync_artwork_deathgrind.py`, `--skip-artwork`) was removed in Oct 2026 for two reasons:
  - `cdn.deathgrind.club` sends `Cross-Origin-Resource-Policy: same-site`, so browsers block those covers
    on this site.
  - Each full sync overwrote the covers the step had found, so a ~2700-album backlog kept coming back,
    and that backlog blew the sync unit's timeout.

  Any DeathGrind URL still in the DB is replaced by the next full sync. To force one, run
  `scripts/sync_and_deploy.py --full-youtube-sync`.
- **YouTube auth:** `links_bio/youtube_auth.py` supports API Key or OAuth refresh token. Token helpers: `get_refresh_token.py`, `scripts/regenerate_youtube_token.py`.

## Deployment

**Two independent traffic paths (decision D7), not one Cloudflare → Caddy → Reflex chain:**
- **The apex, `danielbanariba.com`** (the static site), is served **directly by Vercel**. Nothing on
  this host proxies it — no cloudflared tunnel, no Caddy. This is the path described below.
- **`app.danielbanariba.com`** (the forms API) is tunneled through `cloudflared` straight to
  `metal-archive-forms.service` on `:8001` (`/api/metal-archive/.*`). There is no `/webhook` route and
  no `:8000` Reflex catch-all anymore — both were removed with the webhook (D4) and Reflex itself (T7).
  `cloudflared-config.yml` in this repo is a sanitized mirror of the real, host-only
  `/etc/cloudflared/config.yml`.

**Host cutover note** (sudo, run on the host — not from this repo): edit
`/etc/cloudflared/config.yml` to match `cloudflared-config.yml`, then `sudo systemctl restart
cloudflared`; drop the `:8080` block from `/etc/caddy/Caddyfile` (per D7, Caddy no longer proxies
anything for this site), then `sudo systemctl reload caddy`; confirm `curl -sI
https://danielbanariba.com/` still shows `server: Vercel`, unaffected by the Caddy change.

- **Production = Astro static build deployed to Vercel** with `vercel deploy --prod --prebuilt`, run **from the host** (the only machine with `reflex.db`). The Vercel project link lives in `web/.vercel/`,
  and the **CLI is invoked from `web/`**. `--prebuilt` uploads only the already-built `web/.vercel/output`
  directory — it does **not** re-read `web/vercel.json` at deploy time, so `web/vercel.json`'s declared
  `headers` are NOT live on their own: `curl -sI https://danielbanariba.com/` used to show none of them.
  `npm run build` (`web/package.json`) now also runs `web/scripts/apply-vercel-headers.mjs` right after
  `astro build`, which merges `web/vercel.json`'s `headers` into `web/.vercel/output/config.json`'s
  `routes` as `{src, headers, continue: true}` entries placed before `{handle: "filesystem"}` (see "The
  Astro frontend" above); `web/vercel.json` stays the one declared source. The **root `vercel.json`**
  (`cleanUrls` + `trailingSlash`) is dead config: the Astro adapter never copies it into
  `.vercel/output/config.json`, and no deploy path `cd`s to the repo root before running `vercel`. It is
  left in place, not deleted, in case a future deploy path starts running from the root.
- **Three deploy paths, all preferring `VERCEL_TOKEN`** (decision D2): (1) the **`links-bio-sync.timer`**
  systemd unit, twice a day (see "Data layer & sync"); (2) the **`links-bio-deploy.timer`** merge deploy
  (below); (3) the `.git/hooks/pre-push` hook, which
  **auto-deploys production when `main` is pushed** and aborts the push if build/deploy fails
  (`git push --no-verify` to skip). All fall back to the logged-in Vercel CLI session when
  `VERCEL_TOKEN` is unset — **do not rely on that fallback for the unattended timer**: a logged-in
  session can expire silently, which is exactly what caused `vercel deploy` to fail on every cycle for
  3+ weeks (Sep–Oct 2026) with nobody told, until the `notify-failure@.service` alert mechanism
  described above existed to say so. `deploy_to_vercel()` (`links_bio/background_sync.py`) now runs a
  `vercel whoami` preflight before every deploy — with the same env/cwd/auth argv, capped at 60s — so
  an expiring CLI session gets a chance to refresh itself before the long upload starts instead of
  during it; if the deploy still fails with "Not authorized", it re-checks whoami and retries the
  deploy exactly once. This closes the 2026-10-07 incident where the CLI rewrote its session token in
  the middle of an in-flight deploy and the request was rejected. Both the whoami and deploy
  subprocesses run through a shared `_run_vercel()` helper that streams Vercel's own output line by
  line as it arrives instead of buffering it until exit, so a hung upload (or a unit killed by its own
  timeout) still leaves something in the journal and the OnFailure email.
  `_run_vercel()` also runs every `vercel` subprocess with `CI=1`. The host's CLI config
  (`~/.local/share/com.vercel.cli/config.json`) has `updates.auto: true`. With it, any successful
  command on the global install makes the CLI run `npm i -g vercel@latest` on itself. On 2026-10-13
  that upgrade (63.1.2 → 64.0.2) swapped the package's files under the still-running deploy. The
  deploy was already live, but the old process crashed importing a chunk that no longer existed,
  exited 1, and failed the unit. The CLI skips the self-upgrade under CI. Manual `vercel` runs on the
  host still auto-update.
- **Merge → deploy: `links-bio-deploy.timer`** runs `scripts/deploy_on_merge.py` every 5 minutes, a
  oneshot under `OnFailure=notify-failure@%n.service`. It fetches `main` anonymously over HTTPS
  (`DEPLOY_REPO_URL` overrides the URL), and when a merge landed it fast-forwards the host checkout and
  runs only what the paths changed since the last good deploy need, in this order:
  - `web/package*.json` → `npm ci`;
  - `requirements*.txt` → `pip install -r requirements-dev.txt`;
  - always the Astro build+deploy (`npm run build` already runs the covers step);
  - `links_bio/` or a requirements file → `systemctl restart metal-archive-forms.service`. It is a system
    unit, so the polkit rule `systemd/polkit/50-links-bio-forms-restart.rules` allows exactly that restart.

  The gitignored `.deploy-state.json` holds `deployed_sha`, `failed_sha` and `fetch_failures`. With no
  file, or a malformed one, the next tick runs the full plan.
  - **Alert once:** a failure exits non-zero (one email) and records `failed_sha` = origin/main; later
    ticks skip that sha. A new merge retries, re-planning from the last good deploy. To retry the same
    sha, remove `failed_sha` from `.deploy-state.json`.
  - **Outages alert once:** a failed fetch (GitHub or the network down) only bumps `fetch_failures`
    and exits 0. The 12th in a row (an hour) fails the unit once; the next good fetch resets the count.
  - **Refusals:** it alerts and does not pull when the checkout is not on `main`, has tracked changes, or
    cannot fast-forward.
  - **Migrations:** when the range not pulled yet touches `alembic/versions/`, it does not pull, because
    `reflex.db`'s PII cannot be regenerated. Back up the DB, run `git pull --ff-only` and `alembic upgrade
    head`, then remove `failed_sha`; the next tick deploys. Before any install, build, deploy or restart
    it also checks, read-only, that `reflex.db` (`REFLEX_DB_URL` or the default) is at the checkout's
    alembic head, which catches a migration someone pulled by hand. If not, it alerts once and asks for
    a backup, `alembic upgrade head` and removing `failed_sha`.

  One-time bootstrap on the host. The first tick has no state file, so it runs the full plan and deploys:
  ```bash
  cd ~/Desktop/links-bio && git pull --ff-only
  sudo cp systemd/polkit/50-links-bio-forms-restart.rules /etc/polkit-1/rules.d/
  cp systemd/links-bio-deploy.service systemd/links-bio-deploy.timer systemd/links-bio-sync.service ~/.config/systemd/user/
  systemctl --user daemon-reload && systemctl --user enable --now links-bio-deploy.timer
  ```
- **CI auto-deploy is intentionally OFF** (`.github/workflows/deploy.yml` is a no-op reminder). A GitHub runner has no `reflex.db`, so a CI build would publish an empty/stale site. Merges reach production through `links-bio-deploy.timer` on the host instead.

## Backups

`reflex.db` holds non-regenerable PII (contact messages, newsletter emails, band submissions) and has
no copy anywhere but the host disk. Encrypted, off-host backups close that gap (decision D1):
- `scripts/backup_reflex_db.sh` takes a consistent snapshot with `sqlite3 reflex.db ".backup <path>"`
  (never a raw `cp` of a live file), verifies `PRAGMA integrity_check = ok`, then pushes it with
  `restic` to whichever repository the host is configured for (Backblaze B2 or SFTP — destination-
  agnostic). Run by the user systemd units `reflex-db-backup.{service,timer}`.
- `reflex-db-restore-test.{service,timer}` periodically restores the latest snapshot into a scratch
  directory and fails if it is stale (older than `MAX_SNAPSHOT_AGE_HOURS`) or fails integrity — a backup
  that was never test-restored is not a backup.
- Credentials live in a **separate** env file (`~/.config/reflex-backup/env`, `chmod 600`, not this
  repo's `.env`); see `systemd/reflex-db-backup.env.example` for the variables it reads
  (`RESTIC_REPOSITORY`, `RESTIC_PASSWORD_FILE`, retention knobs).
- Failures alert through the same `notify-failure@.service` mechanism as sync/deploy (see "Data layer & sync" above) — one email per failed unit, with secrets redacted from the journal tail it includes.

## What is live vs. legacy

The **pre-migration Reflex stack is gone, not just "legacy."** The old `links_bio/pages/`, `views/`,
`components/`, `styles/` UI tree, `links_bio/links_bio.py`, `rxconfig.py`, `webhook.py`, the matching
`links-bio*.service`/`links-bio-webhook.service` units, and the dead `astro-spike/`/root `public/`
directories were all deleted once nothing in the live sync/forms/data path still imported `reflex`
(commit range `ed79c15`..`3af4177`, Oct 2026 — see T6/T7 in `odd/tasks/platform-hardening.md`). There is
no dead Reflex code left in this repo to accidentally edit; the table below is now short because of that.

| Live (edit these) | Notes |
|---|---|
| `web/` (Astro site) | The whole frontend. |
| `links_bio/fastapi_forms.py` (forms) | Runs as `metal-archive-forms.service` (a host system unit, not tracked here). |
| `links_bio/models/` (DB schema) | Plain SQLModel; Alembic drives it directly (no `reflex db`). |
| `links_bio/background_sync.py` + sync scripts + `scripts/sync_and_deploy.py` | Oneshot pipeline, triggered by `links-bio-sync.timer`. No daemon thread. |
| `scripts/deploy_on_merge.py` + `links_bio/deploy_lock.py` | Oneshot merge deploy, triggered by `links-bio-deploy.timer` every 5 minutes. |
| `reflex.db` (data) | Lives only on the host (gitignored); backed up by `scripts/backup_reflex_db.sh`. |

`cloudflared-config.yml` is a sanitized mirror of the real `/etc/cloudflared/config.yml` (see
"Deployment" for the live ingress topology it describes). `caddy-block.txt`, which used to document a
Caddy `:8080` block proxying to the Reflex app, was deleted (D7): the apex is served directly by Vercel
now, and nothing on this host proxies it through Caddy.

`links_bio/states/form_state.py` is live for one reason only: `fastapi_forms.py` imports its
`_send_email_notification` helper (Gmail SMTP) for form notification emails. There is no Reflex
`FormState` class left for it to otherwise belong to.

## Environment variables

Stored in `.env` (gitignored, read by both `links-bio-sync.{service,timer}` and `metal-archive-forms.service`
via `EnvironmentFile=`). See `mcp/server.py` `REQUIRED_ENV_VARS`.
- `YOUTUBE_API_KEY` **or** (`YOUTUBE_CLIENT_ID` + `YOUTUBE_CLIENT_SECRET` + `YOUTUBE_REFRESH_TOKEN`) — enables sync.
- `GMAIL_ADDRESS`, `GMAIL_APP_PASSWORD` — SMTP for form notifications and failure alert emails.
- `VERCEL_TOKEN` — the unattended deploy path (decision D2): set it so the sync timer and the pre-push
  hook don't depend on a logged-in Vercel CLI session, which can expire silently. Falls back to that
  session when unset.
- `PUBLIC_API_BASE` (Astro build/dev) — base URL the forms POST to; defaults to `https://app.danielbanariba.com`.
- `REFLEX_DB` / `REFLEX_DB_URL` — override DB path for Astro build / FastAPI+Alembic respectively.

Backup credentials are intentionally **not** here — they live in a separate `~/.config/reflex-backup/env`
file so a leaked `.env` can't also leak the off-host backup repository (see "Backups").

## Project tooling

- **Project MCP server** (`mcp/server.py`, wired in `.mcp.json`) exposes health/validation tools: `lint_project` (ruff on `links_bio/`), `check_db_schema` / `check_migrations_pending`, `validate_env_vars`, `count_models_in_db`, `test_metal_archive_pages`, `check_vercel_deploy`. Some tools (`check_reflex_server`, `check_reflex_cloud`) target the pre-migration Reflex deployment and are stale. It runs on mcp 2.x (`from mcp.server import MCPServer`; 1.x's `FastMCP` is gone). The v2 stdio server still answers the 2025-era `initialize` handshake, so the Claude Code client needs no change.
- **Design reference:** `design-system/MASTER.md` documents the visual language (the "Xerox Underground" palette, primary cyan `#0073a8`, etc.); its implementation-specific notes now point at the live Astro styling, not the deleted Reflex components (see that file's own history note).

## Commits & PRs

- Commit messages use **Gitmoji + Conventional Commits**: `<gitmoji> <type>(<scope>): <description>`,
  gitmoji as a `:shortcode:` (`:bug:` fix, `:sparkles:` feat, `:memo:` docs, `:recycle:` refactor,
  `:white_check_mark:` test, `:hammer:` chore/build). Template: `templates/commit-template.en.git.txt`.
  Never add AI attribution (`Co-Authored-By` naming an AI, "Generated with", etc.) — a global
  `commit-msg` hook rejects it.
- PRs use `.github/pull_request_template.md`: a one-minute description (commit-format first line +
  detailed context), a verification checklist for this stack, and optional attachments.
