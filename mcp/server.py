"""MCP server for the links-bio project.

Exposes health and validation tools so Claude can check the state of the
Reflex app (local dev), DB schema, env vars, and the two production
deployments (Vercel static + Reflex Cloud backend).
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
REFLEX_BIN = VENV_BIN / "reflex"
RUFF_BIN = VENV_BIN / "ruff"
ENV_FILE = PROJECT_ROOT / ".env"

LOCAL_URL = "http://localhost:8000"
REFLEX_CLOUD_URL = "https://links-bio-silver-wood.reflex.run"

METAL_ARCHIVE_PATHS = [
    "/metal-archive/",
    "/metal-archive/browse",
    "/metal-archive/submit",
    "/metal-archive/promo",
    "/metal-archive/newsletter",
]

REQUIRED_ENV_VARS = [
    "YOUTUBE_CLIENT_ID",
    "YOUTUBE_CLIENT_SECRET",
    "YOUTUBE_REFRESH_TOKEN",
    "GMAIL_ADDRESS",
    "GMAIL_APP_PASSWORD",
]

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


@mcp.tool()
def check_reflex_server(url: str = LOCAL_URL) -> dict:
    """Verify the local Reflex backend is alive.

    Any HTTP response < 500 means the server is reachable and processing
    requests — a bare backend (started with --backend-only) returns 404 on /
    because only WebSocket endpoints are registered, which still counts as
    alive. Connection errors or 5xx indicate the server is down.
    """
    r = _http_get(url, timeout=3)
    if "error" in r:
        return r
    return {
        "ok": r["status"] < 500,
        "alive": r["status"] < 500,
        "status": r["status"],
        "url": r["url"],
        "ms": r["ms"],
    }


def _parse_reflex_db_status(output: str) -> dict:
    """Parse `reflex db status` output. Each migration line looks like:
        [✓] 91469e4c0110 (head), add missing indexes
        [ ] abc123, pending migration
    """
    migrations = []
    head = None
    for raw in output.splitlines():
        line = raw.strip()
        if not (line.startswith("[✓]") or line.startswith("[ ]") or line.startswith("[x]")):
            continue
        applied = not line.startswith("[ ]")
        rest = line[3:].strip()
        rev_part, _, desc = rest.partition(",")
        is_head = "(head)" in rev_part
        rev = rev_part.replace("(head)", "").strip()
        migrations.append({"rev": rev, "applied": applied, "head": is_head, "desc": desc.strip()})
        if is_head:
            head = rev
    return {
        "migrations": migrations,
        "applied_count": sum(1 for m in migrations if m["applied"]),
        "total": len(migrations),
        "head": head,
        "all_applied": bool(migrations) and all(m["applied"] for m in migrations),
    }


@mcp.tool()
def check_db_schema() -> dict:
    """Check DB migrations status via `reflex db status`. Returns list of migrations and applied state."""
    r = _run([REFLEX_BIN, "db", "status"])
    if not r.get("ok"):
        return {"ok": False, "error": r.get("stderr") or r.get("error")}
    parsed = _parse_reflex_db_status(r["stdout"])
    return {"ok": parsed["all_applied"], **parsed}


@mcp.tool()
def check_migrations_pending() -> dict:
    """List migrations NOT yet applied to the local DB."""
    r = _run([REFLEX_BIN, "db", "status"])
    if not r.get("ok"):
        return {"ok": False, "error": r.get("stderr") or r.get("error")}
    parsed = _parse_reflex_db_status(r["stdout"])
    pending = [m for m in parsed["migrations"] if not m["applied"]]
    return {"ok": not pending, "pending": pending, "head": parsed["head"]}


@mcp.tool()
def validate_env_vars() -> dict:
    """Check that required env vars (YOUTUBE_*, GMAIL_*) are set in .env."""
    if not ENV_FILE.exists():
        return {"ok": False, "error": f".env file not found at {ENV_FILE}"}
    vals = _parse_dotenv(ENV_FILE)
    missing = [k for k in REQUIRED_ENV_VARS if not vals.get(k)]
    present = [k for k in REQUIRED_ENV_VARS if vals.get(k)]
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
def test_metal_archive_pages(base_url: str = LOCAL_URL) -> dict:
    """HTTP GET each Metal Archive route, report status for all."""
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


@mcp.tool()
def check_reflex_cloud(url: str = REFLEX_CLOUD_URL) -> dict:
    """Ping the Reflex Cloud backend deploy (Metal Archive)."""
    return _http_get(url, timeout=20)


if __name__ == "__main__":
    mcp.run()
