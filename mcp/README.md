# links-bio MCP Server

A project-scoped MCP server that exposes health and validation tools for the
live Astro static site, the FastAPI forms API, and the DB. Claude Code
auto-discovers it via `.mcp.json` at the project root.

## Tools

| Tool | What it does |
|------|--------------|
| `check_db_schema` | Runs plain `alembic current`/`heads`. Reports whether the DB is at the latest migration. |
| `check_migrations_pending` | Reports whether the DB is behind the latest alembic head. |
| `validate_env_vars` | Verifies `YOUTUBE_API_KEY` (or the OAuth triple) and `GMAIL_*` keys are set in `.env`. |
| `count_models_in_db` | Row count per table (albums, tracks, submissions, etc.). |
| `lint_project` | Runs `ruff check links_bio/`. |
| `test_metal_archive_pages` | HTTP GET each Metal Archive route against a base URL (defaults to the live site). |
| `check_vercel_deploy` | Pings the Vercel static deploy (pass the URL). |

## How it runs

`.mcp.json` tells Claude Code to launch the server as:

```bash
bash -lc 'cd /home/banar/Desktop/links-bio && env/bin/python mcp/server.py'
```

The server communicates over stdio (the MCP default). It imports from the
project venv, so `links-bio`'s own models are available to the tools.

## Dependencies

Installed into the project venv (`env/`):

- `mcp[cli]` — MCP Python SDK (FastMCP)
- `requests` — already a project dep
- `ruff` — for `lint_project`

No extra venv or isolated install — everything lives inside `env/`.

## After changing tools

`.mcp.json` lives outside the git repo (gitignored). Restart Claude Code
(`/exit` + reopen) to pick up new tool definitions after editing `server.py`.
