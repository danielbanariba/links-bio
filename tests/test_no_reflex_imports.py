"""Regression guard: Reflex (and the full legacy UI app) was removed from
this project in T7, but a lazy `import reflex` nested inside a function body
(links_bio/youtube_auth.py's DB fallback) broke API-key-only YouTube sync
silently, because the surrounding broad `except Exception: pass` hid the
ImportError (see T25 item 2 and tests/test_youtube_auth.py).

This statically scans every git-tracked `*.py` file with `ast` -- catching
an import at ANY nesting depth, not just at module scope -- so a
reintroduced `reflex` import fails this test instead of failing silently in
production again. Modules are never imported, only parsed, so this cannot
trigger import-time side effects in scripts that have them.

`.claude/` is excluded: it holds Claude Code skill reference material (the
general-purpose `reflex-dev` skill's example apps), not this project's own
application code, and is expected to use reflex as teaching material.
"""
from __future__ import annotations

import ast
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


def find_reflex_imports(source: str, filename: str) -> list[str]:
    """Parse `source` with ast and return 'filename:line' for every
    `import reflex` / `import reflex.x` / `from reflex import ...` /
    `from reflex.x import ...` node, at any nesting depth (module level,
    or inside a function/class/try body)."""
    tree = ast.parse(source, filename=filename)
    hits: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            if any(
                alias.name == "reflex" or alias.name.startswith("reflex.")
                for alias in node.names
            ):
                hits.append(f"{filename}:{node.lineno}")
        elif isinstance(node, ast.ImportFrom) and node.module and (
            node.module == "reflex" or node.module.startswith("reflex.")
        ):
            hits.append(f"{filename}:{node.lineno}")
    return hits


def _tracked_python_files() -> list[str]:
    """Every git-tracked *.py file under the repo root, excluding .claude/
    (Claude Code skill reference material, not this project's own code)."""
    result = subprocess.run(
        ["git", "ls-files", "*.py", ":!:.claude"],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return [line for line in result.stdout.splitlines() if line]


def test_no_tracked_python_file_imports_reflex() -> None:
    """Catches a reintroduced `import reflex` / `from reflex import ...`
    anywhere in a git-tracked application .py file, including nested
    inside a function -- the exact shape of the T7-leftover bug that broke
    API-key-only YouTube sync silently.
    """
    offenders: list[str] = []
    for rel_path in _tracked_python_files():
        source = (REPO_ROOT / rel_path).read_text()
        offenders.extend(find_reflex_imports(source, rel_path))

    assert not offenders, "reflex import(s) found in tracked Python files:\n" + "\n".join(
        offenders
    )


def test_find_reflex_imports_detects_a_nested_import() -> None:
    """Proves find_reflex_imports actually catches a reflex import nested
    inside a function body, not just at module scope -- the exact shape
    the T7-leftover regression took in youtube_auth.py (a lazy `import
    reflex` inside a try/except deep in a function)."""
    source = (
        "def get_channel_id():\n"
        "    try:\n"
        "        import reflex as rx\n"
        "    except Exception:\n"
        "        pass\n"
    )
    assert find_reflex_imports(source, "fake.py") == ["fake.py:3"]


def test_find_reflex_imports_ignores_unrelated_imports() -> None:
    """Proves the scanner doesn't flag ordinary imports -- without this,
    a sloppy name/prefix match could false-positive on an unrelated module
    that merely starts with "reflex" in spelling, like `reflexive_utils`."""
    source = "import os\nfrom reflexive_utils import helper\n"
    assert find_reflex_imports(source, "fake.py") == []
