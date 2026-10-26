#!/usr/bin/env python3
"""Take the latest merge to main to production, then exit.

Run every 5 minutes by the links-bio-deploy.{service,timer} systemd user
units, from the host checkout (the only machine with reflex.db). One tick:

1. Take the shared deploy lock (links_bio/deploy_lock.py) without waiting.
   If the twice-daily sync or a slow earlier deploy holds it, skip the tick.
2. Fetch main anonymously over HTTPS into refs/remotes/origin/main. The repo
   is public, and a user unit has no SSH agent. DEPLOY_REPO_URL overrides
   the URL.
3. Read the gitignored .deploy-state.json ({"deployed_sha", "failed_sha"}).
   A missing or malformed file means no state.
4. Decide (`decide()`, first match wins):
   - noop: HEAD is origin/main and already deployed;
   - skip: origin/main already failed and alerted;
   - refuse: not on main, tracked changes, or HEAD cannot fast-forward;
   - block: the range not pulled yet adds or changes a migration;
   - update: fast-forward, then run the plan.
5. Plan from the paths changed since the last good deploy (`plan_actions()`):
   installs first, then the Astro build+deploy, then the forms restart.
   Without a usable base (first run, unknown deployed_sha) it runs all of it.
6. Record the outcome. Success sets deployed_sha and clears failed_sha. Any
   failure sets failed_sha to origin/main and keeps deployed_sha, so the next
   merge re-plans from the last good deploy.

The alert-once rule: a failure exits non-zero, and systemd's
OnFailure=notify-failure@%n.service sends the one email. Later ticks see
failed_sha == origin/main and exit 0, so one bad sha alerts once. Pushing a
new merge, or removing failed_sha from .deploy-state.json, retries. This
script never sends email itself.

Usage:
    scripts/deploy_on_merge.py
"""
from __future__ import annotations

import json
import logging
import os
import re
import subprocess
import sys
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from links_bio import background_sync as bg
from links_bio import deploy_lock

DEFAULT_REPO_URL = "https://github.com/danielbanariba/links-bio.git"
REMOTE_REF = "refs/remotes/origin/main"
STATE_FILE_NAME = ".deploy-state.json"
MIGRATIONS_DIR = "alembic/versions/"
FORMS_UNIT = "metal-archive-forms.service"
# A fetch that stalls this long fails the tick instead of holding the
# deploy lock (and the waiting sync) until the unit's own timeout.
GIT_TIMEOUT_SECONDS = 300

NPM_CI = "npm-ci"
PIP_INSTALL = "pip-install"
BUILD_DEPLOY = "build-deploy"
RESTART_FORMS = "restart-forms"
# Order matters: installs before the build that needs them, and the forms
# restart last, so a failed restart never holds back the site deploy.
FULL_PLAN = [NPM_CI, PIP_INSTALL, BUILD_DEPLOY, RESTART_FORMS]
NODE_DEPENDENCY_FILES = {"web/package.json", "web/package-lock.json"}
PYTHON_REQUIREMENT_FILES = {"requirements.txt", "requirements-dev.txt"}

MIGRATION_BLOCKED = (
    "a migration is pending: back up reflex.db, run `git pull --ff-only` and "
    "`alembic upgrade head`, then remove failed_sha from .deploy-state.json; "
    "the next tick deploys"
)

NOOP, SKIP, REFUSE, BLOCK, UPDATE = "noop", "skip", "refuse", "block", "update"

_SHA = re.compile(r"[0-9a-f]{40}(?:[0-9a-f]{24})?")
_URL_CREDENTIALS = re.compile(r"://[^/@\s]+@")

logger = logging.getLogger("deploy_on_merge")


class DeployError(RuntimeError):
    """A tick that must fail the unit, so OnFailure sends the one alert."""


@dataclass(frozen=True)
class State:
    deployed_sha: str | None = None
    failed_sha: str | None = None


@dataclass(frozen=True)
class Facts:
    head: str
    remote: str
    branch: str | None
    dirty: bool
    head_is_ancestor: bool
    incoming: tuple[str, ...]


@dataclass(frozen=True)
class Decision:
    action: str
    reason: str = ""


def decide(facts: Facts, state: State) -> Decision:
    """What this tick does, from the checkout's facts and the saved state."""
    if facts.head == facts.remote and state.deployed_sha == facts.head:
        return Decision(NOOP)
    if state.failed_sha == facts.remote:
        return Decision(SKIP, f"skipping {_short(facts.remote)}, it already failed and alerted")
    if facts.branch != "main":
        where = f"branch {facts.branch!r}" if facts.branch else "a detached HEAD"
        return Decision(
            REFUSE,
            f"the checkout is on {where}, not main: check out main, then remove "
            "failed_sha from .deploy-state.json",
        )
    if facts.dirty:
        return Decision(
            REFUSE,
            "tracked files have local changes (git status --porcelain "
            "--untracked-files=no): commit, stash or discard them, then remove "
            "failed_sha from .deploy-state.json",
        )
    if not facts.head_is_ancestor:
        return Decision(
            REFUSE,
            f"HEAD {_short(facts.head)} is not an ancestor of origin/main "
            f"{_short(facts.remote)} (local commits, or a rewritten main), so it "
            "cannot fast-forward",
        )
    migrations = [path for path in facts.incoming if path.startswith(MIGRATIONS_DIR)]
    if migrations:
        return Decision(BLOCK, f"{MIGRATION_BLOCKED} ({', '.join(migrations)})")
    return Decision(UPDATE)


def plan_actions(changed: Iterable[str] | None) -> list[str]:
    """The actions a deploy needs, in run order. `changed` holds the paths
    changed since the last good deploy; None means there is no usable base,
    so everything runs."""
    if changed is None:
        return list(FULL_PLAN)
    paths = set(changed)
    requirements = bool(paths & PYTHON_REQUIREMENT_FILES)
    plan = []
    if paths & NODE_DEPENDENCY_FILES:
        plan.append(NPM_CI)
    if requirements:
        plan.append(PIP_INSTALL)
    plan.append(BUILD_DEPLOY)
    if requirements or any(path.startswith("links_bio/") for path in paths):
        plan.append(RESTART_FORMS)
    return plan


def read_state(path: Path) -> State:
    try:
        data = json.loads(path.read_text())
    except FileNotFoundError:
        return State()
    except (OSError, ValueError) as exc:
        logger.warning("ignoring unreadable %s (%s); running with no state", path.name, exc)
        return State()
    if not isinstance(data, dict):
        logger.warning("ignoring malformed %s; running with no state", path.name)
        return State()
    values = {}
    for key in ("deployed_sha", "failed_sha"):
        value = data.get(key)
        if value is not None and not (isinstance(value, str) and _SHA.fullmatch(value)):
            logger.warning("ignoring %s: %s is not a sha; running with no state", path.name, key)
            return State()
        values[key] = value
    return State(**values)


def write_state(path: Path, state: State) -> None:
    payload = {"deployed_sha": state.deployed_sha, "failed_sha": state.failed_sha}
    path.write_text(json.dumps(payload, indent=2) + "\n")


def run_tick(repo: Path, repo_url: str) -> str:
    """Run one tick in `repo` (the caller holds the lock). Returns the
    action taken. On failure, records failed_sha and re-raises."""
    state_path = repo / STATE_FILE_NAME
    _git(repo, "fetch", "--quiet", repo_url, f"+refs/heads/main:{REMOTE_REF}")
    remote = _rev_parse(repo, REMOTE_REF)
    state = read_state(state_path)
    try:
        facts = _gather_facts(repo, remote)
        decision = decide(facts, state)
        if decision.action == NOOP:
            return NOOP
        if decision.action == SKIP:
            logger.info(decision.reason)
            return SKIP
        logger.info(
            "fetched main from %s: origin/main %s, HEAD %s on %s, deployed_sha %s, failed_sha %s",
            _redact(repo_url),
            _short(remote),
            _short(facts.head),
            facts.branch or "a detached HEAD",
            _short(state.deployed_sha),
            _short(state.failed_sha),
        )
        logger.info("decision: %s%s", decision.action, f" ({decision.reason})" if decision.reason else "")
        if decision.action in (REFUSE, BLOCK):
            raise DeployError(decision.reason)
        _deploy(repo, remote, state)
    except Exception:
        write_state(state_path, State(deployed_sha=state.deployed_sha, failed_sha=remote))
        logger.info(
            "recorded failed_sha %s: later ticks skip it until main moves or failed_sha is removed",
            _short(remote),
        )
        raise
    write_state(state_path, State(deployed_sha=remote))
    logger.info("deployed %s and recorded it as deployed_sha", _short(remote))
    return decision.action


def _deploy(repo: Path, remote: str, state: State) -> None:
    head_before = _rev_parse(repo, "HEAD")
    _git(repo, "merge", "--ff-only", remote)
    logger.info("fast-forwarded %s -> %s", _short(head_before), _short(remote))

    base = state.deployed_sha
    if base is not None and not _is_ancestor(repo, base, remote):
        logger.info("deployed_sha %s is not in HEAD's history: no usable base", _short(base))
        base = None
    changed = None if base is None else _changed_paths(repo, base, remote)
    plan = plan_actions(changed)
    since = f"since {_short(base)}" if base else "with no base, so the full plan"
    logger.info("plan %s: %s", since, ", ".join(plan))

    for action in plan:
        logger.info("step %s", action)
        if action == NPM_CI:
            _run(["npm", "ci"], cwd=repo / "web", env=bg.node_env())
        elif action == PIP_INSTALL:
            _run([sys.executable, "-m", "pip", "install", "-r", "requirements-dev.txt"], cwd=repo)
        elif action == BUILD_DEPLOY:
            bg.run_astro_build_and_deploy()
        elif action == RESTART_FORMS:
            # A system unit, so no --user. A polkit rule
            # (systemd/polkit/50-links-bio-forms-restart.rules) lets this user
            # restart it; --no-ask-password fails fast if that rule is missing.
            _run(["systemctl", "--no-ask-password", "restart", FORMS_UNIT], cwd=repo)


def _gather_facts(repo: Path, remote: str) -> Facts:
    head = _rev_parse(repo, "HEAD")
    branch = _git_run(repo, "symbolic-ref", "--quiet", "--short", "HEAD")
    dirty = _git(repo, "status", "--porcelain", "--untracked-files=no").strip()
    return Facts(
        head=head,
        remote=remote,
        branch=branch.stdout.strip() if branch.returncode == 0 else None,
        dirty=bool(dirty),
        head_is_ancestor=_is_ancestor(repo, head, remote),
        incoming=tuple(_changed_paths(repo, head, remote)),
    )


def _changed_paths(repo: Path, old: str, new: str) -> list[str]:
    # --no-renames lists both sides of a move, so a file moved out of
    # links_bio/ or alembic/versions/ still counts.
    output = _git(repo, "diff", "--name-only", "--no-renames", "-z", old, new)
    return [path for path in output.split("\0") if path]


def _is_ancestor(repo: Path, ancestor: str, descendant: str) -> bool:
    return _git_run(repo, "merge-base", "--is-ancestor", ancestor, descendant).returncode == 0


def _rev_parse(repo: Path, rev: str) -> str:
    return _git(repo, "rev-parse", "--verify", f"{rev}^{{commit}}").strip()


def _git(repo: Path, *args: str) -> str:
    result = _git_run(repo, *args)
    if result.returncode != 0:
        raise DeployError(
            f"git {_redact(' '.join(args))} failed with exit code {result.returncode}: "
            f"{_redact(result.stderr.strip())}"
        )
    return result.stdout


def _git_run(repo: Path, *args: str) -> subprocess.CompletedProcess:
    # GIT_TERMINAL_PROMPT=0: never wait for credentials. The fetch is
    # anonymous, and a prompt in a unit would just hang until the timeout.
    env = {**os.environ, "GIT_TERMINAL_PROMPT": "0"}
    try:
        return subprocess.run(
            ["git", *args],
            cwd=repo,
            env=env,
            capture_output=True,
            text=True,
            check=False,
            timeout=GIT_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired:
        raise DeployError(f"git {args[0]} timed out after {GIT_TIMEOUT_SECONDS}s") from None


def _run(cmd: list[str], cwd: Path, env: dict | None = None) -> None:
    logger.info("running %s in %s", " ".join(cmd), cwd)
    returncode = _stream(cmd, cwd, env)
    if returncode != 0:
        raise DeployError(f"{' '.join(cmd)} failed with exit code {returncode}")


def _stream(cmd: list[str], cwd: Path, env: dict | None = None) -> int:
    """Run `cmd`, echoing its combined stdout+stderr line by line as it
    arrives, like background_sync._run_vercel, so a slow or hung step still
    leaves its output in the journal and the OnFailure email. Returns the
    exit code."""
    proc = subprocess.Popen(
        cmd, cwd=cwd, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True
    )
    for line in proc.stdout:
        print(line, end="", flush=True)
    return proc.wait()


def _short(sha: str | None) -> str:
    return sha[:12] if sha else "none"


def _redact(text: str) -> str:
    """Drop any user:token@ part of a URL before it reaches a log line."""
    return _URL_CREDENTIALS.sub("://***@", text)


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        stream=sys.stdout,
        format="%(asctime)s [deploy_on_merge] %(levelname)s %(message)s",
    )
    repo_url = os.environ.get("DEPLOY_REPO_URL") or DEFAULT_REPO_URL
    try:
        with deploy_lock.hold():
            run_tick(PROJECT_ROOT, repo_url)
    except deploy_lock.LockBusy:
        logger.info("another sync or deploy holds the deploy lock; skipping this tick")
        return 0
    except DeployError as exc:
        logger.error("deploy failed: %s", exc)
        return 1
    except Exception:
        logger.exception("deploy failed")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
