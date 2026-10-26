"""The one lock that keeps two builds+deploys of the site from overlapping.

Two jobs build and deploy from the same host checkout:
`scripts/deploy_on_merge.py` (every 5 minutes, when main moved) and
`scripts/sync_and_deploy.py` (twice a day). Run together, one job's
`npm ci` deletes node_modules under the other's `npm run build`, its
fast-forward swaps code under a running sync, and both race to upload
web/.vercel/output. Each job holds this lock for its whole run:

- the deploy job takes it without waiting and skips its tick when it is busy
  (the next tick, 5 minutes later, tries again);
- the sync waits for it, up to a limit, and fails loudly past that limit.

The lock is an `fcntl.flock` on the gitignored `.deploy.lock` at the repo
root. The kernel releases it when the holder's file is closed, which also
happens when the process dies or systemd kills the unit, so a crash never
leaves a stale lock behind.
"""
from __future__ import annotations

import fcntl
import time
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

LOCK_PATH = Path(__file__).resolve().parent.parent / ".deploy.lock"

# How often a waiting holder retries. flock(2) has no timeout of its own.
POLL_SECONDS = 1.0


class LockBusy(RuntimeError):
    """Another job held the deploy lock for longer than the caller would wait."""


@contextmanager
def hold(wait_seconds: float = 0) -> Iterator[None]:
    """Hold the deploy lock for the body of the `with` block.

    With the default `wait_seconds=0` it does not wait at all. Otherwise it
    retries until `wait_seconds` have passed. Either way it raises LockBusy
    if the lock is still held by someone else.
    """
    deadline = time.monotonic() + wait_seconds
    with open(LOCK_PATH, "a") as lock_file:
        while True:
            try:
                fcntl.flock(lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise LockBusy(f"{LOCK_PATH} is held by another sync or deploy") from None
                time.sleep(min(POLL_SECONDS, remaining))
        yield
