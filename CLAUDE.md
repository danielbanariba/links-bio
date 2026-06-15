# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal site for Daniel Banariba. Two sections, one static site, all user-facing content in **Spanish**:
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

### Database / migrations (Reflex's Alembic wrapper)
```bash
source env/bin/activate
reflex db makemigrations --message "description"   # after editing links_bio/models/
reflex db migrate
# build.sh automates first-time setup: pip install + reflex init + db init/migrate
```

### Data sync (populate reflex.db)
```bash
source env/bin/activate
./sync_all.sh                                  # full pipeline: youtube → artwork → fallback → normalize
python sync_youtube_to_db.py --solo-nuevos --mark-featured   # individual steps also runnable
```

### Deploy the static site (run on the host — only it has reflex.db)
```bash
cd web && npm run build && vercel deploy --prod --prebuilt
```
The same build+deploy also fires automatically from (a) the in-app sync (`links_bio/background_sync.py`) and (b) the **`.git/hooks/pre-push` hook whenever `main` is pushed**. Both reuse the logged-in Vercel CLI session, so `VERCEL_TOKEN` is optional (set it only for CI). ⚠️ **Pushing `main` deploys to production** — `git push --no-verify` bypasses the hook once.

## The Astro frontend (`web/`) — the live site

- **Astro 6, `output: 'static'`, Vercel adapter, Preact islands.** `better-sqlite3` is kept Vite-external (native module) — see `astro.config.mjs`. The adapter also injects **Vercel Web Analytics** (`webAnalytics: { enabled: true }`) into all 11 pages at build (still must be turned on in the Vercel dashboard to collect data).
- **`web/src/lib/db.ts` is the single DB gateway.** ALL database access goes through it — no inline DB opens in pages. It opens one read-only connection and exposes typed query functions (home feeds, album detail, facets, band pages, browse index). When a page needs data, add/return a function here.
- **Routing:** `web/src/pages/index.astro` is the bio at `/`. The Metal Archive lives under `web/src/pages/metal-archive/` — the **folder provides the `/metal-archive` path prefix** (there is intentionally no `base` in the config), so public URLs are unchanged. Dynamic pages (`album/[id]`, `band/[band]`, `genre/[genre]`, `country/[country]`, `year/[year]`) enumerate paths via `getStaticPaths()` backed by `db.ts`.
- **Islands (client JS, Preact):** `web/src/islands/Player.tsx` (audio/YouTube player, synchronous-click autoplay) and `Search.tsx` (client-side search over `/browse-index.json`). `browse-index.json` is generated from `getBrowseIndex()` at build and read by Search + Navbar.
- **Per-album color theming:** `web/src/lib/vibrant.ts` extracts a dominant color per cover at build time (node-vibrant + `sharp` for webp decode), cached in `web/.vibrant-cache.json` so unchanged covers skip re-extraction. ~1300 covers behind a rate-limited CDN → it uses a concurrency gate + 429 backoff. Don't delete the cache file casually; a cold build re-fetches every cover.
- **Live-recordings rule (important business logic, in `db.ts`):** albums whose title contains `live in` or `(live` are Daniel's OWN live sets, not studio releases. They are **excluded from the main home/browse feeds** and surfaced in a separate "Live Recordings" section. Use the `NOT_LIVE` / `LIVE_MATCH` predicates and `isLiveRecording()` instead of re-implementing the match.
- **URL slugs go through `slugify()` in `db.ts`** — the single source of truth imported by BOTH the `getStaticPaths()` that *generate* band/genre/country paths and the pages that *render* links to them, so the two can never drift. It has an ascii fallback for names with no latin alphanumerics (e.g. Cyrillic), which would otherwise collapse to `""` and crash the static build with `Missing parameter`. Never hand-roll a slug; call `slugify()`.
- **Styling:** one global stylesheet, `web/src/styles/global.css`. (The old per-component Reflex styles in `links_bio/styles/` are legacy — don't edit them for site changes.)

## Forms backend (`links_bio/fastapi_forms.py`)

- Standalone FastAPI app, run with uvicorn on port 8001 (NOT mounted inside Reflex).
- POST endpoints: `/api/metal-archive/submit`, `/promo`, `/newsletter`, `/contact`.
- Writes to the same `reflex.db` using the SQLModel models, and reuses `_send_email_notification` from `links_bio/states/form_state.py` (Gmail SMTP) for email alerts.
- CORS is allow-listed (`ALLOWED_ORIGINS`): `danielbanariba.com`, `localhost:4321` (Astro dev), `:3000`. Add new dev origins there.

## Data layer & sync (`links_bio/`, root scripts)

- **`reflex.db` (SQLite) is the source of truth.** Schema = SQLModel models in `links_bio/models/`: `albums` (main catalog, many indexed columns), `tracks`, `similar_bands` (column is `similar_band_name`), `submissions`, `newsletter_subscribers`, `contact_messages`. Migrations live in `alembic/`. Models are discovered for migrations via `import links_bio.models` in `links_bio/links_bio.py`.
- **Sync scripts (project root):** `sync_youtube_to_db.py` (YouTube → DB, marks featured), `sync_artwork_deathgrind.py` and `sync_artwork_fallback.py` (album covers), plus `scripts/normalize_db.py` (normalize genre/country), `scripts/reparse_old_tracklists.py`, `scripts/seed_data.py`. `sync_all.sh` orchestrates the full chain.
- **Two sync triggers exist (don't be surprised by both):**
  - **systemd** `sync_web.timer` (06:00 & 18:00) → `sync_web.service` → `sync_all.sh`. Updates the DB; does **not** deploy.
  - **In-app** `links_bio/background_sync.py` — a daemon thread started by the Reflex app, every `SYNC_INTERVAL_HOURS` (12h). Runs sync → normalize → artwork → **then rebuilds & deploys the Astro site to Vercel** (`_run_astro_deploy`). Only activates when `YOUTUBE_API_KEY` or `YOUTUBE_REFRESH_TOKEN` is set. The deploy is **tokenless** — it reuses the logged-in Vercel CLI session and resolves npm/vercel from nvm's bin (`_find_node_bin`, since the reflex process PATH lacks it); `VERCEL_TOKEN` is honoured if present but not required.
- **YouTube auth:** `links_bio/youtube_auth.py` supports API Key or OAuth refresh token. Token helpers: `get_refresh_token.py`, `scripts/regenerate_youtube_token.py`.

## Deployment

- **Production = Astro static build deployed to Vercel** with `vercel deploy --prod --prebuilt`, run **from the host** (the only machine with `reflex.db`). Root `vercel.json` only sets `cleanUrls` + `trailingSlash`; the Vercel project link lives in `web/.vercel/`.
- **Three deploy paths, all host-local and tokenless** (they reuse the logged-in Vercel CLI): (1) manual `npm run build && vercel deploy --prod --prebuilt`; (2) the `.git/hooks/pre-push` hook, which **auto-deploys production when `main` is pushed** and aborts the push if build/deploy fails (`git push --no-verify` to skip); (3) `background_sync.py` after an in-app sync. `VERCEL_TOKEN` is only needed for a non-interactive/CI context.
- **CI auto-deploy is intentionally OFF** (`.github/workflows/deploy.yml` is a no-op reminder). A GitHub runner has no `reflex.db`, so a CI build would publish an empty/stale site. Deploy locally or let `background_sync.py` / the pre-push hook do it.

## What is live vs. legacy

The repo still contains the **pre-migration Reflex stack**. It is NOT the live site — touching it does not change production. Know the difference before editing:

| Live (edit these) | Legacy / superseded (usually don't edit) |
|---|---|
| `web/` (Astro site) | `links_bio/pages/`, `views/`, `components/`, `styles/` (old Reflex UI) |
| `links_bio/fastapi_forms.py` (forms) | `links_bio/states/metal_archive_state.py` (old page state) |
| `links_bio/models/` (DB schema) | `links_bio/links_bio.py`, `rxconfig.py` (Reflex app entry/config) |
| `links_bio/background_sync.py` + sync scripts | `caddy-block.txt`, `cloudflared-config.yml`, `links-bio*.service`, `webhook.py` (old self-hosted Reflex serving via Cloudflare tunnel → Caddy → Reflex :8000/:3000) |
| `reflex.db` (data) | `astro-spike/` (abandoned POC, gitignored), root `public/` (old Reflex export) |

`links_bio/states/form_state.py` is partly live: its `_send_email_notification` helper is reused by FastAPI, even though the `FormState` Reflex class itself is legacy. Running `reflex run` still serves the OLD UI and starts `background_sync` — useful as the host process that drives sync/deploy, but it is not what users see.

## Environment variables

Stored in `.env` (gitignored). See `mcp/server.py` `REQUIRED_ENV_VARS`.
- `YOUTUBE_API_KEY` **or** (`YOUTUBE_CLIENT_ID` + `YOUTUBE_CLIENT_SECRET` + `YOUTUBE_REFRESH_TOKEN`) — enables sync.
- `GMAIL_ADDRESS`, `GMAIL_APP_PASSWORD` — SMTP for form notifications.
- `VERCEL_TOKEN` — **optional**; deploys reuse the logged-in Vercel CLI session by default. Set only for non-interactive/CI deploys.
- `SYNC_INTERVAL_HOURS` (default 12), `SYNC_STARTUP_DELAY` (default 60) — in-app sync timing.
- `PUBLIC_API_BASE` (Astro build/dev) — base URL the forms POST to; defaults to `https://app.danielbanariba.com`.
- `REFLEX_DB` / `REFLEX_DB_URL` — override DB path for Astro build / FastAPI respectively.

## Project tooling

- **Project MCP server** (`mcp/server.py`, wired in `.mcp.json`) exposes health/validation tools: `lint_project` (ruff on `links_bio/`), `check_db_schema` / `check_migrations_pending`, `validate_env_vars`, `count_models_in_db`, `test_metal_archive_pages`, `check_vercel_deploy`. Some tools (`check_reflex_server`, `check_reflex_cloud`) target the pre-migration Reflex deployment and are stale.
- **Design reference:** `design-system/MASTER.md` documents the visual language (the "Xerox Underground" palette, primary cyan `#0073a8`, etc.).
