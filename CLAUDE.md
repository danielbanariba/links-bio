# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal portfolio website for Daniel Banariba built with **Reflex 0.8.28.post1** (Python web framework). Two main sections:
1. **Portfolio/Bio** — social links, audiovisual projects (music videos), contact info
2. **Metal Archive** — database-driven catalog of underground metal albums with search, filtering, band submissions, newsletter, and promo packages

All user-facing content is in Spanish.

## Development Commands

```bash
source env/bin/activate          # Required before all commands (Python 3.13 venv)
pip install -r requirements.txt  # Install deps (reflex[db], google-api-python-client, google-auth)
reflex run                       # Dev server with hot reload

# Database setup / migrations (via Reflex's built-in Alembic wrapper)
reflex db init
reflex db makemigrations --message "description"
reflex db migrate

# Production setup (build.sh automates: pip install, reflex init, db init+migrate)
./build.sh

# Frontend-only export
reflex export --frontend-only
```

## Deployment Architecture

Split deployment:
- **Vercel** — serves the static portfolio page (frontend-only export in `public/`)
- **Reflex Cloud** — runs the Metal Archive (full backend with WebSocket state)
- `vercel.json` redirects `/metal-archive/*` to the Reflex Cloud instance (`links-bio-silver-wood.reflex.run`)

## Architecture

### Entry Point

`links_bio/links_bio.py` — Creates the `rx.App`, registers all pages via `app.add_page()`, imports models so Reflex discovers them for DB migrations (`import links_bio.models`). Also mounts a debug Starlette app at `/api/debug-sync.json`.

### Page Structure

- **Portfolio index** (`index()`): Composed from `views/header.py` + `views/links.py`, wrapped in `components/navbar.py` + `components/footer.py`
- **Metal Archive pages** (`pages/metal_archive/`): 9 pages — `landing`, `browse`, `album_detail`, `genre_page`, `country_page`, `year_page`, `submit`, `promo`, `newsletter`. Routes defined in `constants/metal_archive.py`. Dynamic routes use `[id]`, `[genre]`, `[country]`, `[year]` path params.

### State Management

- `states/metal_archive_state.py` — `MetalArchiveState`: all DB queries for albums (landing, browse with filters/search/pagination, album detail with tracks + similar bands). Each page has a dedicated `on_load` event handler.
- `states/form_state.py` — `FormState`: handles band submission, newsletter signup, contact form. Sends email notifications via Gmail SMTP.
- `state.py` — `AppState`: YouTube RSS feed fetching (unused on current pages but available).

### Data Models (`models/`)

SQLite database (`reflex.db`) with SQLModel/Alembic. Tables: `albums` (main catalog with indexed fields for band_name, year, country, genre, views, featured), `tracks`, `similar_bands`, `submissions`, `newsletter_subscribers`, `contact_messages`. Auto-created at startup via `rx.Model.create_all()`.

### Background Sync

`background_sync.py` — background thread that syncs YouTube data to DB every 12h (configurable). Only activates when `YOUTUBE_REFRESH_TOKEN` env var is set. Runs artwork sync from DeathGrind CDN after YouTube sync.

### Styling System

All styles centralized in `links_bio/styles/`:
- **`styles.py`**: `Size` enum has two categories — spacing values (`"0"`–`"5"` for HStack/VStack `spacing`) and CSS values with units (`"0.5em"`, `"2.2em"` for padding/font-size). Also defines `BASE_STYLE`, named style dicts (e.g. `button_title_style`, `album_card_style`), and `MAX_WIDTH`/`METAL_ARCHIVE_MAX_WIDTH`.
- **`colors.py`**: `Color`, `TextColor`, `LogoColor` enums for the dark theme
- **`fonts.py`**: `Font` (Poppins, DinaRemasterII, Pulse_virgin) and `FontWeight` enums

### Constants

- `constants/url_social.py` — Social media URLs and email
- `constants/images.py` — All asset paths (avatar, icons, band logos, thumbnails)
- `constants/metal_archive.py` — Route definitions, page metadata, genre list, sort options, promo packages

### Environment Variables

- `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN` — YouTube API OAuth (enables background sync)
- `GMAIL_ADDRESS`, `GMAIL_APP_PASSWORD` — Gmail SMTP for form email notifications
- `SYNC_INTERVAL_HOURS` (default: 12), `SYNC_STARTUP_DELAY` (default: 60) — background sync timing

### Key Conventions

- Dynamic experience calculations in `views/header.py` (`experiencePrograming()`, `experienceEditorVideo()`) compute years from fixed start dates
- Responsive layout via `rx.mobile_only()` / `rx.tablet_and_desktop()` for social icon placement
- All images use `loading="lazy"`
- OG meta tags injected via `rx.script()` with raw JS
- Browse page pagination: fetches `page_limit + 1` rows to detect `has_more`, supports append for "load more"
- DB config: `sqlite:///reflex.db`, sitemap plugin disabled in `rxconfig.py`
- Data ingestion scripts at project root: `sync_youtube_to_db.py`, `sync_artwork_deathgrind.py`, `sync_artwork_fallback.py`; utility scripts in `scripts/` (`seed_data.py`, `normalize_db.py`)
