"""Regression guards for links_bio.background_sync's full-vs-incremental
YouTube sync decision (T25 item 1).

`scripts/sync_and_deploy.py` runs as a fresh oneshot process twice a day
(06:00 and 18:00, via the links-bio-sync.timer systemd unit). The original
"full sync every 4th cycle" heuristic tracked cycles with an in-process
`_sync_count` global, which always restarted at 1 on a fresh process -- so
once the DB reached >=100 albums, the hole-filling full sync (meant to catch
videos incremental syncs miss) silently stopped running forever. These
tests drive the real two-runs-a-day schedule across several fresh-process
calls and assert a full sync actually happens.

Never touches the dev or production database: album counts come from an
isolated in-memory engine, and authenticate_auto/run_sync are stubbed so
nothing reaches the network.
"""
from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

from sqlmodel import Session, SQLModel, create_engine

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import sync_youtube_to_db
from links_bio import background_sync as bg
from links_bio.models.album import Album


def _dt(*args: int) -> datetime:
    """A tz-aware datetime (year, month, day[, hour[, minute]]) for these
    tests -- should_run_full_sync only reads .hour/.toordinal(), so the
    actual timezone is irrelevant here; being explicit just keeps this
    file's own `datetime(...)` calls lint-clean."""
    return datetime(*args, tzinfo=timezone.utc)


def _seeded_engine(album_count: int):
    """An isolated in-memory engine with exactly `album_count` minimal Album
    rows, so should_run_full_sync's >=100 branch is deterministic regardless
    of what the worktree's dev reflex.db happens to contain."""
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine, tables=[Album.__table__])
    with Session(engine) as session:
        for i in range(album_count):
            session.add(
                Album(
                    band_name=f"Band {i}",
                    album_title=f"Album {i}",
                    year=2020,
                    country="Test Country",
                    genre="Test Genre",
                    youtube_video_id=f"VID{i}",
                )
            )
        session.commit()
    return engine


class _RecordingRunSync:
    """Stands in for sync_youtube_to_db.run_sync: records the solo_nuevos
    it was called with instead of hitting the YouTube API."""

    def __init__(self) -> None:
        self.calls: list[bool] = []

    def __call__(self, youtube_client, solo_nuevos, mark_featured, featured_count):
        self.calls.append(solo_nuevos)


def _stub_pipeline(monkeypatch) -> _RecordingRunSync:
    monkeypatch.setattr("links_bio.youtube_auth.authenticate_auto", lambda: object())
    recorder = _RecordingRunSync()
    monkeypatch.setattr(sync_youtube_to_db, "run_sync", recorder)
    return recorder


def test_should_run_full_sync_always_true_below_100_albums():
    """Catches a regression that drops the "DB nearly empty" branch, which
    exists so a near-empty DB backfills immediately instead of waiting for
    the every-second-day cadence window."""
    assert bg.should_run_full_sync(0, _dt(2026, 10, 6, 18, 0)) is True
    assert bg.should_run_full_sync(99, _dt(2026, 10, 7, 18, 0)) is True


def test_should_run_full_sync_fires_on_the_morning_run_of_every_second_day():
    """Pins down the deterministic, clock-based cadence that replaces the
    in-process counter: a full sync only on the morning run of every second
    day once the DB has >=100 albums, incremental everywhere else."""
    day_a = _dt(2026, 10, 7)  # toordinal() is even
    day_b = _dt(2026, 10, 8)  # toordinal() is odd (the next day)
    assert day_a.toordinal() % 2 == 0
    assert day_b.toordinal() % 2 == 1

    assert bg.should_run_full_sync(150, day_a.replace(hour=6)) is True
    assert bg.should_run_full_sync(150, day_a.replace(hour=18)) is False
    assert bg.should_run_full_sync(150, day_b.replace(hour=6)) is False
    assert bg.should_run_full_sync(150, day_b.replace(hour=18)) is False


def test_run_youtube_sync_runs_a_full_sync_across_two_days_of_fresh_processes(
    monkeypatch, clean_env
):
    """Reproduces the real schedule: scripts/sync_and_deploy.py runs as a
    brand-new process at 06:00 and 18:00. Catches the regression where the
    hole-filling full sync never ran once the DB reached >=100 albums,
    because the old in-process `_sync_count` counter reset to 1 on every
    fresh process (so `_sync_count % 4` was always 1, never 0).
    """
    recorder = _stub_pipeline(monkeypatch)
    monkeypatch.setattr("links_bio.db.engine", _seeded_engine(150))

    run_times = [
        _dt(2026, 10, 7, 6, 0),
        _dt(2026, 10, 7, 18, 0),
        _dt(2026, 10, 8, 6, 0),
        _dt(2026, 10, 8, 18, 0),
    ]
    for run_time in run_times:
        monkeypatch.setattr(bg, "_now", lambda rt=run_time: rt)
        bg.run_youtube_sync()

    assert len(recorder.calls) == 4
    full_syncs = [solo_nuevos is False for solo_nuevos in recorder.calls]
    assert any(full_syncs), (
        f"expected at least one full sync across 2 days of fresh-process "
        f"runs, got none: {recorder.calls}"
    )
    assert full_syncs.count(True) == 1, (
        "expected exactly one full sync in this 2-day/4-run window, "
        f"matching the ~every-4th-cycle cadence: {recorder.calls}"
    )


def test_full_youtube_sync_flag_forces_full_sync_regardless_of_cadence(
    monkeypatch, clean_env
):
    """Catches a regression where force_full stops overriding the cadence
    for a manual backfill (e.g. the --full-youtube-sync CLI flag wired to
    it in scripts/sync_and_deploy.py)."""
    recorder = _stub_pipeline(monkeypatch)
    monkeypatch.setattr("links_bio.db.engine", _seeded_engine(150))
    # A time where the normal cadence would choose incremental.
    monkeypatch.setattr(bg, "_now", lambda: _dt(2026, 10, 7, 18, 0))

    bg.run_youtube_sync(force_full=True)

    assert recorder.calls == [False]
