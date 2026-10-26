"""Regression guards for scripts/deploy_on_merge.py, the job that takes every
merge to main to production.

Git is real: each test builds a bare "origin", a "dev" clone that lands the
merges, and a "prod" clone that stands in for the host checkout. The job
fetches the bare repo through DEPLOY_REPO_URL, exactly as it fetches GitHub on
the host. Everything past git is recorded instead of run: npm ci, pip and
systemctl go through the job's `_stream` seam, and the Astro build+deploy is
background_sync.run_astro_build_and_deploy, which is replaced too. Nothing here
touches a real unit, a real deploy, the network or any reflex.db.

Git runs with a private global config (no user hooks, a fixed identity), so
the user's own commit hooks never fire on these throwaway commits.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from links_bio import background_sync as bg  # noqa: E402
from links_bio import deploy_lock  # noqa: E402
from scripts import deploy_on_merge as dom  # noqa: E402

FULL_PLAN = ["npm-ci", "pip-install", "build-deploy", "restart-forms"]

INITIAL_FILES = {
    "README.md": "links-bio\n",
    "web/package.json": '{"name": "web"}\n',
    "web/package-lock.json": '{"lockfileVersion": 3}\n',
    "web/src/pages/index.astro": "<h1>bio</h1>\n",
    "requirements.txt": "fastapi==1.0\n",
    "requirements-dev.txt": "-r requirements.txt\n",
    "links_bio/fastapi_forms.py": "VERSION = 1\n",
    "alembic/versions/0001_initial.py": "revision = '0001'\n",
}


def git(cwd: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", *args], cwd=cwd, check=True, capture_output=True, text=True
    )
    return result.stdout.strip()


@dataclass
class Repos:
    origin: Path
    dev: Path
    prod: Path

    @property
    def state_file(self) -> Path:
        return self.prod / ".deploy-state.json"

    def land(self, files: dict[str, str], message: str = "merge") -> str:
        """Commit `files` on dev and push them to origin's main: one merge."""
        for rel, content in files.items():
            path = self.dev / rel
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)
        git(self.dev, "add", "-A")
        git(self.dev, "commit", "-q", "-m", message)
        git(self.dev, "push", "-q", "origin", "main")
        return git(self.dev, "rev-parse", "HEAD")

    def head(self) -> str:
        return git(self.prod, "rev-parse", "HEAD")

    def state(self) -> dict:
        return json.loads(self.state_file.read_text())

    def write_state(self, deployed_sha=None, failed_sha=None) -> None:
        self.state_file.write_text(
            json.dumps({"deployed_sha": deployed_sha, "failed_sha": failed_sha})
        )

    def mark_deployed(self) -> str:
        """Start from a host whose current HEAD is already live."""
        head = self.head()
        self.write_state(deployed_sha=head)
        return head


@pytest.fixture
def repos(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Repos:
    gitconfig = tmp_path / "gitconfig"
    gitconfig.write_text(
        "[user]\n\tname = Test\n\temail = test@example.invalid\n"
        "[init]\n\tdefaultBranch = main\n"
        f"[core]\n\thooksPath = {tmp_path / 'no-hooks'}\n"
    )
    monkeypatch.setenv("GIT_CONFIG_GLOBAL", str(gitconfig))
    monkeypatch.setenv("GIT_CONFIG_NOSYSTEM", "1")

    origin = tmp_path / "origin.git"
    dev = tmp_path / "dev"
    prod = tmp_path / "prod"
    git(tmp_path, "init", "-q", "--bare", "-b", "main", str(origin))
    git(tmp_path, "clone", "-q", str(origin), str(dev))
    repos = Repos(origin=origin, dev=dev, prod=prod)
    repos.land(INITIAL_FILES, "initial")
    git(tmp_path, "clone", "-q", str(origin), str(prod))

    monkeypatch.setenv("DEPLOY_REPO_URL", str(origin))
    monkeypatch.setattr(dom, "PROJECT_ROOT", prod)
    monkeypatch.setattr(deploy_lock, "LOCK_PATH", tmp_path / ".deploy.lock")
    return repos


@dataclass
class Command:
    cmd: list[str]
    cwd: Path
    env: dict | None


@dataclass
class Recorder:
    node_bin: Path
    commands: list[Command] = field(default_factory=list)
    sequence: list[str] = field(default_factory=list)
    failing: set[str] = field(default_factory=set)


def _action_name(cmd: list[str]) -> str:
    if cmd[:2] == ["npm", "ci"]:
        return "npm-ci"
    if "pip" in cmd:
        return "pip-install"
    if cmd[0] == "systemctl":
        return "restart-forms"
    raise AssertionError(f"unexpected command: {cmd}")


@pytest.fixture
def actions(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Recorder:
    """Record every deploy action instead of running it. Add an action name
    to `.failing` to make that action fail."""
    node_bin = tmp_path / "nvm-bin"
    node_bin.mkdir()
    recorder = Recorder(node_bin=node_bin)
    monkeypatch.setattr(bg, "find_node_bin", lambda: str(node_bin))

    def fake_stream(cmd, cwd, env=None):
        name = _action_name(cmd)
        recorder.commands.append(Command(list(cmd), Path(cwd), env))
        recorder.sequence.append(name)
        return 1 if name in recorder.failing else 0

    def fake_build_and_deploy(skip_deploy: bool = False):
        recorder.sequence.append("build-deploy")
        if "build-deploy" in recorder.failing:
            raise RuntimeError("npm run build failed")

    monkeypatch.setattr(dom, "_stream", fake_stream)
    monkeypatch.setattr(bg, "run_astro_build_and_deploy", fake_build_and_deploy)
    return recorder


# --- the happy path ------------------------------------------------------


def test_merge_is_pulled_deployed_and_recorded(repos, actions):
    """Catches the defect this job exists for: a merged PR that never
    reaches the live site because nothing pulls the host checkout (PR #13
    sat undeployed behind d970045). Also catches a run that deploys but
    never records deployed_sha, which would redeploy every 5 minutes."""
    repos.mark_deployed()
    merged = repos.land({"web/src/pages/index.astro": "<h1>new bio</h1>\n"})

    assert dom.main() == 0

    assert repos.head() == merged
    assert actions.sequence == ["build-deploy"]
    assert repos.state() == {"deployed_sha": merged, "failed_sha": None}


def test_tick_after_a_deploy_does_nothing(repos, actions):
    """Catches a rebuild and redeploy on every 5-minute tick: once main is
    live, later ticks must not build, install or restart anything."""
    repos.mark_deployed()
    repos.land({"web/src/pages/index.astro": "<h1>new bio</h1>\n"})
    assert dom.main() == 0
    actions.sequence.clear()

    assert dom.main() == 0

    assert actions.sequence == []


def test_first_tick_without_state_runs_the_full_plan(repos, actions):
    """Catches a bootstrap that trusts an up-to-date checkout: the host was
    pulled by hand, so nothing proves node_modules, env/ or the running forms
    service match HEAD. The first tick must run everything, the installs
    before the build and the forms restart after the deploy."""
    assert not repos.state_file.exists()

    assert dom.main() == 0

    assert actions.sequence == FULL_PLAN
    assert repos.state() == {"deployed_sha": repos.head(), "failed_sha": None}


def test_unknown_deployed_sha_falls_back_to_the_full_plan(repos, actions):
    """Catches a crash, or a too-small plan, when deployed_sha is not in
    HEAD's history (main was force-pushed, or the state file came from
    another clone): with no trustworthy base only the full plan is safe."""
    repos.write_state(deployed_sha="0" * 40)
    repos.land({"web/src/pages/index.astro": "<h1>new bio</h1>\n"})

    assert dom.main() == 0

    assert actions.sequence == FULL_PLAN


# --- the planner ---------------------------------------------------------


@pytest.mark.parametrize(
    ("changed", "expected"),
    [
        pytest.param(["web/package-lock.json"], ["npm-ci", "build-deploy"], id="lockfile"),
        pytest.param(["web/package.json"], ["npm-ci", "build-deploy"], id="manifest"),
        pytest.param(
            ["requirements.txt"],
            ["pip-install", "build-deploy", "restart-forms"],
            id="runtime-requirements",
        ),
        pytest.param(
            ["requirements-dev.txt"],
            ["pip-install", "build-deploy", "restart-forms"],
            id="dev-requirements",
        ),
        pytest.param(
            ["links_bio/fastapi_forms.py"], ["build-deploy", "restart-forms"], id="forms-code"
        ),
        pytest.param(
            ["web/src/pages/index.astro", "scripts/normalize_db.py", "CLAUDE.md"],
            ["build-deploy"],
            id="content-only",
        ),
    ],
)
def test_plan_runs_only_what_the_changed_paths_need(changed, expected):
    """Catches a dependency bump deployed without its install (the build or
    the forms API then runs on stale packages), forms code merged but never
    served because the old process keeps running, and an npm ci or a forms
    restart on every content-only merge."""
    assert dom.plan_actions(changed) == expected


def test_actions_run_on_the_host_toolchain(repos, actions):
    """Catches npm ci started without nvm's bin on PATH (the unit's PATH has
    no npm, so it dies with FileNotFoundError: the bug find_node_bin exists
    for), pip installing into an interpreter other than the env/ the job and
    the services run from, and a `systemctl --user` restart aimed at a user
    unit that does not exist instead of the system forms service."""
    repos.mark_deployed()
    repos.land(
        {
            "web/package-lock.json": '{"lockfileVersion": 3, "v": 2}\n',
            "requirements.txt": "fastapi==2.0\n",
            "links_bio/fastapi_forms.py": "VERSION = 2\n",
        }
    )

    assert dom.main() == 0

    npm, pip, restart = actions.commands
    assert npm.cmd == ["npm", "ci"]
    assert npm.cwd == repos.prod / "web"
    assert npm.env["PATH"].split(os.pathsep)[0] == str(actions.node_bin)
    assert pip.cmd[:4] == [sys.executable, "-m", "pip", "install"]
    assert pip.cmd[-2:] == ["-r", "requirements-dev.txt"]
    assert pip.cwd == repos.prod
    assert restart.cmd[0] == "systemctl"
    assert "--user" not in restart.cmd
    assert restart.cmd[-2:] == ["restart", "metal-archive-forms.service"]


# --- failures and the alert-once rule ------------------------------------


def test_failed_build_alerts_once_and_the_next_merge_replans_from_the_last_good_deploy(
    repos, actions
):
    """Catches three defects of the failure path: a failed deploy that exits
    0 (no alert email), one that alerts again on every 5-minute tick, and one
    that records the broken sha as deployed, so the fix merge plans only its
    own paths and skips the npm ci the broken merge still needs."""
    good = repos.mark_deployed()
    broken = repos.land({"web/package-lock.json": '{"lockfileVersion": 3, "v": 2}\n'})
    actions.failing.add("build-deploy")

    assert dom.main() == 1
    assert repos.state() == {"deployed_sha": good, "failed_sha": broken}

    actions.sequence.clear()
    assert dom.main() == 0
    assert actions.sequence == []

    actions.failing.clear()
    fix = repos.land({"web/src/pages/index.astro": "<h1>fixed</h1>\n"})
    assert dom.main() == 0
    assert actions.sequence == ["npm-ci", "build-deploy"]
    assert repos.state() == {"deployed_sha": fix, "failed_sha": None}


def test_sha_that_already_failed_is_skipped_without_touching_the_checkout(repos, actions):
    """Catches a skip that still fast-forwards or rebuilds: a sha that failed
    and alerted must be left alone, with a zero exit so no second email."""
    good = repos.mark_deployed()
    failed = repos.land({"web/src/pages/index.astro": "<h1>new bio</h1>\n"})
    repos.write_state(deployed_sha=good, failed_sha=failed)

    assert dom.main() == 0

    assert repos.head() == good
    assert actions.sequence == []
    assert repos.state() == {"deployed_sha": good, "failed_sha": failed}


def test_forms_restart_failure_still_deploys_then_fails_the_run(repos, actions):
    """Catches a restart failure (the polkit rule was never installed, say)
    that aborts before the site deploys, or one that is swallowed so nobody
    learns the forms API still runs the old code."""
    good = repos.mark_deployed()
    merged = repos.land({"links_bio/fastapi_forms.py": "VERSION = 2\n"})
    actions.failing.add("restart-forms")

    assert dom.main() == 1

    assert actions.sequence == ["build-deploy", "restart-forms"]
    assert repos.state() == {"deployed_sha": good, "failed_sha": merged}


# --- refusals ------------------------------------------------------------


def _edit_a_tracked_file(repos: Repos) -> None:
    (repos.prod / "README.md").write_text("edited by hand on the host\n")


def _commit_locally(repos: Repos) -> None:
    (repos.prod / "README.md").write_text("a local commit\n")
    git(repos.prod, "commit", "-q", "-am", "local only")


def _check_out_another_branch(repos: Repos) -> None:
    git(repos.prod, "checkout", "-q", "-b", "hotfix")


@pytest.mark.parametrize(
    "break_checkout",
    [_edit_a_tracked_file, _commit_locally, _check_out_another_branch],
    ids=["dirty-tree", "not-fast-forward", "wrong-branch"],
)
def test_unsafe_checkout_is_refused_once(repos, actions, break_checkout):
    """Catches a fast-forward over hand edits on the host, a deploy of local
    commits that never went through a PR, and a deploy of whatever branch was
    left checked out. The job must leave the checkout alone, fail the unit so
    the alert fires, and record the sha so it fires only once."""
    repos.mark_deployed()
    break_checkout(repos)
    before = repos.head()
    merged = repos.land({"web/src/pages/index.astro": "<h1>new bio</h1>\n"})

    assert dom.main() == 1

    assert repos.head() == before
    assert actions.sequence == []
    assert repos.state()["failed_sha"] == merged


def test_incoming_migration_blocks_the_pull(repos, actions):
    """Catches new code pulled and deployed against a reflex.db whose schema
    it does not match yet. reflex.db holds PII that cannot be regenerated,
    so a human backs it up and migrates first."""
    good = repos.mark_deployed()
    merged = repos.land(
        {
            "alembic/versions/0002_add_column.py": "revision = '0002'\n",
            "links_bio/fastapi_forms.py": "VERSION = 2\n",
        }
    )

    assert dom.main() == 1

    assert repos.head() == good
    assert actions.sequence == []
    assert repos.state() == {"deployed_sha": good, "failed_sha": merged}


def test_migration_pulled_by_hand_deploys_on_the_next_tick(repos, actions):
    """Catches a block that never lifts: once the human has pulled and
    migrated, the migration is in HEAD, and only the range that is not
    pulled yet may block. Otherwise main would never deploy again."""
    good = repos.mark_deployed()
    merged = repos.land(
        {
            "alembic/versions/0002_add_column.py": "revision = '0002'\n",
            "links_bio/fastapi_forms.py": "VERSION = 2\n",
        }
    )
    assert dom.main() == 1
    # What the block message asks of the human: pull (then alembic upgrade
    # head), then clear failed_sha.
    git(repos.prod, "merge", "-q", "--ff-only", "origin/main")
    repos.write_state(deployed_sha=good)

    assert dom.main() == 0

    assert actions.sequence == ["build-deploy", "restart-forms"]
    assert repos.state() == {"deployed_sha": merged, "failed_sha": None}


@pytest.mark.parametrize(
    "content",
    ["{not json", '["a", "list"]', '{"deployed_sha": "HEAD", "failed_sha": null}'],
    ids=["truncated", "not-an-object", "not-a-sha"],
)
def test_malformed_state_file_counts_as_no_state(repos, actions, content):
    """Catches a corrupted .deploy-state.json crashing every tick (an alert
    every 5 minutes and nothing deployed), and a value that is not a sha
    reaching git as a revision: "HEAD" would resolve, look already deployed
    and shrink the plan. It must count as no state: the full plan runs once
    and a valid file is written back."""
    repos.state_file.write_text(content)

    assert dom.main() == 0

    assert actions.sequence == FULL_PLAN
    assert repos.state() == {"deployed_sha": repos.head(), "failed_sha": None}


# --- the shared lock -----------------------------------------------------


def test_tick_is_skipped_while_another_run_holds_the_lock(repos, actions):
    """Catches a merge deploy that runs while the twice-daily sync, or an
    earlier slow deploy, is mid-build: its npm ci would delete node_modules
    under the other build. The busy tick must exit 0 (no alert) and must
    not even fetch."""
    repos.mark_deployed()
    remote_before = git(repos.prod, "rev-parse", "refs/remotes/origin/main")
    repos.land({"web/package-lock.json": '{"lockfileVersion": 3, "v": 2}\n'})

    with deploy_lock.hold():
        assert dom.main() == 0

    assert actions.sequence == []
    assert git(repos.prod, "rev-parse", "refs/remotes/origin/main") == remote_before
