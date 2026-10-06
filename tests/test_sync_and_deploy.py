"""Regression guards for scripts/sync_and_deploy.py and the deploy step it
reuses from links_bio.background_sync.

Never invokes a real `vercel` CLI or network call: a fake `vercel`
executable (fake_vercel_bin fixture) is placed first on PATH and records
its argv instead of doing anything. These tests never touch the dev or
production database -- the normalize and build steps are stubbed out so
only the deploy-command construction and failure propagation are
exercised.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from links_bio import background_sync as bg  # noqa: E402
from scripts import sync_and_deploy  # noqa: E402


def _read_recorded_argv(fake_vercel_bin: Path) -> list[str]:
    recorded = fake_vercel_bin.parent / "vercel_argv.txt"
    if not recorded.exists():
        return []
    lines = recorded.read_text().splitlines()
    # drop the trailing '--' separator the fake script writes after each call
    return [line for line in lines if line != "--"]


def test_deploy_command_has_required_flags_and_masks_token(monkeypatch, fake_vercel_bin, caplog):
    """Catches a regression that drops --archive=tgz/--prod/--prebuilt/--yes
    from the real deploy invocation, or that leaks VERCEL_TOKEN into this
    script's own logs."""
    import logging

    monkeypatch.setenv("VERCEL_TOKEN", "super-secret-token-xyz")
    env = dict(os.environ)
    env["PATH"] = str(fake_vercel_bin) + os.pathsep + env.get("PATH", "")

    caplog.set_level(logging.INFO)
    bg.deploy_to_vercel(env)

    recorded = _read_recorded_argv(fake_vercel_bin)
    assert "--prod" in recorded
    assert "--prebuilt" in recorded
    assert "--yes" in recorded
    assert "--archive=tgz" in recorded

    # the real subprocess must receive the real token ...
    assert "--token" in recorded
    assert recorded[recorded.index("--token") + 1] == "super-secret-token-xyz"

    # ... but nothing this script itself logged may contain it
    for record in caplog.records:
        assert "super-secret-token-xyz" not in record.getMessage()


def test_deploy_command_omits_token_flag_when_unset(monkeypatch, fake_vercel_bin):
    """Catches a regression that always appends --token, even with no
    VERCEL_TOKEN configured (breaking the tokenless/logged-in-session
    fallback path)."""
    monkeypatch.delenv("VERCEL_TOKEN", raising=False)
    env = dict(os.environ)
    env["PATH"] = str(fake_vercel_bin) + os.pathsep + env.get("PATH", "")

    bg.deploy_to_vercel(env)

    recorded = _read_recorded_argv(fake_vercel_bin)
    assert "--token" not in recorded


def test_main_exits_nonzero_when_deploy_fails(monkeypatch, fake_vercel_bin, clean_env):
    """Catches a regression of the exact bug this task fixes: a failing
    deploy silently swallowed instead of making the process (and therefore
    the systemd unit) fail."""
    (fake_vercel_bin / "vercel.exit").write_text("1")
    monkeypatch.setattr(bg, "build_astro_site", lambda env: None)
    monkeypatch.setattr(bg, "run_normalize", lambda: None)
    monkeypatch.setattr(bg, "find_node_bin", lambda: str(fake_vercel_bin))

    rc = sync_and_deploy.main(["--skip-youtube", "--skip-artwork"])

    assert rc != 0


def test_main_exits_zero_when_everything_succeeds(monkeypatch, fake_vercel_bin, clean_env):
    monkeypatch.setattr(bg, "build_astro_site", lambda env: None)
    monkeypatch.setattr(bg, "run_normalize", lambda: None)
    monkeypatch.setattr(bg, "find_node_bin", lambda: str(fake_vercel_bin))

    rc = sync_and_deploy.main(["--skip-youtube", "--skip-artwork"])

    assert rc == 0
