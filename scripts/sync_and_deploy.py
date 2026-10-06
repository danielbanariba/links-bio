#!/usr/bin/env python3
"""Run ONE cycle of YouTube sync -> normalize -> artwork -> Astro
build+deploy, then exit.

Replaces having links-bio.service run the entire legacy Reflex app 24/7
(~490MB RAM) just to host links_bio/background_sync.py's daemon thread.
This script reuses that module's step functions directly and is meant to
be run twice a day by the links-bio-sync.{service,timer} systemd user
units.

A failed step logs clearly and makes the process exit non-zero. This
script never sends its own email: systemd's OnFailure=notify-failure@%n.service
on links-bio-sync.service is the one alert mechanism, so a failure is
reported exactly once no matter which step inside the cycle failed.

Usage:
    scripts/sync_and_deploy.py [--skip-youtube] [--skip-artwork] [--skip-deploy]
"""
from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from links_bio import background_sync as bg  # noqa: E402

logger = logging.getLogger("sync_and_deploy")


def run_cycle(skip_youtube: bool, skip_artwork: bool, skip_deploy: bool) -> list[str]:
    """Run each pipeline step once, in order. Returns the names of the
    steps that failed; a skipped step is never counted as failed. The
    normalize step has no skip flag -- it's the cheap, fast, local-only
    step and always runs so a dry run (--skip-youtube --skip-artwork
    --skip-deploy) still proves the DB-to-build pipeline works."""
    failed: list[str] = []

    if skip_youtube:
        logger.info("--skip-youtube: skipping the YouTube sync step.")
    else:
        try:
            bg.run_youtube_sync()
        except Exception:
            logger.exception("youtube-sync step failed")
            failed.append("youtube-sync")

    try:
        bg.run_normalize()
    except Exception:
        logger.exception("normalize step failed")
        failed.append("normalize")

    if skip_artwork:
        logger.info("--skip-artwork: skipping the artwork sync step.")
    else:
        try:
            bg.run_artwork_sync()
        except Exception:
            logger.exception("artwork-sync step failed")
            failed.append("artwork-sync")

    try:
        bg.run_astro_build_and_deploy(skip_deploy=skip_deploy)
    except Exception:
        logger.exception("build-deploy step failed")
        failed.append("build-deploy")

    return failed


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="[sync_and_deploy] %(levelname)s %(message)s")

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--skip-youtube", action="store_true", help="skip the YouTube video sync step")
    parser.add_argument("--skip-artwork", action="store_true", help="skip the DeathGrind artwork sync step")
    parser.add_argument(
        "--skip-deploy",
        action="store_true",
        help="build the Astro site but do not run `vercel deploy`",
    )
    args = parser.parse_args(argv)

    failed = run_cycle(args.skip_youtube, args.skip_artwork, args.skip_deploy)

    if failed:
        logger.error("sync_and_deploy: %d step(s) failed: %s", len(failed), ", ".join(failed))
        return 1

    logger.info("sync_and_deploy: all steps completed successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
