"""MCP server for the links-bio project.

Exposes health and validation tools so Claude can check the state of the
live Astro static site, the FastAPI forms API, the DB schema/migrations,
and env vars. The Reflex app and Reflex Cloud are retired (see CLAUDE.md
"What is live vs. legacy") — there is nothing left on :8000 or
reflex.run to probe.
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

import requests
from mcp.server.fastmcp import FastMCP

PROJECT_ROOT = Path(__file__).resolve().parent.parent
VENV_BIN = PROJECT_ROOT / "env" / "bin"
VENV_PYTHON = VENV_BIN / "python"
ALEMBIC_BIN = VENV_BIN / "alembic"
RUFF_BIN = VENV_BIN / "ruff"
ENV_FILE = PROJECT_ROOT / ".env"

LIVE_URL = "https://danielbanariba.com"

METAL_ARCHIVE_PATHS = [
    "/metal-archive/",
    "/metal-archive/browse",
    "/metal-archive/submit",
    "/metal-archive/promo",
    "/metal-archive/newsletter",
]

# Either the API Key (recommended, doesn't expire) or the full OAuth triple
# authenticates YouTube sync — matching links_bio/youtube_auth.py's
# authenticate_auto() either/or logic. GMAIL_* is always required for form
# notification emails.
YOUTUBE_OAUTH_VARS = ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REFRESH_TOKEN"]
REQUIRED_ENV_VARS = ["GMAIL_ADDRESS", "GMAIL_APP_PASSWORD"]

mcp = FastMCP("links-bio")


def _run(cmd: list, timeout: int = 30) -> dict:
    try:
        r = subprocess.run(
            [str(c) for c in cmd],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return {
            "ok": r.returncode == 0,
            "returncode": r.returncode,
            "stdout": r.stdout.strip(),
            "stderr": r.stderr.strip(),
        }
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": f"timeout after {timeout}s"}
    except FileNotFoundError as e:
        return {"ok": False, "error": f"binary not found: {e.filename}"}


def _http_get(url: str, timeout: int = 5) -> dict:
    try:
        r = requests.get(url, timeout=timeout, allow_redirects=True)
        return {
            "ok": 200 <= r.status_code < 400,
            "status": r.status_code,
            "url": r.url,
            "ms": int(r.elapsed.total_seconds() * 1000),
        }
    except requests.exceptions.Timeout:
        return {"ok": False, "error": f"timeout after {timeout}s", "url": url}
    except requests.exceptions.ConnectionError as e:
        return {"ok": False, "error": f"connection: {e}", "url": url}


def _parse_dotenv(path: Path) -> dict:
    if not path.exists():
        return {}
    result = {}
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        result[key.strip()] = value.strip().strip("'\"")
    return result


def _run_alembic(args: list[str]) -> dict:
    return _run([ALEMBIC_BIN, "-c", str(PROJECT_ROOT / "alembic.ini"), *args])


@mcp.tool()
def check_db_schema() -> dict:
    """Check DB migration status via plain `alembic current`/`heads` (no Reflex).

    Compares the DB's current revision against the migration chain's head.
    """
    current = _run_alembic(["current"])
    heads = _run_alembic(["heads"])
    if not current.get("ok") or not heads.get("ok"):
        return {"ok": False, "error": current.get("stderr") or current.get("error") or heads.get("stderr") or heads.get("error")}
    current_rev = current["stdout"].split()[0] if current["stdout"].split() else None
    head_rev = heads["stdout"].split()[0] if heads["stdout"].split() else None
    return {
        "ok": bool(current_rev) and current_rev == head_rev,
        "current": current_rev,
        "head": head_rev,
    }


@mcp.tool()
def check_migrations_pending() -> dict:
    """Report whether the DB is behind the latest alembic head."""
    status = check_db_schema()
    if "error" in status:
        return status
    pending = [] if status["ok"] else [status["head"]]
    return {"ok": status["ok"], "pending": pending, "head": status["head"], "current": status["current"]}


@mcp.tool()
def validate_env_vars() -> dict:
    """Check required env vars are set in .env.

    YouTube sync accepts EITHER YOUTUBE_API_KEY OR the full OAuth triple
    (YOUTUBE_CLIENT_ID + YOUTUBE_CLIENT_SECRET + YOUTUBE_REFRESH_TOKEN) —
    this mirrors links_bio/youtube_auth.py's authenticate_auto(), which
    prefers the API key and falls back to OAuth. GMAIL_* is always
    required (form notification emails).
    """
    if not ENV_FILE.exists():
        return {"ok": False, "error": f".env file not found at {ENV_FILE}"}
    vals = _parse_dotenv(ENV_FILE)

    present: list[str] = []
    missing: list[str] = []

    has_api_key = bool(vals.get("YOUTUBE_API_KEY"))
    has_oauth_triple = all(vals.get(k) for k in YOUTUBE_OAUTH_VARS)
    if has_api_key:
        present.append("YOUTUBE_API_KEY")
    elif has_oauth_triple:
        present.extend(YOUTUBE_OAUTH_VARS)
    else:
        missing.append(
            "YOUTUBE_API_KEY (or the OAuth triple: " + ", ".join(YOUTUBE_OAUTH_VARS) + ")"
        )

    for k in REQUIRED_ENV_VARS:
        (present if vals.get(k) else missing).append(k)

    return {"ok": not missing, "present": present, "missing": missing}


@mcp.tool()
def count_models_in_db() -> dict:
    """Count rows in each main table (albums, tracks, submissions, etc.)."""
    helper = Path(__file__).resolve().parent / "_count_models.py"
    result = _run([VENV_PYTHON, str(helper)])
    if not result.get("ok"):
        return {"ok": False, "error": result.get("stderr") or result.get("error")}
    try:
        counts = json.loads(result["stdout"].splitlines()[-1])
        return {"ok": True, "counts": counts, "total": sum(counts.values())}
    except Exception as e:
        return {"ok": False, "error": f"parse failed: {e}", "raw": result.get("stdout")}


@mcp.tool()
def lint_project() -> dict:
    """Run `ruff check` on links_bio/. Returns OK if no lint errors."""
    if not RUFF_BIN.exists():
        return {"ok": False, "error": "ruff not installed — run: uv pip install ruff --python env/bin/python"}
    return _run([RUFF_BIN, "check", "links_bio/"])


@mcp.tool()
def test_metal_archive_pages(base_url: str = LIVE_URL) -> dict:
    """HTTP GET each Metal Archive route, report status for all.

    Defaults to the live Astro origin (danielbanariba.com) — the static
    site is the only thing actually serving these routes now.
    """
    base = base_url.rstrip("/")
    routes = {}
    all_ok = True
    for path in METAL_ARCHIVE_PATHS:
        r = _http_get(base + path, timeout=10)
        routes[path] = r
        if not r.get("ok"):
            all_ok = False
    return {"ok": all_ok, "routes": routes}


@mcp.tool()
def check_vercel_deploy(url: str) -> dict:
    """Ping the Vercel static deploy. Pass the full URL (e.g. https://your-site.vercel.app)."""
    return _http_get(url, timeout=10)


if __name__ == "__main__":
    mcp.run()
