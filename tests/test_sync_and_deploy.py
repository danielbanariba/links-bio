"""Regression guards for scripts/sync_and_deploy.py and the deploy step it
reuses from links_bio.background_sync.

Never invokes a real `vercel` CLI or network call: a fake `vercel`
executable (fake_vercel_bin fixture) is placed first on PATH and records
its argv instead of doing anything. These tests never touch the dev or
production database -- the normalize and build steps are stubbed out so
only the deploy-command construction and failure propagation are
exercised.

The whoami-preflight/auth-retry tests below need per-call, per-subcommand
behaviour (whoami succeeds while deploy fails, deploy fails once then
succeeds, ...) that the single-exit-code fake_vercel_bin script can't
express, so they stub subprocess.run directly instead -- background_sync's
functions all do `import subprocess` locally, which binds to the very same
module object in sys.modules, so patching `subprocess.run` here reaches
them exactly like patching bg's own import would.
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from links_bio import background_sync as bg  # noqa: E402
from scripts import sync_and_deploy  # noqa: E402


def _fake_vercel_run(deploy_exits, deploy_outputs, whoami_exit=0):
    """Build a subprocess.run stand-in that answers `vercel whoami` with
    whoami_exit every time, and answers successive `vercel deploy` calls
    with deploy_exits[call_index]/deploy_outputs[call_index] (the last
    entry repeats if more calls happen than entries provided). Returns
    (fake_run, calls) where calls["whoami"]/calls["deploy"] record each
    call's argv, so a test can assert exactly how many deploy attempts
    were made.
    """
    calls = {"whoami": [], "deploy": []}

    def fake_run(cmd, cwd=None, env=None, **kwargs):
        if cmd[:2] == ["vercel", "whoami"]:
            calls["whoami"].append(cmd)
            return subprocess.CompletedProcess(cmd, whoami_exit, stdout="", stderr="")
        if cmd[:2] == ["vercel", "deploy"]:
            idx = min(len(calls["deploy"]), len(deploy_exits) - 1)
            calls["deploy"].append(cmd)
            out, err = deploy_outputs[idx]
            return subprocess.CompletedProcess(
                cmd, deploy_exits[idx], stdout=out, stderr=err
            )
        raise AssertionError(f"unexpected subprocess.run call: {cmd}")

    return fake_run, calls


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


def test_failed_deploy_never_exposes_token(monkeypatch, fake_vercel_bin, caplog):
    """Catches the failure-path leak: subprocess.run(check=True) raises
    CalledProcessError whose message embeds the full argv, token included,
    which then reaches the journal and the OnFailure alert email."""
    import logging
    import traceback

    import pytest

    (fake_vercel_bin / "vercel.exit").write_text("1")
    monkeypatch.setenv("VERCEL_TOKEN", "super-secret-token-xyz")
    env = dict(os.environ)
    env["PATH"] = str(fake_vercel_bin) + os.pathsep + env.get("PATH", "")

    caplog.set_level(logging.INFO)
    with pytest.raises(Exception) as excinfo:
        bg.deploy_to_vercel(env)

    rendered = "".join(traceback.format_exception(excinfo.value))
    assert "super-secret-token-xyz" not in rendered
    for record in caplog.records:
        assert "super-secret-token-xyz" not in record.getMessage()


def test_main_exits_nonzero_when_deploy_fails(monkeypatch, fake_vercel_bin, clean_env):
    """Catches a regression of the exact bug this task fixes: a failing
    deploy silently swallowed instead of making the process (and therefore
    the systemd unit) fail."""
    (fake_vercel_bin / "vercel.exit").write_text("1")
    monkeypatch.setattr(bg, "build_astro_site", lambda env: None)
    monkeypatch.setattr(bg, "run_normalize", lambda: None)
    monkeypatch.setattr(bg, "find_node_bin", lambda: str(fake_vercel_bin))

    rc = sync_and_deploy.main(["--skip-youtube"])

    assert rc != 0


def test_main_exits_zero_when_everything_succeeds(monkeypatch, fake_vercel_bin, clean_env):
    monkeypatch.setattr(bg, "build_astro_site", lambda env: None)
    monkeypatch.setattr(bg, "run_normalize", lambda: None)
    monkeypatch.setattr(bg, "find_node_bin", lambda: str(fake_vercel_bin))

    rc = sync_and_deploy.main(["--skip-youtube"])

    assert rc == 0


def test_deploy_retries_once_after_not_authorized_and_succeeds(monkeypatch, clean_env):
    """Reproduces the 2026-10-07 incident: the CLI's session token
    refreshed mid-deploy and the in-flight `vercel deploy` was rejected
    with "Error: Not authorized". Catches a regression that gives up on
    the first such failure instead of re-checking auth and retrying once."""
    fake_run, calls = _fake_vercel_run(
        deploy_exits=[1, 0],
        deploy_outputs=[("", "Error: Not authorized\n"), ("Deployed!\n", "")],
    )
    monkeypatch.setattr(subprocess, "run", fake_run)

    bg.deploy_to_vercel({})

    assert len(calls["deploy"]) == 2


def test_deploy_raises_immediately_on_non_auth_failure_without_retry(monkeypatch, clean_env):
    """Catches a regression that retries (or swallows) every deploy
    failure instead of only the "Not authorized" case -- an unrelated
    build/upload failure must still raise after exactly one attempt."""
    fake_run, calls = _fake_vercel_run(
        deploy_exits=[1],
        deploy_outputs=[("", "Error: build artifact missing\n")],
    )
    monkeypatch.setattr(subprocess, "run", fake_run)

    with pytest.raises(RuntimeError):
        bg.deploy_to_vercel({})

    assert len(calls["deploy"]) == 1


def test_deploy_whoami_failure_raises_actionable_message_token_set(monkeypatch):
    """Catches a regression that deploys anyway (or raises a vague error)
    when the preflight `vercel whoami` fails with VERCEL_TOKEN configured
    -- the message must point at rotating the token (decision D2), and no
    deploy attempt may happen."""
    fake_run, calls = _fake_vercel_run(
        deploy_exits=[0], deploy_outputs=[("", "")], whoami_exit=1
    )
    monkeypatch.setattr(subprocess, "run", fake_run)
    monkeypatch.setenv("VERCEL_TOKEN", "fake-token-xyz")

    with pytest.raises(RuntimeError) as excinfo:
        bg.deploy_to_vercel({})

    message = str(excinfo.value)
    assert "VERCEL_TOKEN" in message
    assert ".env" in message
    assert "fake-token-xyz" not in message
    assert len(calls["deploy"]) == 0


def test_deploy_whoami_failure_raises_actionable_message_token_unset(monkeypatch, clean_env):
    """Same as above but with no VERCEL_TOKEN configured: the message must
    point at `vercel login` or setting VERCEL_TOKEN (decision D2) instead
    of blaming a token that was never set."""
    fake_run, calls = _fake_vercel_run(
        deploy_exits=[0], deploy_outputs=[("", "")], whoami_exit=1
    )
    monkeypatch.setattr(subprocess, "run", fake_run)

    with pytest.raises(RuntimeError) as excinfo:
        bg.deploy_to_vercel({})

    message = str(excinfo.value)
    assert "vercel login" in message
    assert "VERCEL_TOKEN" in message
    assert len(calls["deploy"]) == 0


def test_deploy_retry_exhausted_never_leaks_token(monkeypatch, caplog):
    """Catches a regression where the retry path's own error message (or
    the whoami/deploy log lines around it) embeds the raw VERCEL_TOKEN
    instead of going through _masked_cmd -- that message reaches the
    journal and the OnFailure alert email verbatim."""
    import logging

    fake_run, calls = _fake_vercel_run(
        deploy_exits=[1, 1],
        deploy_outputs=[
            ("", "Error: Not authorized\n"),
            ("", "Error: Not authorized\n"),
        ],
    )
    monkeypatch.setattr(subprocess, "run", fake_run)
    monkeypatch.setenv("VERCEL_TOKEN", "fake-token-xyz")
    caplog.set_level(logging.INFO)

    with pytest.raises(RuntimeError) as excinfo:
        bg.deploy_to_vercel({})

    assert "fake-token-xyz" not in str(excinfo.value)
    for record in caplog.records:
        assert "fake-token-xyz" not in record.getMessage()
    assert len(calls["deploy"]) == 2
