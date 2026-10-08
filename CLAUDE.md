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
cd web && npm run build           # the real check: getStaticPaths() crashes the build on a bad slug/param
```
The `env -u` flags keep real secrets out of the test process (tests use a scratch DB and a stubbed
mailer). The project MCP tool `test_metal_archive_pages` smoke-tests the rendered archive pages.

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
Production also deploys automatically (a) twice a day from the `links-bio-sync.timer` systemd unit
(see "Data layer & sync"), and (b) from the **`.git/hooks/pre-push` hook whenever `main` is pushed**.
Both prefer `VERCEL_TOKEN` when it is set in `.env` (decision D2: a logged-in CLI session can expire
silently, which is exactly what caused 3+ weeks of silently-failing deploys in Sep 2026) and fall back
to the logged-in CLI session otherwise. ⚠️ **Pushing `main` deploys to production** — `git push --no-verify` bypasses the hook once.

## The Astro frontend (`web/`) — the live site

- **Astro 6, `output: 'static'`, Vercel adapter, Preact islands.** `better-sqlite3` is kept Vite-external (native module) — see `astro.config.mjs`. The adapter also injects **Vercel Web Analytics** (`webAnalytics: { enabled: true }`) into all 11 pages at build (still must be turned on in the Vercel dashboard to collect data).
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
  the filesystem handle, which is the only position that takes effect.
- **`web/src/lib/db.ts` is the single DB gateway.** ALL database access goes through it — no inline DB opens in pages. It opens one read-only connection and exposes typed query functions (home feeds, album detail, facets, band pages, browse index). When a page needs data, add/return a function here.
- **Routing:** `web/src/pages/index.astro` is the bio at `/`. The Metal Archive lives under `web/src/pages/metal-archive/` — the **folder provides the `/metal-archive` path prefix** (there is intentionally no `base` in the config), so public URLs are unchanged. Dynamic pages (`album/[id]`, `band/[band]`, `genre/[genre]`, `country/[country]`, `year/[year]`) enumerate paths via `getStaticPaths()` backed by `db.ts`.
- **Islands (client JS, Preact):** `web/src/islands/Player.tsx` (audio/YouTube player, synchronous-click autoplay) and `Search.tsx` (client-side search over `/browse-index.json`). `browse-index.json` is generated from `getBrowseIndex()` at build and read by Search + Navbar.
- **Per-album color theming:** `web/src/lib/vibrant.ts` extracts a dominant color per cover at build time (node-vibrant + `sharp` for webp decode), cached in `web/.vibrant-cache.json` so unchanged covers skip re-extraction. Covers are YouTube thumbnails (see "Data layer & sync"). The concurrency gate + 429 backoff in `vibrant.ts` date from when covers came from the rate-limited `cdn.deathgrind.club`, and stay as a safety net for a cold build of ~2700 covers. Don't delete the cache file casually; a cold build re-fetches every cover.
- **Live-recordings rule (important business logic, in `db.ts`):** albums whose title contains `live in` or `(live` are Daniel's OWN live sets, not studio releases. They are **excluded from the main home/browse feeds** and surfaced in a separate "Live Recordings" section. Use the `NOT_LIVE` / `LIVE_MATCH` predicates and `isLiveRecording()` instead of re-implementing the match.
- **URL slugs go through `slugify()` in `db.ts`** — the single source of truth imported by BOTH the `getStaticPaths()` that *generate* band/genre/country paths and the pages that *render* links to them, so the two can never drift. It has an ascii fallback for names with no latin alphanumerics (e.g. Cyrillic), which would otherwise collapse to `""` and crash the static build with `Missing parameter`. Never hand-roll a slug; call `slugify()`.
- **DB values are Spanish, the UI is English — translate in `web/src/lib/labels.ts`.** `albums.country` holds Spanish names (`Estados Unidos`, `Alemania`) because that is what the YouTube sync writes, and `albums.genre` holds one Spanish placeholder (`Género desconocido`). `labels.ts` is the single source of truth mapping a raw DB value to its English label + flag: `countryLabel()`, `countryFlag()`, `genreLabel()`. **Slugs and query values must keep using the RAW database value** — that is why `/metal-archive/country/estados-unidos` still works and no inbound link broke. Never render `album.country` or a country facet value directly; never hardcode a flag map (it used to be copy-pasted into two pages).
- **Bio identity links:** social URLs live in the `SOCIAL` map at the top of `index.astro`. The page also emits a JSON-LD `Person` whose `sameAs` (plus `rel="me"` on the icon links) tells search engines that this site and the engineering portfolio `danielbanariba.dev` are the same person. A new profile goes in `SOCIAL`, `sameAs` and the icon row together.
- **Canonical origin is `https://danielbanariba.com`**, declared once as `site` in `astro.config.mjs`. Every page needs an absolute `<link rel="canonical">`. Archive pages previously pointed at `xeroxunderground.com`, a domain that does not resolve.
- **`web/src/pages/sitemap.xml.ts`** generates the sitemap at build time from `db.ts` using the same `slugify()` as `getStaticPaths()`, so it can never list a path the build did not emit. `web/public/robots.txt` points at it. Add new page types to both the route and the sitemap.
- **Styling:** one global stylesheet, `web/src/styles/global.css`. (The old per-component Reflex styles that used to live in `links_bio/styles/` were deleted with the rest of the Reflex UI tree — see "What is live vs. legacy".)

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
- **Two deploy paths, both preferring `VERCEL_TOKEN`** (decision D2): (1) the **`links-bio-sync.timer`**
  systemd unit, twice a day (see "Data layer & sync"); (2) the `.git/hooks/pre-push` hook, which
  **auto-deploys production when `main` is pushed** and aborts the push if build/deploy fails
  (`git push --no-verify` to skip). Both fall back to the logged-in Vercel CLI session when
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
- **CI auto-deploy is intentionally OFF** (`.github/workflows/deploy.yml` is a no-op reminder). A GitHub runner has no `reflex.db`, so a CI build would publish an empty/stale site. Deploy locally, or let the sync timer / the pre-push hook do it.

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

- **Project MCP server** (`mcp/server.py`, wired in `.mcp.json`) exposes health/validation tools: `lint_project` (ruff on `links_bio/`), `check_db_schema` / `check_migrations_pending`, `validate_env_vars`, `count_models_in_db`, `test_metal_archive_pages`, `check_vercel_deploy`. Some tools (`check_reflex_server`, `check_reflex_cloud`) target the pre-migration Reflex deployment and are stale.
- **Design reference:** `design-system/MASTER.md` documents the visual language (the "Xerox Underground" palette, primary cyan `#0073a8`, etc.); its implementation-specific notes now point at the live Astro styling, not the deleted Reflex components (see that file's own history note).

## Commits & PRs

- Commit messages use **Gitmoji + Conventional Commits**: `<gitmoji> <type>(<scope>): <description>`,
  gitmoji as a `:shortcode:` (`:bug:` fix, `:sparkles:` feat, `:memo:` docs, `:recycle:` refactor,
  `:white_check_mark:` test, `:hammer:` chore/build). Template: `templates/commit-template.en.git.txt`.
  Never add AI attribution (`Co-Authored-By` naming an AI, "Generated with", etc.) — a global
  `commit-msg` hook rejects it.
- PRs use `.github/pull_request_template.md`: a one-minute description (commit-format first line +
  detailed context), a verification checklist for this stack, and optional attachments.
