"""Regression guard for the post-T7 fallback in
links_bio.youtube_auth.get_channel_id_from_env_or_derive.

T7 deleted the legacy Reflex app and dropped the `reflex` dependency, but the
DB-derived fallback branch still did `import reflex as rx` and
`with rx.session() as session:` to read the first Album with a
youtube_video_id. With `reflex` no longer installed (requirements.txt no
longer lists it) that import fails, and the surrounding broad
`except Exception: pass` silently swallows it -- so an API-key-only host
without YOUTUBE_CHANNEL_ID configured could no longer derive a channel id at
all, and sync_youtube_to_db.py would raise "No se pudo determinar Channel
Id.".

This test simulates `reflex` being absent (the real post-merge state) and
verifies the fallback instead reads through links_bio.db.engine via a plain
SQLModel session, never touching the real dev or production database.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest
from sqlmodel import Session, create_engine

from links_bio.models.album import Album
from links_bio.youtube_auth import get_channel_id_from_env_or_derive


def _make_scratch_engine(scratch_db: Path):
    return create_engine(
        f"sqlite:///{scratch_db}", connect_args={"check_same_thread": False}
    )


def _seed_single_album_with_video(engine, video_id: str) -> None:
    """Clear the albums table and insert exactly one row carrying
    `video_id`, so the fallback's unordered `.limit(1)` query has a
    deterministic result to find regardless of what the dev DB snapshot
    already contained."""
    with Session(engine) as session:
        session.exec(Album.__table__.delete())
        session.add(
            Album(
                band_name="Test Band",
                album_title="Test Album",
                year=2020,
                country="Test Country",
                genre="Test Genre",
                youtube_video_id=video_id,
            )
        )
        session.commit()


class _FakeVideosList:
    """Stands in for the `youtube.videos()` resource: records the kwargs
    `.list()` was called with and returns a canned `.execute()` payload."""

    def __init__(self, channel_id: str) -> None:
        self._channel_id = channel_id
        self.received_kwargs: dict | None = None

    def list(self, **kwargs):
        self.received_kwargs = kwargs
        return self

    def execute(self):
        return {"items": [{"snippet": {"channelId": self._channel_id}}]}


class _FakeYoutubeClient:
    """Minimal stand-in for the googleapiclient YouTube client. Only
    `videos()` is implemented: the OAuth `channels().list(mine=True)` branch
    must be skipped in this test (API-key-only env), so it is never called.
    """

    def __init__(self, channel_id: str) -> None:
        self.videos_list = _FakeVideosList(channel_id)

    def videos(self):
        return self.videos_list


@pytest.fixture
def api_key_only_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """No YOUTUBE_CHANNEL_ID, no OAuth refresh token, a fake API key -- so
    get_channel_id_from_env_or_derive falls straight through to the
    DB-derived branch under test."""
    monkeypatch.delenv("YOUTUBE_CHANNEL_ID", raising=False)
    monkeypatch.delenv("YOUTUBE_REFRESH_TOKEN", raising=False)
    monkeypatch.setenv("YOUTUBE_API_KEY", "fake-api-key")


def test_derives_channel_id_from_db_engine_without_reflex_installed(
    scratch_db: Path,
    monkeypatch: pytest.MonkeyPatch,
    api_key_only_env: None,
) -> None:
    """Simulates the real post-T7 state (reflex not importable) and checks
    the fallback reads the album through links_bio.db.engine instead."""
    monkeypatch.setitem(sys.modules, "reflex", None)

    engine = _make_scratch_engine(scratch_db)
    _seed_single_album_with_video(engine, "VID123")
    monkeypatch.setattr("links_bio.db.engine", engine)

    fake_client = _FakeYoutubeClient("UC_fake")

    result = get_channel_id_from_env_or_derive(fake_client)

    assert result == "UC_fake"
    assert fake_client.videos_list.received_kwargs is not None
    assert fake_client.videos_list.received_kwargs.get("id") == "VID123"


def test_db_fallback_failure_is_logged_before_raising(
    monkeypatch: pytest.MonkeyPatch,
    api_key_only_env: None,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Catches the regression this task fixes: the DB-fallback branch's
    `except Exception: pass` swallowed every failure with no trace at all
    -- the exact mechanism that hid the T7 reflex-import regression (a
    broken import inside this same try/except went completely unnoticed).
    Forces the fallback query itself to fail (an engine with no `albums`
    table at all, not just an empty one) and asserts the RuntimeError is
    still raised, but now with the underlying cause logged.
    """
    import logging

    broken_engine = _make_scratch_engine(Path(":memory:"))
    monkeypatch.setattr("links_bio.db.engine", broken_engine)

    caplog.set_level(logging.WARNING)
    with pytest.raises(RuntimeError):
        get_channel_id_from_env_or_derive(object())

    assert any("OperationalError" in record.getMessage() for record in caplog.records), (
        f"expected the swallowed exception's type/message in the log, got: "
        f"{[r.getMessage() for r in caplog.records]}"
    )
